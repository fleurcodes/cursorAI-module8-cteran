from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required
from marshmallow import ValidationError

from extensions import db
from models import User
from schemas import LoginSchema, RegisterSchema, UserSchema


auth_bp = Blueprint('auth', __name__, url_prefix='/api')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user.
    ---
    tags:
      - Authentication
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            full_name:
              type: string
            email:
              type: string
            password:
              type: string
            role:
              type: string
              enum: [manager, developer, designer, qa, admin]
            support_role:
              type: string
              enum: [none, customer, agent, admin]
              description: Support portal access (default none)
          required: [full_name, email, password]
    responses:
      201:
        description: Created
      400:
        description: Validation error
      409:
        description: Email already in use
    """
    try:
        payload = RegisterSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    if User.query.filter_by(email=payload['email']).first():
        return jsonify({'message': 'Email already in use'}), 409

    support = payload.get('support_role', 'none')
    user = User(
        full_name=payload['full_name'],
        email=payload['email'],
        role=payload.get('role', 'developer'),
        support_role=support,
        availability_status='available' if support == 'agent' else 'offline',
    )
    user.set_password(payload['password'], bcrypt_rounds=int(current_app.config.get('BCRYPT_ROUNDS', 12)))
    if support == 'agent':
        user.set_expertise_areas(['technical', 'billing', 'general', 'feature_request'])

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    return (
        jsonify(
            {
                'user': UserSchema().dump(user),
                'access_token': access_token,
                'refresh_token': refresh_token,
                'message': 'Created',
            }
        ),
        201,
    )


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate and request a JWT access token.
    ---
    tags:
      - Authentication
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
              format: email
            password:
              type: string
          required: [email, password]
    responses:
      200:
        description: Access token returned
      400:
        description: Validation error
      401:
        description: Invalid credentials
    """
    try:
        payload = LoginSchema().load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    user = User.query.filter_by(email=payload['email']).first()
    if not user or not user.check_password(payload['password']):
        return jsonify({'message': 'Invalid credentials'}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    return jsonify({'access_token': access_token, 'refresh_token': refresh_token, 'user': UserSchema().dump(user)}), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Exchange a valid refresh JWT for a new access + refresh pair.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: New tokens issued
      401:
        description: Missing or invalid refresh token
    """
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))
    return jsonify({'access_token': access_token, 'refresh_token': refresh_token}), 200
