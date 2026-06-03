from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache

from rate_limit_key import rate_limit_key


db = SQLAlchemy()
ma = Marshmallow()
jwt = JWTManager()
socketio = SocketIO()
cache = Cache()
limiter = Limiter(key_func=rate_limit_key, enabled=True)
