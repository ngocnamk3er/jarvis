"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { ToolCall } from "@/types/chat"

const LANG_MAP: Record<string, string> = {
  code: "python",
  expression: "text",
  query: "sql",
}

function InputBlock({ input }: { input: unknown }) {
  if (input === undefined || input === null) return null
  const entries = Object.entries(input as Record<string, unknown>)
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const str = typeof value === "string" ? value : JSON.stringify(value, null, 2)
        const lang = LANG_MAP[key] ?? "text"
        const isMultiline = str.includes("\n") || str.length > 60

        return (
          <div key={key}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              {key}
            </span>
            {isMultiline ? (
              <div className="rounded-xl overflow-hidden border border-gray-100 text-[12px]">
                <SyntaxHighlighter
                  language={lang}
                  style={oneLight}
                  customStyle={{ margin: 0, padding: "12px 16px", fontSize: "12px", lineHeight: "18px", background: "#FAFAFA", borderRadius: 0 }}
                  wrapLongLines
                >
                  {str}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className="bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 text-[12px] font-mono block">
                {str}
              </code>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OutputBlock({ output }: { output: string }) {
  const text = output?.trim()
  if (!text || text === "(no output)") {
    return (
      <div>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">output</span>
        <span className="text-[12px] text-gray-400 italic">no output</span>
      </div>
    )
  }
  return (
    <div>
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">output</span>
      <pre className="bg-[#F0F4FF] text-gray-700 rounded-xl px-4 py-3 text-[12px] font-mono overflow-x-auto whitespace-pre-wrap leading-[18px] border border-[#E0E7FF]">
        {text}
      </pre>
    </div>
  )
}

function StreamingArgsPreview({ argsStr }: { argsStr: string }) {
  // Try to extract a readable value from partial JSON
  const preview = argsStr.replace(/^\{?"?\w+"?\s*:\s*"?/, "").slice(0, 80)
  return (
    <span className="text-[11px] text-gray-400 font-mono truncate max-w-[240px] inline-flex items-center gap-0.5">
      <span className="opacity-70">{preview}</span>
      <span className="inline-block w-[2px] h-[12px] bg-[#5661f6] animate-pulse rounded-sm align-middle ml-0.5" />
    </span>
  )
}

export function ToolBadge({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false)

  // Streaming args — show tool name + partial args with cursor
  if (tool.status === "streaming") {
    return (
      <div className="flex items-center gap-2 py-1 flex-wrap">
        <Wrench className="size-3 text-[#5661f6] animate-pulse shrink-0" />
        <span className="text-[12px] font-semibold text-gray-600 font-mono">{tool.name}</span>
        <span className="text-[11px] text-gray-400">(</span>
        <StreamingArgsPreview argsStr={tool.argsStr ?? ""} />
        <span className="text-[11px] text-gray-400">)</span>
      </div>
    )
  }

  // Running (args done, tool executing)
  if (tool.status === "running") {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 className="size-3 animate-spin text-[#5661f6]" />
        <span className="text-[12px] font-medium text-gray-500">
          Running <span className="font-semibold text-[#5661f6] font-mono">{tool.name}</span>…
        </span>
      </div>
    )
  }

  // Done — collapsible with input + output
  return (
    <div className="py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      >
        <Wrench className="size-3 text-[#5661f6]" />
        <span className="text-[12px] font-semibold text-gray-600 font-mono">{tool.name}</span>
        {open
          ? <ChevronDown className="size-3 text-gray-400" />
          : <ChevronRight className="size-3 text-gray-400" />
        }
      </button>

      {open && (
        <div className="mt-2.5 ml-1 space-y-3 border-l-2 border-[#E0E7FF] pl-3.5">
          {tool.input !== undefined && <InputBlock input={tool.input} />}
          {tool.output !== undefined && <OutputBlock output={tool.output} />}
        </div>
      )}
    </div>
  )
}
