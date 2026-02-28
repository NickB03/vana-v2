import {
  stepCountIs,
  tool,
  ToolLoopAgent,
  type UIMessageStreamWriter
} from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type ModelType } from '@/lib/types/model-type'
import { type Model } from '@/lib/types/models'

import { displayCitationsTool } from '../tools/display-citations'
import { displayLinkPreviewTool } from '../tools/display-link-preview'
import { displayOptionListTool } from '../tools/display-option-list'
import { displayPlanTool } from '../tools/display-plan'
import { displayTableTool } from '../tools/display-table'
import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  ADAPTIVE_MODE_PROMPT,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'

// Enhanced wrapper function with better type safety and streaming support
function wrapSearchToolForQuickMode<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    async *execute(params, context) {
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      // Force optimized type for quick mode
      const modifiedParams = {
        ...params,
        type: 'optimized' as const
      }

      // Execute the original tool and pass through all yielded values
      const result = executeFunc(modifiedParams, context)

      // Handle AsyncIterable (streaming) case
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        // Fallback for non-streaming (shouldn't happen with new implementation)
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

// Enhanced researcher function with improved type safety using ToolLoopAgent
// Note: abortSignal should be passed to agent.stream() or agent.generate() calls, not to the agent constructor
export function createResearcher({
  model,
  modelConfig,
  writer,
  parentTraceId,
  searchMode = 'adaptive',
  modelType
}: {
  model: string
  modelConfig?: Model
  writer?: UIMessageStreamWriter
  parentTraceId?: string
  searchMode?: SearchMode
  modelType?: ModelType
}) {
  try {
    const currentDate = new Date().toLocaleString()

    // Create model-specific tools with proper typing
    const originalSearchTool = createSearchTool(model)
    const askQuestionTool = createQuestionTool(model)
    const todoTools = writer ? createTodoTools() : {}

    let systemPrompt: string
    let activeToolsList: (keyof ResearcherTools)[] = []
    let maxSteps: number
    let searchTool = originalSearchTool

    // Configure based on search mode
    switch (searchMode) {
      case 'quick':
        systemPrompt = QUICK_MODE_PROMPT
        activeToolsList = [
          'search',
          'fetch',
          'displayPlan',
          'displayTable',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList'
        ]
        maxSteps = 20
        searchTool = wrapSearchToolForQuickMode(originalSearchTool)
        console.log(
          `[Researcher] Quick mode: maxSteps=${maxSteps}, tools=[${activeToolsList.join(', ')}]`
        )
        break

      case 'adaptive':
      default:
        systemPrompt = ADAPTIVE_MODE_PROMPT
        activeToolsList = [
          'search',
          'fetch',
          'displayTable',
          'displayCitations',
          'displayLinkPreview',
          'displayOptionList'
        ]
        // Enable todo tools when writer is available
        if (writer && 'todoWrite' in todoTools) {
          activeToolsList.push('todoWrite')
        }
        console.log(
          `[Researcher] Adaptive mode: maxSteps=50, modelType=${modelType}, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = originalSearchTool
        break
    }

    // Build tools object with proper typing
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: askQuestionTool,
      displayPlan: displayPlanTool,
      displayTable: displayTableTool,
      displayCitations: displayCitationsTool,
      displayLinkPreview: displayLinkPreviewTool,
      displayOptionList: displayOptionListTool,
      ...todoTools
    } as ResearcherTools

    // Create ToolLoopAgent with all configuration
    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'research-agent',
        metadata: {
          modelId: model,
          agentType: 'researcher',
          searchMode,
          ...(parentTraceId && {
            langfuseTraceId: parentTraceId,
            langfuseUpdateParent: false
          })
        }
      }
    })

    return agent
  } catch (error) {
    console.error('Error in createResearcher:', error)
    throw error
  }
}

// Helper function to access agent tools
export function getResearcherTools(
  agent: ToolLoopAgent<never, ResearcherTools, never>
): ResearcherTools {
  return agent.tools
}

// Export the legacy function name for backward compatibility
export const researcher = createResearcher
