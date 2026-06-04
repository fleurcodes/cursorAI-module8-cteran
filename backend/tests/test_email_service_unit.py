"""Unit tests for email_service (stub vs SMTP)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.email_service import send_email


def test_send_email_logs_when_no_mail_server(app, caplog):
    app.config['MAIL_SERVER'] = ''
    with app.app_context():
        with caplog.at_level('INFO', logger='services.email_service'):
            send_email('user@example.com', 'Hello', 'Body text here')
    assert any('email stub' in r.message for r in caplog.records)


def test_send_email_smtp_with_tls_and_login(app):
    app.config['MAIL_SERVER'] = 'smtp.example.test'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'user'
    app.config['MAIL_PASSWORD'] = 'secret'
    app.config['MAIL_DEFAULT_SENDER'] = 'from@example.test'

    mock_ctx = MagicMock()
    mock_smtp = MagicMock()
    mock_ctx.__enter__.return_value = mock_smtp
    mock_ctx.__exit__.return_value = None

    with app.app_context():
        with patch('services.email_service.smtplib.SMTP', return_value=mock_ctx) as SMTP:
            send_email('to@example.test', 'Subject line', 'Plain body')
    SMTP.assert_called_once_with('smtp.example.test', 587, timeout=30)
    mock_smtp.starttls.assert_called_once()
    mock_smtp.login.assert_called_once_with('user', 'secret')
    mock_smtp.send_message.assert_called_once()


def test_send_email_smtp_no_tls_no_login(app):
    app.config['MAIL_SERVER'] = 'smtp.example.test'
    app.config['MAIL_PORT'] = 25
    app.config['MAIL_USE_TLS'] = False
    app.config['MAIL_USERNAME'] = ''
    app.config['MAIL_PASSWORD'] = ''

    mock_ctx = MagicMock()
    mock_smtp = MagicMock()
    mock_ctx.__enter__.return_value = mock_smtp

    with app.app_context():
        with patch('services.email_service.smtplib.SMTP', return_value=mock_ctx):
            send_email('to@example.test', 'Sub', 'Body')
    mock_smtp.starttls.assert_not_called()
    mock_smtp.login.assert_not_called()
    mock_smtp.send_message.assert_called_once()
