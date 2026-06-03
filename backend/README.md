# Backend API

This backend contains a simple Flask REST API with:

- SQLAlchemy data modeling
- Marshmallow validation and serialization
- JWT authentication with `flask-jwt-extended`
- Swagger UI documentation with `flasgger`

## Quick start

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   python app.py
   ```

4. Open Swagger UI:
   ```
   http://localhost:5000/apidocs
   ```

## API endpoints

- `POST /api/register` — create a new user
- `POST /api/login` — authenticate and receive a JWT
- `GET /api/profile` — retrieve current user profile
- `GET /api/projects` — list projects for the authenticated user
- `POST /api/projects` — create a new project
- `GET /api/projects/<project_id>` — fetch a project by ID
- `PATCH /api/projects/<project_id>` — update a project
- `DELETE /api/projects/<project_id>` — delete a project
- `GET /api/projects/<project_id>/members` — list project collaborators
- `POST /api/projects/<project_id>/members` — add a project collaborator
- `DELETE /api/projects/<project_id>/members/<user_id>` — remove a collaborator
- `GET /api/projects/<project_id>/tasks` — list tasks in a project
- `POST /api/projects/<project_id>/tasks` — create a new task
- `GET /api/tasks/<task_id>` — fetch a task by ID
- `PATCH /api/tasks/<task_id>` — update a task
- `DELETE /api/tasks/<task_id>` — delete a task
- `GET /api/notifications` — list notifications for the current user
- `POST /api/notifications/send` — send a notification to a user
- `PATCH /api/notifications/<notification_id>/read` — mark a notification as read

## Real-time notifications

This backend exposes Socket.IO events for real-time notification delivery.

Connect with a JWT access token as a query string parameter:

```bash
wss://localhost:5000/socket.io/?EIO=4&transport=websocket&access_token=<JWT>
```

Event names:

- `connected` — connection confirmed
- `notification` — notification payload delivered to the user
- `project.notification` — broadcast notifications scoped to a project
- `task.assigned` — task assignment event
- `task.completed` — task completion event

## Environment

Use environment variables to override defaults:

- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `DATABASE_URL`
