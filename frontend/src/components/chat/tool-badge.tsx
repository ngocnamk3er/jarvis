"use client"

import { useState, useEffect } from "react"
import {
  ChevronDown, ChevronRight, Download, Loader2,
  Terminal, FileDown, Globe, Hash, Clock, Wrench, Layers,
} from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ToolCall } from "@/types/chat"
import type { LucideIcon } from "lucide-react"

// ── Per-tool display metadata ──────────────────────────────────────────────
type ToolMeta = { label: string; Icon: LucideIcon }

const TOOL_META: Record<string, ToolMeta> = {
  bash:             { label: "Running command",    Icon: Terminal  },
  represent_file:   { label: "Exporting file",     Icon: FileDown  },
  web_search:       { label: "Searching the web",  Icon: Globe     },
  calculator:       { label: "Calculating",         Icon: Hash      },
  get_current_time: { label: "Getting time",        Icon: Clock     },
}

function getMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? { label: name, Icon: Wrench }
}

// ── Sub-components ─────────────────────────────────────────────────────────
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
              <div className="rounded-xl overflow-hidden border border-gray-100 text-[12px]" style={{ maxHeight: "200px", overflowY: "auto" }}>
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
  // Two trailing spaces before each newline = GFM hard line break,
  // so terminal output (ls, pip list, etc.) renders with proper line breaks.
  const rendered = text.replace(/\n/g, "  \n")
  return (
    <div>
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">output</span>
      <div className="bg-[#F0F4FF] rounded-xl px-4 py-3 border border-[#E0E7FF] text-[12px] leading-[18px] text-gray-700 overflow-y-auto
        [&_p]:mb-2 [&_p:last-child]:mb-0
        [&_strong]:font-semibold [&_strong]:text-gray-800
        [&_ul]:pl-4 [&_ul]:my-1 [&_li]:my-0.5
        [&_hr]:border-[#E0E7FF] [&_hr]:my-2"
        style={{ maxHeight: "300px" }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) =>
              href?.includes("/api/v1/files/") || href?.includes("/jarvis-files/")
                ? <DownloadLink href={href}>{children}</DownloadLink>
                : <a href={href} className="text-[#5661f6] underline break-all" target="_blank" rel="noreferrer">{children}</a>,
          }}
        >
          {rendered}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// ── Group Badge (multiple parallel tools) ─────────────────────────────────
export function ToolGroupBadge({ tools, autoCollapsed }: { tools: ToolCall[]; autoCollapsed?: boolean }) {
  const [open, setOpen] = useState(!autoCollapsed)

  useEffect(() => {
    if (autoCollapsed) setOpen(false)
  }, [autoCollapsed])

  const allDone = tools.every((t) => t.status === "done")
  const anyRunning = tools.some((t) => t.status === "running" || t.status === "streaming")
  const n = tools.length

  const headerLabel = allDone
    ? `${n} tools`
    : anyRunning
      ? `Running ${n} tools…`
      : `${n} tools`

  return (
    <div className="py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
      >
        {anyRunning
          ? <Loader2 className="size-3 animate-spin text-[#5661f6] shrink-0" />
          : <Layers className="size-3 text-[#5661f6] shrink-0" />
        }
        <span className={`text-[12px] font-medium ${anyRunning ? "text-[#5661f6]" : "text-gray-500"}`}>
          {headerLabel}
        </span>
        {allDone && (open
          ? <ChevronDown className="size-3 text-gray-300" />
          : <ChevronRight className="size-3 text-gray-300" />
        )}
      </button>

      {open && (
        <div className="mt-2 ml-1 border-l-2 border-[#E0E7FF] pl-3.5 space-y-1">
          {tools.map((tool, i) => (
            <ToolBadge key={i} tool={tool} autoCollapsed={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────
export function ToolBadge({ tool, autoCollapsed }: { tool: ToolCall; autoCollapsed?: boolean }) {
  const [open, setOpen] = useState(!autoCollapsed)
  const { label: metaLabel, Icon } = getMeta(tool.name)
  const label = tool.label || metaLabel

  useEffect(() => {
    if (autoCollapsed) setOpen(false)
  }, [autoCollapsed])

  // Streaming — tool name resolves before args arrive
  if (tool.status === "streaming") {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <Icon className="size-3 text-[#5661f6] animate-pulse shrink-0" />
        <span className="text-[12px] font-medium text-gray-500">{label}</span>
        <span className="inline-block w-[2px] h-[12px] bg-[#5661f6] animate-pulse rounded-sm align-middle" />
      </div>
    )
  }

  // Running — spinner + label
  if (tool.status === "running") {
    return (
      <div className="py-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Loader2 className="size-3 animate-spin text-[#5661f6] shrink-0" />
          <span className="text-[12px] font-medium text-[#5661f6]">{label}</span>
        </div>
        {tool.input !== undefined && (
          <div className="ml-1 border-l-2 border-[#E0E7FF] pl-3.5">
            <InputBlock input={tool.input} />
          </div>
        )}
      </div>
    )
  }

  // Done — collapsible
  return (
    <div className="py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
      >
        <Icon className="size-3 text-[#5661f6] shrink-0" />
        <span className="text-[12px] font-medium text-gray-500">{label}</span>
        {open
          ? <ChevronDown className="size-3 text-gray-300" />
          : <ChevronRight className="size-3 text-gray-300" />
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
