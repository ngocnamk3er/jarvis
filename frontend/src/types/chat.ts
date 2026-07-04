export type Role = "user" | "assistant"

export type ThinkingEffort = "low" | "medium" | "high" | "xhigh"

export type Model = {
  id: string
  name: string
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
}

export type MessagePart =
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }
  | { type: "thinking"; content: string; isStreaming?: boolean }
  | { type: "viz"; format: "mermaid" | "svg" | "html" | "webapp"; code: string; title?: string }

export type Message = {
  id: string
  role: Role
  parts: MessagePart[]
  isStreaming: boolean
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
  | { type: "tool_start"; name: string; label?: string; input?: unknown; run_id?: string }
  | { type: "tool_end"; name: string; output: string; run_id?: string }
  | { type: "viz"; format: "mermaid" | "svg" | "html" | "webapp"; code: string; title?: string }
  | { type: "hitl_request"; actions: HitlAction[]; review_configs: HitlReviewConfig[] }
  | { type: "done" }
  | { type: "error"; message: string }

export type Conversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
}
