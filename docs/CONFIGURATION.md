# Configuration Guide

This guide covers application configuration for Vana v2, including required startup variables and optional capabilities.

## Required Day-1 Configuration

Vana v2 requires the following environment variables to run:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
DATABASE_SSL_DISABLED=true
AI_GATEWAY_API_KEY=[YOUR_VERCEL_GATEWAY_KEY]
TAVILY_API_KEY=[YOUR_TAVILY_API_KEY]
```

These defaults are optimized for a fast local bootstrap with Vercel AI Gateway + Tavily.

## Authentication Modes

### Supabase Authentication (Recommended)

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[YOUR_SUPABASE_PROJECT_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
```

### Anonymous Mode (Local Development Only)

```bash
ENABLE_AUTH=false
ANONYMOUS_USER_ID=anonymous-user
```

## Search Providers

### Primary optimized provider (required)

- **Tavily** (default)
- Alternative: Exa or Firecrawl

### Optional general/multimedia provider

```bash
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_API_KEY]
```

When Brave is omitted, general searches fall back to your configured optimized provider.

## AI Provider Options

Default model config ships with Vercel AI Gateway. Direct providers are also supported:

- OpenAI (`OPENAI_API_KEY`)
- Anthropic (`ANTHROPIC_API_KEY`)
- Google (`GOOGLE_GENERATIVE_AI_API_KEY`)
- Ollama (`OLLAMA_BASE_URL`)

If you change providers, ensure model IDs in `config/models/*.json` are compatible.

## Cloud Deployment Controls

For managed cloud mode, enable:

```bash
VANA_CLOUD_DEPLOYMENT=true
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

## Optional Features

- Guest chat: `ENABLE_GUEST_CHAT=true`
- Guest daily limit: `GUEST_CHAT_DAILY_LIMIT=10`
- Langfuse tracing: `ENABLE_LANGFUSE_TRACING=true`
- File uploads: `SUPABASE_STORAGE_BUCKET=user-uploads`
- Perf logging: `ENABLE_PERF_LOGGING=true`

For full variable documentation, see `.env.local.example` and `docs/ENVIRONMENT.md`.
