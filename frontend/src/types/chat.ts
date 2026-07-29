export type Role = "user" | "assistant" | "system"

export type ThinkingEffort = "none" | "low" | "medium" | "high" | "xhigh"

export type Model = {
  id: string
  name: string
  desc: string
  inputPrice: string
  outputPrice: string
  context: string
  size: string
  default?: boolean
  // Which thinking_effort levels are actually meaningful/safe for this
  // model — verified live per-model (see AVAILABLE_MODELS in
  // backend/app/schemas/chat.py for the evidence). Not every model exposes
  // all 4 levels: some collapse several levels to a no-op, others make
  // "xhigh" specifically unsafe (unbounded reasoning with no official
  // provider support).
  effortOptions: ThinkingEffort[]
  // Real HuggingFace repo path if this model is open-weight (sourced from
  // OpenRouter's own hugging_face_id field), null if closed/proprietary.
  huggingFaceId: string | null
}

export type ToolStatus = "streaming" | "running" | "done"

export type ToolCall = {
  name: string
  label?: string
  chunkIndex?: number
  argsStr?: string
  input?: unknown
  output?: string
  status: ToolStatus
  run_id?: string
  parent_run_id?: string
  // run_id of the `task` call this tool call happened inside (via a
  // subagent's own tool loop), so the UI can nest it under that badge
  // instead of showing it as an unrelated top-level row.
  task_run_id?: string
}

export type TodoStatus = "pending" | "in_progress" | "completed"

export type Todo = {
  content: string
  status: TodoStatus
}

export type MessagePart =
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }
  | { type: "thinking"; content: string; isStreaming?: boolean }
  // task_run_id set when this belongs to a subagent's own tool loop (nested
  // under that subagent's badge) rather than the main agent's own turn.
  | { type: "viz"; format: "svg"; code: string; title?: string; task_run_id?: string }
  | { type: "todos"; todos: Todo[]; task_run_id?: string }

export type TokenUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export type Message = {
  id: string
  role: Role
  parts: MessagePart[]
  isStreaming: boolean
  // One entry per LLM call within this turn (a turn may call the model
  // multiple times for tool round-trips) — NOT summed, since each call's
  // input_tokens already includes all prior calls' context in this turn.
  usage?: TokenUsage[]
}

export type HitlAction = {
  name: string
  args: Record<string, unknown>
  description: string
}

export type HitlReviewConfig = {
  action_name: string
  allowed_decisions: string[]
}

export type PendingHitl = {
  actions: HitlAction[]
  review_configs: HitlReviewConfig[]
}

export type PendingClarify = {
  question: string
  options?: string[] | null
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "thinking_token"; content: string }
  | { type: "tool_chunk"; index: number; name: string; args_delta: string }
  | { type: "tool_start"; name: string; label?: string; input?: unknown; run_id?: string; task_run_id?: string }
  | { type: "tool_end"; name: string; output: string; run_id?: string; task_run_id?: string }
  | { type: "viz"; format: "svg"; code: string; title?: string; task_run_id?: string }
  | { type: "todo_update"; todos: Todo[]; task_run_id?: string }
  | { type: "hitl_request"; actions: HitlAction[]; review_configs: HitlReviewConfig[] }
  | { type: "clarify_request"; question: string; options?: string[] | null }
  | ({ type: "usage" } & TokenUsage)
  | { type: "done" }
  | { type: "error"; message: string }

export type Conversation = {
  id: string
  title: string
  last_model: string | null
  last_subagent_model: string | null
  created_at: string
  updated_at: string
}
