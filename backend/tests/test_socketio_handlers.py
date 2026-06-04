"""Socket.IO connect and join_project handlers (JWT via query string)."""

from __future__ import annotations

from tests.conftest import auth_header, create_project, register_user


def test_socketio_connect_with_jwt_query_string(app, client):
    from extensions import socketio

    tok, _ = register_user(client, 'sio-connect@example.com')
    sio = socketio.test_client(app, flask_test_client=client, query_string=f'jwt={tok}')
    assert sio.is_connected()
    sio.disconnect()


def test_socketio_join_project_room(app, client):
    from extensions import socketio

    tok, _ = register_user(client, 'sio-join@example.com')
    pid = create_project(client, tok, 'Socket Project')
    sio = socketio.test_client(app, flask_test_client=client, query_string=f'jwt={tok}')
    assert sio.is_connected()
    sio.emit('join_project', {'project_id': pid})
    sio.disconnect()


def test_socketio_connect_rejects_invalid_jwt(app, client):
    from extensions import socketio

    sio = socketio.test_client(app, flask_test_client=client, query_string='jwt=not-a-real-token')
    assert not sio.is_connected()
