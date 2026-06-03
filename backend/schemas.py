from marshmallow import EXCLUDE, Schema, fields, validate


class RegisterSchema(Schema):
    full_name = fields.Str(required=True, validate=validate.Length(min=2))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    role = fields.Str(required=False, validate=validate.OneOf(['manager', 'developer', 'designer', 'qa', 'admin']))
    support_role = fields.Str(
        required=False,
        load_default='none',
        validate=validate.OneOf(['none', 'customer', 'agent', 'admin']),
    )


class LoginSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    email = fields.Email(required=True)
    password = fields.Str(required=True)


class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    full_name = fields.Str()
    email = fields.Email()
    role = fields.Str()
    support_role = fields.Str()
    availability_status = fields.Str()
    expertise_areas = fields.Method('dump_expertise', dump_only=True)
    status = fields.Str()
    avatar_url = fields.Str(allow_none=True)
    created_at = fields.DateTime()

    def dump_expertise(self, obj):
        return obj.get_expertise_areas()


class ProjectMemberSchema(Schema):
    user_id = fields.Int(attribute='user.id')
    full_name = fields.Str(attribute='user.full_name')
    email = fields.Email(attribute='user.email')
    role = fields.Str()
    joined_at = fields.DateTime()


class TaskSchema(Schema):
    id = fields.Int(dump_only=True)
    title = fields.Str()
    description = fields.Str(allow_none=True)
    status = fields.Str()
    priority = fields.Str()
    due_date = fields.Date()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    assignee = fields.Nested(UserSchema, allow_none=True)
    creator = fields.Nested(UserSchema)
    project_id = fields.Int()


class TaskCreateSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=3))
    description = fields.Str(required=False, allow_none=True)
    assignee_id = fields.Int(required=False, allow_none=True)
    priority = fields.Str(required=False, validate=validate.OneOf(['low', 'medium', 'high']), load_default='medium')
    due_date = fields.Date(required=False, allow_none=True)


class TaskUpdateSchema(Schema):
    title = fields.Str(required=False)
    description = fields.Str(required=False, allow_none=True)
    status = fields.Str(required=False, validate=validate.OneOf(['todo', 'in-progress', 'completed', 'blocked']))
    priority = fields.Str(required=False, validate=validate.OneOf(['low', 'medium', 'high']))
    assignee_id = fields.Int(required=False, allow_none=True)
    due_date = fields.Date(required=False, allow_none=True)


class ProjectCreateSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=3))
    description = fields.Str(required=False, allow_none=True)
    status = fields.Str(required=False, validate=validate.OneOf(['on-track', 'at-risk', 'delayed']), load_default='on-track')
    start_date = fields.Date(required=False, allow_none=True)
    end_date = fields.Date(required=False, allow_none=True)
    member_ids = fields.List(fields.Int(), required=False, load_default=[])


class ProjectUpdateSchema(Schema):
    name = fields.Str(required=False)
    description = fields.Str(required=False, allow_none=True)
    status = fields.Str(required=False, validate=validate.OneOf(['on-track', 'at-risk', 'delayed', 'completed']))
    start_date = fields.Date(required=False, allow_none=True)
    end_date = fields.Date(required=False, allow_none=True)


class ProjectSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str()
    description = fields.Str(allow_none=True)
    status = fields.Str()
    progress = fields.Int()
    total_tasks = fields.Int()
    completed_tasks = fields.Int()
    in_progress_tasks = fields.Int()
    overdue_tasks = fields.Int()
    start_date = fields.Date(allow_none=True)
    end_date = fields.Date(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    # Serialize ProjectMember rows (role, joined_at, user fields). `Project.members` is a
    # view-only User collection and does not match ProjectMemberSchema; use memberships.
    members = fields.List(fields.Nested(ProjectMemberSchema), attribute='memberships')
    tasks = fields.List(fields.Nested(TaskSchema))


class ProjectMemberCreateSchema(Schema):
    user_id = fields.Int(required=True)
    role = fields.Str(required=False, validate=validate.OneOf(['manager', 'developer', 'designer', 'qa', 'admin']), load_default='developer')


class NotificationSchema(Schema):
    id = fields.Int(dump_only=True)
    title = fields.Str()
    message = fields.Str()
    level = fields.Str()
    is_read = fields.Bool()
    created_at = fields.DateTime()
    sender = fields.Nested(UserSchema, allow_none=True)
    project = fields.Nested(ProjectSchema, allow_none=True)


class NotificationCreateSchema(Schema):
    user_id = fields.Int(required=True)
    project_id = fields.Int(required=False, allow_none=True)
    title = fields.Str(required=True, validate=validate.Length(min=3))
    message = fields.Str(required=True, validate=validate.Length(min=5))
    level = fields.Str(required=False, validate=validate.OneOf(['info', 'warning', 'success', 'error']), load_default='info')
