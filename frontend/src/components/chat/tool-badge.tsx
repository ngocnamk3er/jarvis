"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Download, Loader2, Wrench } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
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

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 bg-[#5661f6] text-white rounded-lg px-3 py-1.5 text-[12px] font-medium hover:bg-[#4550e0] transition-colors no-underline mt-1"
    >
      <Download className="size-3 shrink-0" />
      {children}
    </a>
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
      <div className="bg-[#F0F4FF] rounded-xl px-4 py-3 border border-[#E0E7FF] text-[12px] leading-[18px] text-gray-700
        [&_p]:mb-2 [&_p:last-child]:mb-0
        [&_strong]:font-semibold [&_strong]:text-gray-800
        [&_ul]:pl-4 [&_ul]:my-1 [&_li]:my-0.5
        [&_hr]:border-[#E0E7FF] [&_hr]:my-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) =>
              href?.includes("/api/v1/files/")
                ? <DownloadLink href={href}>{children}</DownloadLink>
                : <a href={href} className="text-[#5661f6] underline break-all" target="_blank" rel="noreferrer">{children}</a>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
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

export function ToolBadge({ tool, autoCollapsed }: { tool: ToolCall; autoCollapsed?: boolean }) {
  const [open, setOpen] = useState(!autoCollapsed)

  useEffect(() => {
    if (autoCollapsed) setOpen(false)
  }, [autoCollapsed])

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

  // Running — show input expanded so user sees what's executing
  if (tool.status === "running") {
    return (
      <div className="py-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Loader2 className="size-3 animate-spin text-[#5661f6]" />
          <span className="text-[12px] font-semibold text-[#5661f6] font-mono">{tool.name}</span>
          <span className="text-[11px] text-gray-400">running…</span>
        </div>
        {tool.input !== undefined && (
          <div className="ml-1 border-l-2 border-[#E0E7FF] pl-3.5">
            <InputBlock input={tool.input} />
          </div>
        )}
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
