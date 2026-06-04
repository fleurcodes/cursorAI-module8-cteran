"""Marshmallow schemas for customer support (PRD)."""

from marshmallow import Schema, fields, validates, ValidationError, validate

from utils.validation import validate_subject


class TicketCreateSchema(Schema):
    subject = fields.Str(required=True)
    description = fields.Str(required=True)
    priority = fields.Str(required=True, validate=validate.OneOf(['low', 'medium', 'high', 'urgent']))
    category = fields.Str(
        required=True,
        validate=validate.OneOf(['technical', 'billing', 'general', 'feature_request']),
    )
    customer_email = fields.Email(required=False, allow_none=True)
    on_behalf_email = fields.Email(required=False, allow_none=True)
    auto_assign = fields.Bool(load_default=True)

    @validates('subject')
    def validate_subject_field(self, value, **kwargs):
        err = validate_subject(value)
        if err:
            raise ValidationError(err)

    @validates('description')
    def validate_description(self, value, **kwargs):
        v = (value or '').strip()
        if len(v) < 20:
            raise ValidationError('Description must be at least 20 characters.')
        if len(v) > 5000:
            raise ValidationError('Description must be at most 5000 characters.')


class TicketUpdateSchema(Schema):
    subject = fields.Str(required=False)
    description = fields.Str(required=False)

    @validates('subject')
    def validate_subject_field(self, value, **kwargs):
        if value is None:
            return
        err = validate_subject(value)
        if err:
            raise ValidationError(err)

    @validates('description')
    def validate_description(self, value, **kwargs):
        if value is None:
            return
        v = (value or '').strip()
        if len(v) < 20:
            raise ValidationError('Description must be at least 20 characters.')
        if len(v) > 5000:
            raise ValidationError('Description must be at most 5000 characters.')


class TicketStatusSchema(Schema):
    status = fields.Str(required=True)
    note = fields.Str(required=False, allow_none=True)


class TicketPrioritySchema(Schema):
    priority = fields.Str(required=True, validate=validate.OneOf(['low', 'medium', 'high', 'urgent']))
    reason = fields.Str(required=True, validate=validate.Length(min=3, max=2000))


class TicketAssignSchema(Schema):
    agent_id = fields.Int(required=True)


class CommentCreateSchema(Schema):
    content = fields.Str(required=True, validate=validate.Length(min=1, max=10000))
    is_internal = fields.Bool(load_default=False)


class UserUpdateSupportSchema(Schema):
    full_name = fields.Str(required=False, validate=validate.Length(min=2, max=128))
    support_role = fields.Str(required=False, validate=validate.OneOf(['none', 'customer', 'agent', 'admin']))
    availability_status = fields.Str(
        required=False,
        validate=validate.OneOf(['available', 'busy', 'offline']),
    )
    expertise_areas = fields.List(fields.Str(), required=False)


class NotificationPreferencesSchema(Schema):
    email_ticket_created = fields.Bool(required=False)
    email_ticket_assigned = fields.Bool(required=False)
    email_status_changed = fields.Bool(required=False)
    email_new_comment = fields.Bool(required=False)
    email_sla = fields.Bool(required=False)
    in_app_enabled = fields.Bool(required=False)


class SatisfactionSchema(Schema):
    score = fields.Int(required=True, validate=validate.Range(min=1, max=5))


class AdminReportExportSchema(Schema):
    report_type = fields.Str(
        required=True,
        validate=validate.OneOf(['tickets', 'agents', 'sla', 'categories']),
    )
    format = fields.Str(required=False, load_default='csv', validate=validate.OneOf(['csv', 'json']))
