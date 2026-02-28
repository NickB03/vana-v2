# Vana v2

![CI](https://github.com/NickB03/vana-v2/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1)

Vana v2 is an AI-powered answer engine with a generative UI, built for Vana deployment and operations.

## Overview

- Next.js 16 + React 19 + TypeScript
- Vercel AI SDK-powered chat + tool workflows
- Search provider support (Tavily, Brave)
- PostgreSQL + Drizzle for persisted chat history (via Supabase)
- Supabase Auth, Supabase Storage, and Redis-backed limits

## Tech Stack

| Category  | Technology                            |
| --------- | ------------------------------------- |
| Framework | Next.js 16 (App Router)               |
| Runtime   | Bun                                   |
| Language  | TypeScript (strict mode)              |
| Database  | PostgreSQL via Supabase + Drizzle ORM |
| Auth      | Supabase Auth                         |
| AI        | Vercel AI SDK + AI Gateway            |
| Search    | Tavily (primary), Brave (multimedia)  |
| Styling   | Tailwind CSS v4 + shadcn/ui           |
| Testing   | Vitest                                |

## Architecture

```mermaid
graph TD
    Browser["Browser (React 19)"]
    NextJS["Next.js 16 App Router"]
    API["API Routes (/api/chat)"]
    Agent["Researcher Agent (ToolLoopAgent)"]
    AI["AI Providers (Gateway, OpenAI, Anthropic, Google, Ollama)"]
    Search["Search Providers (Tavily, Brave, Exa, SearXNG, Firecrawl)"]
    DB["Supabase PostgreSQL (Drizzle ORM)"]
    Redis["Upstash Redis (Rate Limiting)"]
    Auth["Supabase Auth"]
    Langfuse["Langfuse (Tracing)"]

    Browser -->|"SSE Stream"| NextJS
    NextJS --> API
    API -->|"Auth Check"| Auth
    API -->|"Guest Rate Limit"| Redis
    API --> Agent
    Agent -->|"LLM Calls"| AI
    Agent -->|"Tool Calls"| Search
    Agent -->|"Persist Results"| DB
    Agent -.->|"Telemetry"| Langfuse
    Auth -->|"Session Cookies"| Browser
```

See [Architecture Documentation](docs/ARCHITECTURE.md) for detailed diagrams.

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

### Getting Started

- [Environment Setup](docs/ENVIRONMENT.md)
- [Configuration Guide](docs/CONFIGURATION.md)

### Architecture

- [System Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Streaming](docs/STREAMING.md)
- [Search Providers](docs/SEARCH-PROVIDERS.md)
- [Model Configuration](docs/MODEL-CONFIGURATION.md)

### Operations

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Docker Guide](docs/DOCKER.md)
- [Runbooks](docs/runbooks/day-2-operations.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

### Contributing

- [Contributing Guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Launch Decisions](docs/DECISIONS.md)
- [Security Policy](SECURITY.md)

## CI/CD Quality Gates

The repository includes GitHub Actions workflows for:

- Lint (`bun lint`)
- Typecheck (`bun typecheck`)
- Format check (`bun format:check`)
- Tests (`bun run test`)
- Build (`bun run build`)

## Attribution

Vana v2 is derived from [miurla/morphic](https://github.com/miurla/morphic) under the Apache-2.0 license. See [LICENSE](LICENSE) for details.
