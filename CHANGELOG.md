# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-28

### Added

- AI-powered answer engine with generative UI
- Researcher agent with quick mode (20 steps) and adaptive mode (50 steps)
- Multi-provider search via Tavily (primary) and Brave (multimedia)
- Web content extraction with fetch tool
- Interactive question and todo/planning tools
- Streaming chat responses via SSE with incremental message parts
- Generative UI components for answers, search results, reasoning, and artifacts
- Model selection with Gemini 3 Flash (speed) and Grok 4.1 Fast Reasoning (quality) via Vercel AI Gateway
- Provider registry supporting gateway, OpenAI, Anthropic, Google, and Ollama
- Drizzle ORM schema with chats, messages, and parts tables with Row-Level Security
- Supabase Auth integration with browser, server, and middleware client patterns
- Guest chat mode with Upstash Redis rate limiting
- Sidebar navigation with chat history management
- Vercel + Supabase deployment configuration with Docker build workflows
- CI pipeline with GitHub Actions for linting, type checking, and builds
- Local development environment setup with Supabase CLI
- Vana branding and UI customization

### Fixed

- CI and Docker build workflow failures including bash shell configuration
- Planning tool usage and display tool rendering
- Type safety improvements for boolean coercion and semantic HTML elements
- Comprehensive type safety, accessibility, validation, and edge case fixes
- Formatting consistency across documentation and components

### Changed

- Custom branding and UI configuration for Vana
- Standardized model configuration on AI Gateway providers
- Updated shadcn/ui components and dependencies
