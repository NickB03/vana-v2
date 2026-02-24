# Vana-v2 (Morphic-Based) Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up `vana-v2` by onboarding the `miurla/morphic` codebase into this repository, then harden it for your own branding, config, deployment, and production controls.

**Architecture:** Use Morphic as the baseline application (Next.js + Vercel AI SDK + optional Supabase/Postgres), then layer Vana-specific naming, environment policy, provider choices, CI/CD, and operational guardrails in controlled phases. Start with a known-good mirror, then incrementally customize.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vercel AI SDK (`ai`), Tailwind/shadcn UI, Drizzle ORM, PostgreSQL, optional Supabase Auth, optional Redis/SearXNG, Docker Compose.

---

## Repository Review Summary (Morphic)

- License: Apache-2.0 (compatible with onboarding + modification; preserve notices)
- Project shape: App Router Next.js monorepo-style single app (not Turborepo)
- Required runtime config: DB URL + AI API key + search API key
- Optional systems: Supabase auth, Redis rate limits, SearXNG, Langfuse, R2 upload
- Local DX: `bun install`, `bun dev`, `bun run migrate`, Docker Compose supported
- Current `vana-v2` state: empty folder (best-case for clean import)

---

## Onboarding Approaches

### Approach A — Direct Fork-Style Bootstrap (Fastest)

- Copy/clone Morphic into `vana-v2`
- Rebrand + adjust env/deployment settings
- Keep architecture mostly intact

**Pros:** Fastest path to running product, lowest migration risk.  
**Cons:** Carries upstream structure/opinions; more cleanup later.

### Approach B — Selective Migration (Balanced) **← Recommended**

- Start from Morphic baseline
- Keep core chat/search pipeline
- Remove/disable non-essential modules early (YAGNI)
- Reorganize naming/config/deployment for Vana from day 1

**Pros:** Good speed + better long-term maintainability.  
**Cons:** Slightly more upfront decision-making.

### Approach C — Reference Rebuild (Slowest, Highest Control)

- Re-implement architecture in fresh codebase, using Morphic only as reference

**Pros:** Cleanest custom architecture.  
**Cons:** Highest timeline/risk; easiest to miss subtle working behavior.

---

## Recommended Strategy

Execute **Approach B** in phases below. It provides a working app quickly while giving you clean control over what `vana-v2` becomes.

---

## Phase Plan

### Phase 0: Decision Lock + Scope Baseline (0.5 day) — **[DONE]**

**Deliverables**

- [x] Written decisions for:
  - Auth mode at launch (`ENABLE_AUTH=true` with Supabase)
  - Search backend priority (Tavily/Brave)
  - Deployment target (Vercel)
  - Must-keep features vs remove-now features

**Validation checkpoint**

- [x] One-page decision note approved before code import (see `docs/DECISIONS.md`).

---

### Phase 1: Bootstrap `vana-v2` from Morphic (0.5 day) — **[DONE]**

**Files/areas**

- [x] Entire codebase import into current repository root
- [x] Preserve: `LICENSE`, attribution, upstream NOTICE references

**Execution steps**

1. [x] Initialize git repo in `vana-v2` (if not initialized).
2. [x] Import Morphic source snapshot.
3. [x] Commit as `chore: bootstrap vana-v2 from morphic upstream`.

**Validation checkpoint**

- [x] `git status` clean, project files present, history starts with bootstrap commit.

---

### Phase 2: Environment + Secret Policy (0.5 day) — **[IN PROGRESS]**

**Files**

- [x] `.env.local.example`
- [x] `docs/CONFIGURATION.md`
- [x] `docs/ENVIRONMENT.md` (Vana-specific secret matrix)

**Execution steps**

1. [x] Rename project-facing environment labels from Morphic -> Vana where needed.
2. [ ] Populate and finalize `.env.local` with real keys:
   - `DATABASE_URL` (Supabase local or cloud)
   - `AI_GATEWAY_API_KEY`
   - `TAVILY_API_KEY`
3. [x] Split vars into required/optional in docs.

**Validation checkpoint**

