import { tool } from 'ai'
import { z } from 'zod'

// Todo item schema — only `content` is required; other fields auto-generated
export const todoItemSchema = z.object({
  id: z
    .string()
    .optional()
    .describe('Unique task identifier (auto-generated if omitted)'),
  content: z.string().describe('The task description'),
  status: z
    .enum(['pending', 'in_progress', 'completed'])
    .default('pending')
    .describe('Current status'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .default('medium')
    .describe('Priority level'),
  timestamp: z
    .string()
    .optional()
    .describe('ISO timestamp (auto-generated if omitted)')
})

export type TodoItem = z.infer<typeof todoItemSchema>

// Normalized todo with all fields guaranteed present
type NormalizedTodo = Required<TodoItem>

// Schema for todo write tool
export const todoWriteInputSchema = z.object({
  todos: z
    .array(todoItemSchema)
    .describe('Tasks to create or update (partial updates supported)'),
  progressMessage: z
    .string()
    .optional()
    .describe('A brief message about the current progress')
})

// Normalize a parsed todo item, filling in missing optional fields
function normalizeTodo(todo: TodoItem, index: number): NormalizedTodo {
  return {
    id: todo.id || `todo-${index}-${Date.now()}`,
    content: todo.content,
    status: todo.status ?? 'pending',
    priority: todo.priority ?? 'medium',
    timestamp: todo.timestamp || new Date().toISOString()
  }
}

// Merge incoming todos into existing state by matching on content
function mergeTodos(
  existing: NormalizedTodo[],
  incoming: TodoItem[]
): NormalizedTodo[] {
  if (existing.length === 0) {
    // First call — initialize the list
    return incoming.map((todo, i) => normalizeTodo(todo, i))
  }

  // Build a lookup of existing todos by normalized content
  const existingByContent = new Map<string, NormalizedTodo>()
  for (const todo of existing) {
    existingByContent.set(todo.content.toLowerCase().trim(), todo)
  }

  // Track which existing todos were matched
  const matched = new Set<string>()

  // Process incoming todos — update matched ones, add new ones
  const newTodos: NormalizedTodo[] = []
  for (const incoming_todo of incoming) {
    const key = incoming_todo.content.toLowerCase().trim()
    const existingTodo = existingByContent.get(key)

    if (existingTodo) {
      // Update the existing todo with new status/priority
      matched.add(key)
      existingByContent.set(key, {
        ...existingTodo,
        status: incoming_todo.status ?? existingTodo.status,
        priority: incoming_todo.priority ?? existingTodo.priority
      })
    } else {
      // New todo not in existing list
      newTodos.push(
        normalizeTodo(incoming_todo, existing.length + newTodos.length)
      )
    }
  }

  // Result: all existing todos (with updates applied) + any new todos
  const merged = [...existingByContent.values(), ...newTodos]
  return merged
}

// Create todo tools with session-scoped storage
export function createTodoTools() {
  // Session-scoped todos storage - isolated per tool instance
  let sessionTodos: NormalizedTodo[] = []

  const todoWrite = tool({
    description:
      'Track research progress. Create a task list initially, then send only changed tasks on updates — unchanged tasks are preserved automatically. Returns completedCount and totalCount.\n\nCreate: todoWrite({ todos: [{ content: "Task A" }, { content: "Task B" }], progressMessage: "Plan created" })\nUpdate: todoWrite({ todos: [{ content: "Task A", status: "completed" }], progressMessage: "Task A done" })',
    inputSchema: todoWriteInputSchema,
    execute: async ({ todos, progressMessage }) => {
      // Merge incoming todos into session state
      sessionTodos = mergeTodos(sessionTodos, todos)

      // Calculate progress
      const completedCount = sessionTodos.filter(
        t => t.status === 'completed'
      ).length
      const totalCount = sessionTodos.length

      return {
        success: true,
        message: progressMessage || `Updated ${totalCount} todos`,
        completedCount,
        totalCount,
        todos: sessionTodos
      }
    }
  })

  return { todoWrite }
}
