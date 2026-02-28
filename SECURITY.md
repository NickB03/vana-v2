# Security Policy

## Supported Versions

| Version       | Supported |
| ------------- | --------- |
| `main` branch | Yes       |

Only the latest commit on the `main` branch receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

1. Email **security@example.com** with a description of the vulnerability, steps to reproduce, and any relevant logs or screenshots.
2. You will receive an acknowledgment within **48 hours**.
3. We will investigate and provide a fix or mitigation plan within **90 days** of the initial report.
4. Once a fix is released, we will publicly disclose the vulnerability with credit to the reporter (unless anonymity is requested).

## Security Model

### Authentication

Vana v2 uses [Supabase Auth](https://supabase.com/docs/guides/auth) for user authentication.

- Session tokens are refreshed automatically via Next.js middleware (`lib/supabase/middleware.ts`).
- Unauthenticated requests to protected routes are redirected to `/auth/login`.
- Public paths (`/`, `/auth`, `/share`, `/api`) are accessible without authentication.
- Authentication can be disabled for local development with `ENABLE_AUTH=false`.

### Row-Level Security (RLS)

All database tables enforce PostgreSQL Row-Level Security via `current_setting('app.current_user_id')`:

- **chats** -- Users can only read, create, update, and delete their own chats. Chats with `visibility = 'public'` are readable by anyone.
- **messages** -- Access is granted only when the user owns the parent chat (verified via `EXISTS` subquery).
- **parts** -- Access is granted only when the user owns the parent chat (verified via join through `messages` to `chats`).
- **feedback** -- Anyone can insert feedback; all feedback is readable (no sensitive user data stored).

RLS is enabled on every table (`enableRLS()` in the Drizzle schema at `lib/db/schema.ts`).

### File Upload Restrictions

The upload endpoint (`app/api/upload/route.ts`) enforces the following:

- **Authentication required** -- only logged-in users can upload files.
- **Maximum file size** -- 5 MB.
- **Allowed MIME types** -- `image/jpeg`, `image/png`, `application/pdf`.
- Files are stored in a Supabase Storage bucket scoped per user.

### Rate Limiting

- **Guest chat** -- daily request limits enforced via Upstash Redis when `ENABLE_GUEST_CHAT=true`.
- **Authenticated users** -- overall chat limits enforced via Upstash Redis in cloud deployments.
- Rate-limit state is stored in Redis and is not persisted in the primary database.

### Guest Mode Isolation

- Guest sessions are ephemeral and are not persisted to the database.
- Guest users are forced to the `speed` model type and cannot select `quality` models.
- Guest chat requires `ENABLE_GUEST_CHAT=true`; otherwise, unauthenticated requests receive `401 Unauthorized`.

## Out of Scope

The following are **not** considered vulnerabilities under this policy:

- Denial-of-service attacks against the application or infrastructure.
- Social engineering of project maintainers or contributors.
- Vulnerabilities in third-party dependencies that are already publicly disclosed (please open a regular issue to help us track the upgrade).
- Issues that require physical access to a user's device.
- Missing security headers or best-practice deviations that do not lead to a concrete exploit.
