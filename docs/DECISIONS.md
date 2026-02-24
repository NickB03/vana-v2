# Vana v2 Launch Decisions

Date: 2026-02-23

This document captures the Phase 0 onboarding decisions for Vana v2.

## 1) Authentication and Backend

- **Provider**: Supabase
- **Local Dev**: Supabase CLI (Docker-based local backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication mode**: `ENABLE_AUTH=true` by default for all environments

Rationale:

- Fast local onboarding using `supabase start`
- Unified identity and data platform
- Type-safe schema management via Drizzle

## 2) Search and Content Extraction

- **Primary Search**: Tavily (`TAVILY_API_KEY`)
- **Multimedia Search**: Brave (`BRAVE_SEARCH_API_KEY`)
- **Extraction**: Tavily Extract (default)

Rationale:

- Standardized on high-quality API providers for cloud portability
- Removed self-hosted SearXNG to reduce infrastructure overhead

## 3) AI Model Orchestration

- **Primary Interface**: Vercel AI Gateway (`AI_GATEWAY_API_KEY`)
- **Default Models**: Gemini 3 Flash (Speed), Grok 4.1 Fast Reasoning (Quality)

Rationale:

- AI Gateway provides unified observability, caching, and failover
- Flexible multi-provider support without modifying application code

## 4) Storage Strategy

- **Provider**: Supabase Storage
- **Bucket**: `user-uploads` (Public/RLS-protected)

Rationale:

- Consolidates infrastructure by removing legacy Cloudflare R2
- Leverages existing Supabase Auth for file access control (RLS)

## 5) Deployment Target

- **Primary**: Vercel
- **Secondary**: Docker (containerized app + local Redis)

Rationale:

- Vercel is the optimal path for Next.js 16 and App Router performance
- Docker ensures portability for self-hosting scenarios
