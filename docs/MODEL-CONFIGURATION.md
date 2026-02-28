# Model Configuration

This document explains how Vana v2 selects AI models for the researcher agent pipeline. It covers the configuration file format, the selection algorithm, provider registry, and how to add new models or providers.

## Table of Contents

- [Overview](#overview)
- [Config File Structure](#config-file-structure)
- [Configuration Profiles](#configuration-profiles)
- [Model Selection Algorithm](#model-selection-algorithm)
- [Provider Registry](#provider-registry)
- [Default Models](#default-models)
- [How to Change Models](#how-to-change-models)
- [How to Add a New Provider](#how-to-add-a-new-provider)

---

## Overview

Model selection sits between the chat API route (`app/api/chat/route.ts`) and the researcher agent (`lib/agents/researcher.ts`). When a user sends a message, the system determines which language model to use based on two dimensions:

- **Search mode** (`quick` or `adaptive`) — controls the agent's tool budget and research depth
- **Model type** (`speed` or `quality`) — controls the cost/capability trade-off

The resolved model is passed to the researcher agent, which uses it for all LLM calls during the tool loop. The selection logic lives in `lib/utils/model-selection.ts` and reads configuration from JSON files in `config/models/`.

```
User preferences (cookies)
        |
        v
  selectModel()  -->  config/models/{default,cloud}.json
        |                       |
        v                       v
  isProviderEnabled()     getModelForModeAndType()
        |
        v
  lib/utils/registry.ts  (provider availability)
        |
        v
  Resolved Model  -->  Researcher Agent
```

---

## Config File Structure

Model configurations live in `config/models/` as JSON files. Each file follows the `ModelsConfig` schema:

```jsonc
{
  "version": 1,
  "models": {
    "byMode": {
      "quick": {
        "speed": {
          /* Model */
        },
        "quality": {
          /* Model */
        }
      },
      "adaptive": {
        "speed": {
          /* Model */
        },
        "quality": {
          /* Model */
        }
      }
    },
    "relatedQuestions": {
      /* Model */
    }
  }
}
```

### Model Object

Each model entry has the following fields:

| Field             | Type      | Description                                                               |
| ----------------- | --------- | ------------------------------------------------------------------------- |
| `id`              | `string`  | Model identifier passed to the provider (e.g., `google/gemini-3-flash`)   |
| `name`            | `string`  | Human-readable display name                                               |
| `provider`        | `string`  | Provider company name (e.g., `Google`, `xAI`)                             |
| `providerId`      | `string`  | Registry key for the AI provider (e.g., `gateway`, `openai`, `anthropic`) |
| `providerOptions` | `object?` | Optional provider-specific options passed to the model                    |

### Dimensions

The config maps two dimensions to a model:

- **Search Mode** (`quick` | `adaptive`): Controls the agent's research strategy
- **Model Type** (`speed` | `quality`): Controls the model's capability tier

This creates a 2x2 matrix of possible model assignments. A separate `relatedQuestions` model handles post-response question generation.

**Source:** `lib/types/models.ts` (Model interface), `lib/types/model-type.ts` (ModelType), `lib/types/search.ts` (SearchMode)

---

## Configuration Profiles

Two profiles exist, selected by the `VANA_CLOUD_DEPLOYMENT` environment variable:

| Profile   | File                         | Selected When                                                   |
| --------- | ---------------------------- | --------------------------------------------------------------- |
| `default` | `config/models/default.json` | Default (self-hosted)                                           |
| `cloud`   | `config/models/cloud.json`   | `VANA_CLOUD_DEPLOYMENT=true` |

The config loader at `lib/config/load-models-config.ts`:

1. Determines the active profile from environment variables
2. Loads the corresponding JSON file (statically imported at build time)
3. Validates the structure against the `ModelsConfig` schema (all modes and types must be present)
4. Caches the result (invalidated when the profile changes)

The loader provides both async (`loadModelsConfig`) and sync (`getModelsConfig`) access patterns.

---

## Model Selection Algorithm

Model selection happens in `selectModel()` at `lib/utils/model-selection.ts`. The algorithm reads user preferences from cookies and resolves a model through a priority cascade with fallbacks.

> For a visual flowchart, see the [Model Selection Flow diagram in ARCHITECTURE.md](./ARCHITECTURE.md#model-selection-flow).

### Inputs

| Input        | Source                | Description                                                      |
| ------------ | --------------------- | ---------------------------------------------------------------- |
| `searchMode` | Cookie (`searchMode`) | `quick` or `adaptive`. Defaults to `quick` if missing or invalid |
| `modelType`  | Cookie (`modelType`)  | `speed` or `quality`. Determines preference order                |

### Step-by-step process

1. **Read user preference** — The `modelType` cookie is read. If the value is valid (`speed` or `quality`), it becomes the first choice in the type preference order.

2. **Force speed for guests/cloud** — Before `selectModel` is called, `app/api/chat/route.ts` checks if the user is a guest or on a cloud deployment. If so, it overrides the cookie store to always return `modelType=speed`:

   ```typescript
   const forceSpeed = isGuest || isCloudDeployment
   ```

3. **Build type preference order** — Starting with the user's preferred type, then appending the remaining valid type. For example, if the cookie says `quality`, the order is `[quality, speed]`. If no valid cookie, the order is `[speed, quality]`.

4. **Build mode preference order** — Starting with the requested search mode, then appending remaining modes. For example, if the requested mode is `adaptive`, the order is `[adaptive, quick]`.

5. **Nested candidate loop** — For each candidate mode, for each candidate type:
   - Look up the model from the config via `getModelForModeAndType(mode, type)`
   - Check if the model's provider is enabled via `isProviderEnabled(providerId)`
   - If both succeed, return that model immediately

6. **Fallback** — If no candidate succeeds (all providers disabled, or config loading fails), return the hardcoded `DEFAULT_MODEL` (Gemini 3 Flash via Gateway).

### Full resolution order

For a request with `searchMode=quick` and `modelType=quality`, the candidates are tried in this order:

1. `quick` + `quality` (requested combination)
2. `quick` + `speed` (fallback type)
3. `adaptive` + `quality` (fallback mode)
4. `adaptive` + `speed` (fallback mode + type)
5. `DEFAULT_MODEL` (hardcoded Gemini 3 Flash)

### Example scenarios

**Default local development** — User has `modelType=speed`, `searchMode=quick`. Lookup finds `quick/speed` -> `google/gemini-3-flash` via `gateway`. `AI_GATEWAY_API_KEY` is set, so the provider is enabled. Result: Gemini 3 Flash.

**Quality preference** — User has `modelType=quality`, `searchMode=quick`. Lookup finds `quick/quality` -> `xai/grok-4.1-fast-reasoning` via `gateway`. Provider is enabled. Result: Grok 4.1 Fast Reasoning.

**Provider unavailable** — User has `modelType=quality` but no API keys are set. All four config candidates fail `isProviderEnabled()`. The hardcoded `DEFAULT_MODEL` is returned as a last resort (even though its provider may also be unavailable).

---

## Provider Registry

The provider registry at `lib/utils/registry.ts` wraps multiple AI SDK providers into a unified `createProviderRegistry`:

| Provider ID         | SDK                       | Environment Variable                                           | Purpose                                                  |
| ------------------- | ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `gateway`           | `@ai-sdk/gateway`         | `AI_GATEWAY_API_KEY`                                           | Vercel AI Gateway (primary, routes to multiple backends) |
| `openai`            | `@ai-sdk/openai`          | `OPENAI_API_KEY`                                               | OpenAI direct access                                     |
| `anthropic`         | `@ai-sdk/anthropic`       | `ANTHROPIC_API_KEY`                                            | Anthropic direct access                                  |
| `google`            | `@ai-sdk/google`          | `GOOGLE_GENERATIVE_AI_API_KEY`                                 | Google AI direct access                                  |
| `openai-compatible` | `@ai-sdk/openai` (custom) | `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` | Any OpenAI-compatible API                                |
| `ollama`            | `ollama-ai-provider-v2`   | `OLLAMA_BASE_URL`                                              | Local Ollama models (only registered when URL is set)    |

The `getModel(modelString)` function takes a `providerId:modelId` string and returns a `LanguageModel` from the registry.

---

## Default Models

The current default configuration (`config/models/default.json`):

| Mode              | Type    | Model                   | Provider |
| ----------------- | ------- | ----------------------- | -------- |
| Quick             | Speed   | Gemini 3 Flash          | Gateway  |
| Quick             | Quality | Grok 4.1 Fast Reasoning | Gateway  |
| Adaptive          | Speed   | Gemini 3 Flash          | Gateway  |
| Adaptive          | Quality | Grok 4.1 Fast Reasoning | Gateway  |
| Related Questions | -       | Gemini 3 Flash          | Gateway  |

The hardcoded `DEFAULT_MODEL` fallback (used when all config models fail):

```typescript
const DEFAULT_MODEL: Model = {
  id: 'google/gemini-3-flash',
  name: 'Gemini 3 Flash',
  provider: 'Google',
  providerId: 'gateway'
}
```

---

## How to Change Models

### Using the Gateway Provider

If you use the Vercel AI Gateway (`providerId: "gateway"`), the model `id` follows the format `vendor/model-name`. Simply change the `id` in the config file:

```json
{
  "id": "anthropic/claude-sonnet-4-5",
  "name": "Claude Sonnet 4.5",
  "provider": "Anthropic",
  "providerId": "gateway"
}
```

### Using a Direct Provider

To use a provider directly (bypassing the Gateway), set the `providerId` to the provider key and use the provider's native model ID:

```json
{
  "id": "claude-sonnet-4-5-20250514",
  "name": "Claude Sonnet 4.5",
  "provider": "Anthropic",
  "providerId": "anthropic"
}
```

Make sure the corresponding API key is set in your environment. See [docs/ENVIRONMENT.md](./ENVIRONMENT.md) for the full list of provider variables.

### Testing

After changing a model, verify it works in both search modes:

1. Set the `modelType` cookie to match your config entry (`speed` or `quality`)
2. Set the `searchMode` cookie to `quick`, send a message, and check the server logs for the expected model ID
3. Repeat with `searchMode=adaptive`
4. If targeting `cloud.json`, test with `VANA_CLOUD_DEPLOYMENT=true`

### Adding Provider Options

Some models accept provider-specific options (e.g., reasoning effort, temperature). Add them via `providerOptions`:

```json
{
  "id": "openai/o3-mini",
  "name": "o3 mini",
  "provider": "OpenAI",
  "providerId": "gateway",
  "providerOptions": {
    "openai": {
      "reasoningEffort": "medium"
    }
  }
}
```

---

## How to Add a New Provider

### 1. Install the SDK

```bash
bun add @ai-sdk/your-provider
```

### 2. Register the Provider

Update `lib/utils/registry.ts`:

```typescript
import { yourProvider } from '@ai-sdk/your-provider'

const providers: Record<string, any> = {
  // ...existing providers
  'your-provider': yourProvider
}
```

### 3. Add Enablement Check

Update `isProviderEnabled()` in the same file:

```typescript
case 'your-provider':
  return !!process.env.YOUR_PROVIDER_API_KEY
```

### 4. Configure a Model

Add the model to your config JSON:

```json
{
  "id": "your-model-id",
  "name": "Your Model Name",
  "provider": "Your Provider",
  "providerId": "your-provider"
}
```

### 5. Set Environment Variable

```
YOUR_PROVIDER_API_KEY=...
```

### 6. Update Environment Documentation

Add the new API key variable to [docs/ENVIRONMENT.md](./ENVIRONMENT.md) under the **AI provider options** section.

### 7. Test

1. Set the API key in `.env.local`
2. Verify `isProviderEnabled('your-provider')` returns `true` (check server logs for warnings)
3. Update a config entry to use the new provider
4. Send a chat message and confirm the correct model is used in both `quick` and `adaptive` search modes

The model selection algorithm will automatically include models from the new provider as long as `isProviderEnabled()` returns `true`.
