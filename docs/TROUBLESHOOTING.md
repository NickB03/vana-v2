# Troubleshooting

Common issues and solutions for Vana v2 development and deployment.

## Setup Issues

### Missing `.env.local`

**Symptoms:** App fails to start with errors about undefined environment variables, or crashes immediately on `bun dev`.

**Fix:**

```bash
cp .env.local.example .env.local
```

Then fill in the required values. See [docs/ENVIRONMENT.md](./ENVIRONMENT.md) for the full variable reference. At minimum you need:

- `DATABASE_URL`
- `AI_GATEWAY_API_KEY`
- `TAVILY_API_KEY`

### Port Conflicts

**Symptoms:** `npx supabase start` fails, or Supabase services are unreachable.

This project uses a **custom port range (4432x)** to avoid conflicts with other Supabase projects:

| Service  | Port  |
| -------- | ----- |
| Database | 44322 |
| API      | 44321 |
| Studio   | 44323 |

Check if ports are in use:

```bash
lsof -i :44321 -i :44322 -i :44323
```

If another Supabase project is running, stop it first:

```bash
npx supabase stop
```

### `DATABASE_SSL_DISABLED` Not Set

**Symptoms:** Database connections fail with SSL-related errors when using local Supabase CLI. You may see errors like `error: connection requires a valid client certificate` or `ECONNREFUSED`.

**Fix:** Add to `.env.local`:

```
DATABASE_SSL_DISABLED=true
```

This is required for local development with Supabase CLI because the local PostgreSQL instance does not use SSL. Do **not** set this in production.

### "Provider not enabled" Error

**Symptoms:** HTTP 404 response from `/api/chat` with body `Selected provider is not enabled <providerId>`.

This happens when the selected AI model's provider has no API key configured. The `isProviderEnabled()` function in `lib/utils/registry.ts` checks for the appropriate key:

| Provider            | Required Variable                                              |
| ------------------- | -------------------------------------------------------------- |
| `gateway`           | `AI_GATEWAY_API_KEY`                                           |
| `openai`            | `OPENAI_API_KEY`                                               |
| `anthropic`         | `ANTHROPIC_API_KEY`                                            |
| `google`            | `GOOGLE_GENERATIVE_AI_API_KEY`                                 |
| `ollama`            | `OLLAMA_BASE_URL`                                              |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` |

**Fix:** Set the API key for the provider you want to use in `.env.local`. The default provider is `gateway`, which requires `AI_GATEWAY_API_KEY`.

## Runtime Issues

### 401 Unauthorized on `/api/chat`

**Symptoms:** Chat requests return `401 Unauthorized` with body `Authentication required`.

**Causes:**

1. **Auth enabled but Supabase not configured.** If `ENABLE_AUTH` is not set to `false` (it defaults to `true`), then `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set.

2. **Expired or missing session.** The user's Supabase session has expired. The middleware refreshes sessions automatically, but if Supabase is unreachable, authentication silently fails.

3. **Guest chat not enabled.** If the user is not logged in and `ENABLE_GUEST_CHAT` is not `true`, the API returns 401.

**Fix for local dev without auth:**

```
ENABLE_AUTH=false
```

This uses a shared anonymous user ID. Not allowed in cloud deployments.

### 403 Forbidden on Share Page

**Symptoms:** Accessing `/share/<chatId>` returns 403 or shows no data.

**Causes:**

1. The chat has not been set to `public`. Only chats with `visibility = 'public'` are accessible via the share URL.
2. RLS policy mismatch. The database Row-Level Security policies allow public reads only for chats marked as public.

**Fix:** Ensure the chat visibility has been toggled to public by its owner.

### `getUser` Timeout

**Symptoms:** Pages load slowly or fail intermittently. Console shows `[proxy] getUser failed: Error: getUser timeout`.

The middleware (`lib/supabase/middleware.ts`) wraps `supabase.auth.getUser()` in a 5-second timeout via `Promise.race`. If Supabase is slow or unreachable, the timeout fires and the user is treated as unauthenticated.

**Causes:**

- Local Supabase is not running (`npx supabase start`)
- Network issue reaching the Supabase URL
- `NEXT_PUBLIC_SUPABASE_URL` points to a wrong or unreachable host

**Fix:** Verify Supabase is running and the URL is correct:

```bash
npx supabase status
curl http://127.0.0.1:44321/rest/v1/ -H "apikey: <your-anon-key>"
```

### Rate Limit Exceeded

**Symptoms:** Guest users see `Please sign in to continue.` (401). Authenticated users see `Daily chat limit reached. Please try again tomorrow.` (429).

**Guest limits:** Default is 10 chats per day per IP. Configurable via `GUEST_CHAT_DAILY_LIMIT`. Only enforced in cloud deployments (`VANA_CLOUD_DEPLOYMENT=true`) with Upstash Redis configured.

**Authenticated user limits:** Default is 100 chats per day. Only enforced in cloud deployments.

