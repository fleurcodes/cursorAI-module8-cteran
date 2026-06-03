from pathlib import Path

from flask import Flask, jsonify
from flasgger import Swagger

from config import Config
from extensions import cache, db, jwt, limiter, ma, socketio
from resources.auth import auth_bp
from resources.notifications import notifications_bp
from resources.projects import projects_bp
from resources.support_admin import support_admin_bp
from resources.support_agents import support_agents_bp
from resources.support_tickets import support_tickets_bp
from resources.tasks import tasks_bp
from resources.user import user_bp
from review_accounts import ensure_review_accounts


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    ma.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins='*')
    cache.init_app(app)
    limiter.init_app(app)

    from celery_app import init_celery

    init_celery(app)
    import jobs  # noqa: F401 — register Celery tasks

    upload_dir = Path(app.config['UPLOAD_FOLDER'])
    upload_dir.mkdir(parents=True, exist_ok=True)

    Swagger(
        app,
        template={
            'securityDefinitions': {
                'Bearer': {
                    'type': 'apiKey',
                    'name': 'Authorization',
                    'in': 'header',
                    'description': 'JWT access token: `Bearer <token>` from POST /api/login or /api/register',
                }
            },
        },
        config={
            'headers': [],
            'specs': [
                {
                    'endpoint': 'apispec_1',
                    'route': '/apispec_1.json',
                    'rule_filter': lambda rule: True,
                    'model_filter': lambda tag: True,
                }
            ],
            'static_url_path': '/flasgger_static',
            'swagger_ui': True,
            'specs_route': '/apidocs/',
        },
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(support_tickets_bp)
    app.register_blueprint(support_agents_bp)
    app.register_blueprint(support_admin_bp)

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'message': 'Bad request', 'detail': getattr(error, 'description', None)}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'message': 'Resource not found'}), 404

    @app.errorhandler(429)
    def rate_limited(error):
        return jsonify(
            {
                'status': 'error',
                'message': 'Too many requests',
                'code': 'RATE_LIMIT_EXCEEDED',
            }
        ), 429

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'message': 'Internal server error'}), 500

    @app.route('/')
    def index():
        """
        Health and discovery links for the API.
        ---
        tags:
          - Meta
        responses:
          200:
            description: JSON with common route paths
        """
        return {
            'message': 'CursorAI backend is running',
            'swagger': '/apidocs/',
            'register': '/api/register',
            'login': '/api/login',
            'support': {
                'tickets': '/api/tickets',
                'admin_dashboard': '/api/admin/dashboard',
                'support_notifications': '/api/profile/support-notifications',
            },
            'profile': '/api/profile',
            'projects': '/api/projects',
            'tasks': '/api/projects/<project_id>/tasks',
            'notifications': '/api/notifications',
            'team': '/api/team',
            'users': '/api/users',
        }

    with app.app_context():
        db.create_all()
        ensure_review_accounts()

    return app


app = create_app()


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
