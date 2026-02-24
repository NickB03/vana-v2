# Docker Guide

This guide covers running Vana v2 with Docker for local development and self-hosted deployments.

## Quick Start (Docker Compose)

1. Prepare environment variables:

```bash
cp .env.local.example .env.local
```

2. Start your backend infrastructure (Supabase CLI):

```bash
supabase start
```

3. Edit `.env.local` and set at least:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
AI_GATEWAY_API_KEY=your_vercel_gateway_key
TAVILY_API_KEY=your_tavily_key
```

4. Start services:

```bash
docker compose up -d
```

5. Open the app at `http://localhost:43100`.

### What starts in Docker Compose

- `vana` app container
- Redis (used for caching and rate limiting)

**Note:** PostgreSQL, Authentication, and Storage are managed by the Supabase CLI (or Supabase Cloud in production).

## Authentication posture in Docker

By default, the app runs with:

```bash
ENABLE_AUTH=true
```

Ensure you have configured your Supabase project URL and keys in `.env.local`.

## Useful commands

```bash
# Start in background
docker compose up -d

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Follow app logs
docker compose logs -f vana

# Rebuild app image
docker compose build vana
```
