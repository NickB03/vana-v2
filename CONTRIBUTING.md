# Contributing to Vana v2

Thank you for your interest in contributing to Vana v2! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- **Bun** (v1.2.12+ recommended, see `engines` in `package.json`)
- **Node.js** 18+
- **Docker** (required for Supabase CLI local development)
- **Git**

## How to Contribute

### Reporting Issues

- Check if the issue already exists in this repository's GitHub Issues
- Use the issue templates when creating a new issue
- Provide as much context as possible

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes
4. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```
5. Push to your fork
6. Open a Pull Request

### Commit Convention

We use conventional commits. Examples:

- `feat: add new feature`
- `fix: resolve issue with X`
- `docs: update README`
- `chore: update dependencies`
- `refactor: improve code structure`

### Development Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/NickB03/vana-v2.git
   cd vana-v2
   bun install
   ```

2. Set up environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the full variable reference.

3. Start local Supabase (requires Docker):

   ```bash
   npx supabase start
   ```

   This uses custom ports: DB on 44322, API on 44321, Studio on 44323.

4. Run database migrations:

   ```bash
   bun run migrate
   ```

5. Start the dev server:

   ```bash
   bun dev
   ```

   The app runs on [http://localhost:43100](http://localhost:43100).

For troubleshooting setup issues, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Quality Gate

All of the following checks must pass before submitting a PR:

```bash
bun lint && bun typecheck && bun format:check && bun run test
```

You can fix auto-fixable lint and format issues with:

```bash
bun lint --fix
bun format
```

## Code Style

### Formatting (Prettier)

- No semicolons
- Single quotes
- No trailing commas
- 2-space indentation
- Avoid arrow parens where possible
- LF line endings

### Import Order (ESLint enforced)

Imports are sorted by the `simple-import-sort` ESLint plugin. The required order:

```typescript
// 1. React / Next.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party packages
import { tool } from 'ai'
import { z } from 'zod'

// 3. Internal paths (ordered by depth)
import { SearchResults } from '@/lib/types'
import { getModel } from '@/lib/utils/registry'
import { useChat } from '@/hooks/use-chat'
import { Button } from '@/components/ui/button'
import { SearchSection } from '@/components/search-section'
```

Run `bun lint --fix` to auto-sort imports.

### Path Aliases

Always use `@/` path aliases instead of relative imports:

```typescript
// Correct
import { getModel } from '@/lib/utils/registry'

// Avoid
import { getModel } from '../../../lib/utils/registry'
```

## Testing

- **Framework:** Vitest
- **Test location:** Co-located `__tests__/` directories next to source files
- **Run once:** `bun run test`
- **Watch mode:** `bun run test:watch`

When adding new functionality, include tests where practical. Tests should focus on logic and edge cases rather than implementation details.

## Adding a New Tool

The researcher agent uses tools to perform actions like searching and fetching. To add a new tool:

1. **Create the tool file** in `lib/tools/`:

   ```typescript
   // lib/tools/my-tool.ts
   import { tool } from 'ai'
   import { z } from 'zod'

   export const myTool = tool({
     description: 'Description of what this tool does',
     parameters: z.object({
       input: z.string().describe('Input description')
     }),
     async execute({ input }) {
       // Tool logic here
       return { result: '...' }
     }
   })
   ```

2. **Register the tool** in `lib/agents/researcher.ts` by adding it to the `tools` object and the appropriate `activeToolsList` array for the search mode(s) where it should be available.

3. **Add a UI component** in `components/` if the tool produces visible output in the chat. Map the tool's output to a generative UI section component.

4. **Update the database schema** in `lib/db/schema.ts` if the tool output needs to be persisted as a new message part type (add columns and check constraints to the `parts` table).

## Architecture Reference

For a detailed understanding of the system architecture, data flow, and component relationships, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