Rate limit data is stored in Upstash Redis with keys:

- Guest: `rl:guest:chat:<ip>:<date>`
- Authenticated: `rl:chat:<userId>:<date>`

Limits reset at midnight UTC.

**Fix for local dev:** Rate limits are not enforced unless `VANA_CLOUD_DEPLOYMENT=true`. If testing rate limits locally, ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.

## Build Issues

### ESLint Import Order Errors

**Symptoms:** ESLint reports errors like `Run autofix to sort these imports!` from the `simple-import-sort` plugin.

The project enforces a strict import order:

1. `react`, `next`
2. Third-party packages (`@?\\w`)
3. Internal paths in order: `@/types` > `@/config` > `@/lib` > `@/hooks` > `@/components/ui` > `@/components` > `@/registry` > `@/styles` > `@/app`
4. Side effects, parent imports, relative imports, styles

**Fix:**

```bash
bun lint --fix
```

### Prettier Formatting Failures

**Symptoms:** CI or `bun format:check` fails with formatting differences.

The project uses these Prettier rules:

- No semicolons
- Single quotes
- No trailing commas
- 2-space indentation
- Avoid arrow parens where possible
- LF line endings

**Fix:**

```bash
bun format
```

### TypeScript Strict Mode Errors

**Symptoms:** `bun typecheck` fails with errors about possibly `null` or `undefined` values.

TypeScript strict mode is enabled. Common patterns:

```typescript
// Wrong: object might be null
const name = user.name

// Correct: null check first
const name = user?.name ?? 'default'
```

**Fix:** Add proper null checks, use optional chaining (`?.`), and nullish coalescing (`??`). Avoid type assertions (`as`) unless absolutely necessary.

## Search Issues

### Tavily API Errors

**Symptoms:** Search tool fails with 401 or 403 errors. Console shows `Search API error:`.

**Causes:**

- `TAVILY_API_KEY` is missing or invalid
- API rate limit exceeded on Tavily's end

**Fix:** Verify your Tavily key at [tavily.com](https://tavily.com). Check that `TAVILY_API_KEY` is set correctly in `.env.local`.

### `SEARXNG_API_URL` Not Set

**Symptoms:** Advanced search requests fail. Only relevant if you are using SearXNG as a search provider.

The `SEARXNG_API_URL` variable is required only when `SEARCH_API=searxng` or when advanced search depth is configured via `SEARXNG_DEFAULT_DEPTH=advanced`. It is not needed for the default Tavily provider.

**Fix:** If not using SearXNG, this can be ignored. If using SearXNG, set:

```
SEARXNG_API_URL=http://localhost:8888
SEARCH_API=searxng
```

### No Search Results

**Symptoms:** Searches return empty results. The chat shows no sources.

**Causes:**

1. **Missing search API key.** `TAVILY_API_KEY` is the primary key for the default provider.
2. **Wrong `SEARCH_API` value.** If set to a provider that is not configured, searches will fail. Valid values: `tavily` (default), `exa`, `firecrawl`, `searxng`, `brave`.
3. **Provider fallback.** If the primary provider fails, there is no automatic fallback. The error is thrown to the AI agent, which may retry or report the failure.

**Fix:** Check that `TAVILY_API_KEY` is set. If using an alternative provider, ensure the corresponding API key and `SEARCH_API` variable are correctly configured. See [docs/SEARCH-PROVIDERS.md](./SEARCH-PROVIDERS.md) for provider setup details.

## Database Issues

### Migration Failures

**Symptoms:** `bun run migrate` fails with connection errors or SQL errors.

**Causes:**

- `DATABASE_URL` is wrong or missing
- Local Supabase is not running
- `DATABASE_SSL_DISABLED=true` is not set for local dev
- Port mismatch (should be 44322 for local Supabase)

**Fix:**

```bash
# Ensure Supabase is running
npx supabase start

# Verify connection string
echo $DATABASE_URL
# Should be: postgresql://postgres:postgres@localhost:44322/postgres

# Ensure SSL is disabled for local
# In .env.local:
# DATABASE_SSL_DISABLED=true

# Run migration
bun run migrate
```

### RLS Policy Errors

**Symptoms:** Queries return empty results or permission denied errors, even though data exists in the database.

The database uses Row-Level Security (RLS) with `current_setting('app.current_user_id')` to scope data access. Each query must set the user ID in the PostgreSQL session before executing.

**Causes:**

- The `app.current_user_id` setting is not being set before queries
- The user ID does not match the data owner
- For public/shared resources, the RLS policy for public visibility is not matching

**Fix:** If debugging locally, check that the server-side database client sets the user context. You can verify RLS policies in Supabase Studio at `http://localhost:44323`.

## Getting More Help

- Check the [Environment Reference](./ENVIRONMENT.md) for all configuration options
- Review the [Architecture Guide](./ARCHITECTURE.md) for system understanding
- Open an issue on GitHub with reproduction steps
