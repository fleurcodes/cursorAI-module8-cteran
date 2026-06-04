"""User model helpers edge cases."""

from __future__ import annotations

import json

from models import User


def test_get_expertise_areas_invalid_json_returns_empty_list():
    u = User(
        full_name='Bad JSON',
        email='badjson-user@example.com',
        password_hash='x',
        expertise_areas='not-json',
    )
    assert u.get_expertise_areas() == []


def test_get_expertise_areas_non_list_json_returns_empty_list():
    u = User(
        full_name='Obj JSON',
        email='objjson-user@example.com',
        password_hash='x',
        expertise_areas=json.dumps({'k': 'v'}),
    )
    assert u.get_expertise_areas() == []


def test_check_password_legacy_invalid_bcrypt_returns_false():
    u = User(full_name='Legacy', email='legacy-bc@example.com', password_hash='$2b$04$invalidhashvaluehere')
    assert u.check_password('anything') is False


def test_check_password_bcrypt_valueerror_returns_false():
    u = User(full_name='Bcrypt Bad', email='bcrypt-bad@example.com', password_hash='$2b$04$')
    assert u.check_password('x') is False
