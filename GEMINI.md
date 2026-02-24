# GEMINI.md - Vana v2 Project Context

## Project Overview
Vana v2 is an AI-powered answer engine with a generative UI, based on the Morphic architecture. It provides a sophisticated chat interface that can perform multi-step research, execute tools, and generate comprehensive answers with citations.

### Core Technologies
- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Runtime:** Bun
- **AI Orchestration:** Vercel AI SDK (specifically `ToolLoopAgent`)
- **Database:** PostgreSQL (via Supabase) with Drizzle ORM
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Caching/Rate Limiting:** Upstash Redis
- **Search:** Tavily (Primary), Brave (Multimedia)
- **AI Providers:** Google (Gemini 3 Flash), xAI (Grok 4.1 Fast Reasoning) via Vercel AI Gateway

## Architectural Patterns
- **Agents:** Located in `lib/agents/`. The `researcher.ts` uses `ToolLoopAgent` to orchestrate multi-step tool calls. It supports "Quick" and "Adaptive" modes.
- **Tools:** Located in `lib/tools/`. Core tools include `search`, `fetch`, `askQuestion`, and `todo`.
- **Database Schema:** Defined in `drizzle/schema.ts`.
  - `chats`: Stores chat metadata.
  - `messages`: Stores individual messages in a chat.
  - `parts`: Stores message parts (text, reasoning, tool calls, tool results, files, sources). This supports complex streaming and state management.
- **Generative UI:** Components in `components/` handle various message part types (e.g., `search-section.tsx`, `reasoning-section.tsx`, `answer-section.tsx`).

## Building and Running
- **Install Dependencies:** `bun install`
- **Development Server:** `bun dev` (runs on http://localhost:43100)
- **Local Database (Supabase):** `npx supabase start` (DB: 44322, API: 44321, Studio: 44323)
- **Build:** `bun run build`
- **Database Migrations:** `bun run migrate` (runs `lib/db/migrate.ts`)
- **CLI Chat:** `bun run chat` (runs `scripts/chat-cli.ts`)
- **Testing:** `bun run test` (Vitest)

## Development Conventions
- **Tool Creation:** New tools should be added to `lib/tools/` and integrated into `lib/agents/researcher.ts`.
- **Database Changes:** Modify `drizzle/schema.ts` and run appropriate migration scripts (managed via Drizzle Kit).
- **Environment Variables:** Managed in `.env.local`. See `.env.local.example` for required keys.
- **Linting/Formatting:** ESLint and Prettier are used. Run `bun lint` or `bun format`.
- **Type Safety:** Strict TypeScript usage is encouraged. Run `bun typecheck`.

## Key Files
- `app/api/chat/route.ts`: Main entry point for AI chat interactions.
- `lib/agents/researcher.ts`: Core research logic using `ToolLoopAgent`.
- `lib/tools/search.ts`: Integration with Tavily and Brave.
- `drizzle/schema.ts`: Database schema definition.
- `next.config.mjs`: Next.js configuration (port 43100 by default).
- `docs/DECISIONS.md`: Records architectural decisions for Phase 0.
