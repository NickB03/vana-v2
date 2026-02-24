# Vana v2

Vana v2 is an AI-powered answer engine with a generative UI, based on the Morphic architecture and tailored for Vana deployment and operations.

## Overview

- Next.js 16 + React 19 + TypeScript
- Vercel AI SDK-powered chat + tool workflows
- Search provider support (Tavily, Brave)
- PostgreSQL + Drizzle for persisted chat history (via Supabase)
- Supabase Auth, Supabase Storage, and Redis-backed limits

## Quickstart

1. Install dependencies:

```bash
bun install
```

2. Configure environment variables:

```bash
cp .env.local.example .env.local
```

3. Set minimum required variables in `.env.local`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
AI_GATEWAY_API_KEY=your_vercel_gateway_key
TAVILY_API_KEY=your_tavily_key
```

4. Run database migrations:

```bash
bun run migrate
```

5. Start the app:

```bash
bun dev
```

Open http://localhost:43100.

## Documentation

- [Launch decisions](docs/DECISIONS.md)
- [Environment setup](docs/ENVIRONMENT.md)
- [Configuration guide](docs/CONFIGURATION.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Docker guide](docs/DOCKER.md)
- [Runbooks](docs/runbooks/day-2-operations.md)

## CI/CD Quality Gates

The repository includes GitHub Actions workflows for:

- Lint (`bun lint`)
- Typecheck (`bun typecheck`)
- Format check (`bun format:check`)
- Tests (`bun run test`)
- Build (`bun run build`)

## Attribution

Vana v2 is derived from [miurla/morphic](https://github.com/miurla/morphic) under the Apache-2.0 license. See [LICENSE](LICENSE) for details.
