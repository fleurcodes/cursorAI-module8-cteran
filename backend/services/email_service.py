"""Email notifications (FR-035); uses SMTP when configured, else logs."""

import logging
import smtplib
from email.message import EmailMessage

from flask import current_app

log = logging.getLogger(__name__)


def send_email(to_addr: str, subject: str, body: str) -> None:
    app = current_app
    server = app.config.get('MAIL_SERVER') or ''
    if not server:
        log.info('[email stub] To=%s Subject=%s\n%s', to_addr, subject, body[:2000])
        return

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = app.config.get('MAIL_DEFAULT_SENDER', 'noreply@localhost')
    msg['To'] = to_addr
    msg.set_content(body)

    port = int(app.config.get('MAIL_PORT', 587))
    use_tls = app.config.get('MAIL_USE_TLS', True)
    user = app.config.get('MAIL_USERNAME', '')
    password = app.config.get('MAIL_PASSWORD', '')

    with smtplib.SMTP(server, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
