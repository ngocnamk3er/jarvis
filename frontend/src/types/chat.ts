export type Role = "user" | "assistant" | "system"

export type ThinkingEffort = "low" | "medium" | "high" | "xhigh"

export type Model = {
  id: string
  name: string
  desc: string
  inputPrice: string
  outputPrice: string
  context: string
  default?: boolean
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

export type MessagePart =
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }
  | { type: "thinking"; content: string; isStreaming?: boolean }
  | { type: "viz"; format: "svg"; code: string; title?: string }

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

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "thinking_token"; content: string }
  | { type: "tool_chunk"; index: number; name: string; args_delta: string }
  | { type: "tool_start"; name: string; label?: string; input?: unknown; run_id?: string; task_run_id?: string }
  | { type: "tool_end"; name: string; output: string; run_id?: string; task_run_id?: string }
  | { type: "viz"; format: "svg"; code: string; title?: string }
  | { type: "hitl_request"; actions: HitlAction[]; review_configs: HitlReviewConfig[] }
  | ({ type: "usage" } & TokenUsage)
  | { type: "done" }
  | { type: "error"; message: string }

export type Conversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
}