- [ ] A new engineer can configure `.env.local` in under 10 minutes using docs only.

---

### Phase 3: First Green Run (Local) (0.5 day) — **[IN PROGRESS]**

**Files/areas**

- [x] `package.json` scripts
- [x] `drizzle/*`
- [ ] `docker-compose.yaml` (for local Supabase/Redis)

**Execution steps**

1. [x] Install deps (`bun install`).
2. [ ] Setup database and run migrations (`bun run migrate`).
3. [ ] Run app (`bun dev`) and smoke test:
   - app loads
   - one prompt completes
   - citations/search return results

**Validation checkpoint**

- [ ] Local smoke test checklist passed and recorded.

---

### Phase 4: Rename + Brand Alignment (0.5–1 day)

**Files/areas**

- `README.md`
- `app/layout.tsx`
- `app/page.tsx`
- UI labels in `components/*`
- metadata assets in `public/*`

**Execution steps**

1. Replace visible “Morphic” strings with “Vana”/`vana-v2`.
2. Update logo/title/OG tags.
3. Rewrite README quickstart for Vana defaults.

**Validation checkpoint**

- No Morphic branding in primary UI and docs (except required attribution/legal sections).

---

### Phase 5: Feature Pruning (YAGNI) (1 day)

**Files/areas**

- `components/*`
- `lib/*`
- `hooks/*`
- `docs/*`

**Execution steps**

1. Remove or disable features not needed for MVP (examples: optional provider paths, guest limits, upload, advanced inspector toggles) based on Phase 0 decisions.
2. Keep code paths cohesive; avoid dead flags.
3. Update docs to match real behavior.

**Validation checkpoint**

- `bun run typecheck`, `bun run lint`, `bun run test` all pass with reduced surface area.

---

### Phase 6: CI/CD + Quality Gates (0.5 day)

**Files/areas**

- `.github/workflows/*` (create/update)
- `package.json` scripts

**Execution steps**

1. Add CI jobs for install, lint, typecheck, test, build.
2. Enforce PR checks before merge.
3. Add release/deploy workflow for selected platform.

**Validation checkpoint**

- Fresh PR fails on broken lint/tests and passes on green branch.

---

### Phase 7: Deployment Readiness (0.5–1 day)

**Files/areas**

- `docs/DEPLOYMENT.md` (new)
- `docs/DOCKER.md` (if Docker path)
- platform env configuration (Vercel or container)

**Execution steps**

1. Configure production env vars.
2. Verify auth posture for internet-facing deployment.
3. Add healthcheck + rollback notes.

**Validation checkpoint**

- Staging environment can handle end-to-end chat flow.

---

### Phase 8: Cutover + Operability (0.5 day)

**Files/areas**

- Runbooks: `docs/runbooks/*.md` (new)

**Execution steps**

1. Create day-2 runbook (incident handling, key rotation, provider outage fallback).
2. Add basic telemetry review routine.
3. Tag `v0.1.0-vana`.

**Validation checkpoint**

- Operator can diagnose common failures using docs only.

---

## Risk Register

1. **Provider mismatch risk** (model IDs vs provider keys)
   - Mitigation: lock provider set early; test each configured model on boot.
2. **Auth misconfiguration in production**
   - Mitigation: fail-safe to require explicit `ENABLE_AUTH=true` for public env.
3. **Config drift from upstream Morphic updates**
   - Mitigation: track upstream remote and schedule periodic diff review.
4. **Over-featured MVP**
   - Mitigation: Phase 5 pruning before public launch.

---

## Suggested Milestone Timeline (Business Days)

- Day 1: Phases 0–3 (decision, import, env, first run)
- Day 2: Phases 4–5 (branding + pruning)
- Day 3: Phases 6–8 (CI/CD, staging deploy, runbooks, release tag)

Total: **~3 days** for a solid v1 onboarding baseline.

---

## Definition of Done

- `vana-v2` runs locally and in staging
- Core chat/search flow works with chosen provider set
- Branding/docs reflect Vana identity
- CI gates enforce lint/typecheck/test/build
- Deployment/runbook docs exist and are actionable
