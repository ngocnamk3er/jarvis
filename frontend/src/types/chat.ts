export type Role = "user" | "assistant"

export type ToolStatus = "streaming" | "running" | "done"

export type ToolCall = {
  name: string
  argsStr?: string    // accumulated raw args string while streaming
  input?: unknown     // parsed input once tool_start fires
  output?: string
  status: ToolStatus
}

export type MessagePart =
  | { type: "text"; content: string }
  | { type: "tool"; tool: ToolCall }

export type Message = {
  id: string
  role: Role
  parts: MessagePart[]
  isStreaming: boolean
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_chunk"; index: number; name: string; args_delta: string }
  | { type: "tool_start"; name: string; input?: unknown }
  | { type: "tool_end"; name: string; output: string }
  | { type: "done" }
  | { type: "error"; message: string }
