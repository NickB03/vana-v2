# Vana v2 Environment Reference

This document defines the environment-variable matrix for Vana v2.

## Required (Day-1 bootstrap)

| Variable              | Required | Purpose                                           |
| --------------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string for Drizzle/Supabase |
| `AI_GATEWAY_API_KEY`  | Yes      | Vercel AI Gateway provider key                    |
| `TAVILY_API_KEY`      | Yes      | Primary search provider key                       |

## Core behavior controls

| Variable              | Default                          | Purpose                                    |
| --------------------- | -------------------------------- | ------------------------------------------ |
| `ENABLE_AUTH`         | `true`                           | Toggle auth required mode                  |
| `ANONYMOUS_USER_ID`   | `anonymous-user`                 | Shared local user id when auth is disabled |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:43100` fallback | Metadata base URL and canonical links      |

## Cloud deployment controls

| Variable                            | Required in cloud       | Purpose                                    |
| ----------------------------------- | ----------------------- | ------------------------------------------ |
| `VANA_CLOUD_DEPLOYMENT`             | Yes                     | Enables cloud-mode guardrails and behavior |
| `NEXT_PUBLIC_VANA_CLOUD_DEPLOYMENT` | Recommended             | Hides client-only controls in cloud mode   |
| `UPSTASH_REDIS_REST_URL`            | Yes (if limits enabled) | Redis endpoint for limits                  |
| `UPSTASH_REDIS_REST_TOKEN`          | Yes (if limits enabled) | Redis credential                           |

## Authentication (Supabase)

Required when `ENABLE_AUTH=true`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Storage (Supabase)

- `SUPABASE_STORAGE_BUCKET` (default: `user-uploads`)

## Search provider options

- `BRAVE_SEARCH_API_KEY` (multimedia/general search)
- `SEARCH_API` (`tavily`, `exa`, `firecrawl`)
- `EXA_API_KEY` / `FIRECRAWL_API_KEY` (if selected)

## AI provider options (Direct)

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `OLLAMA_BASE_URL`

## Optional platform features

- Guest mode: `ENABLE_GUEST_CHAT`, `GUEST_CHAT_DAILY_LIMIT`
- Tracing/observability: `ENABLE_LANGFUSE_TRACING`, `LANGFUSE_*`
- Performance diagnostics: `ENABLE_PERF_LOGGING`

## Local setup workflow

1. `cp .env.local.example .env.local`
2. Start local Supabase CLI: `npx supabase start`
   - **Note:** This project uses a custom port range (**4432x**) to avoid conflicts with other Supabase projects.
3. Fill required variables in `.env.local`:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres`
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321`
   - `DATABASE_SSL_DISABLED=true` (Required for local DB)
4. **Docker Networking:** If running the app via Docker, the container must use `host.docker.internal:44322` for the database URL (this is pre-configured in `docker-compose.yaml`).
5. `bun run migrate`
6. `bun dev`

## Implementation Details

### Guest Chat (`ENABLE_GUEST_CHAT`)
- If `ENABLE_AUTH=true` and `ENABLE_GUEST_CHAT` is not `true`, the API will return `401 Unauthorized` for non-logged-in users.
- Guest sessions are ephemeral and do not persist in the database.

### Cloud Mode (`VANA_CLOUD_DEPLOYMENT`)
- Enabling this mode locally requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to be configured, or the app will fail to initialize rate limiting and search caching.
