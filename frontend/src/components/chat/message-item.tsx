"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Copy, Check, Brain, ChevronDown, BarChart2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Message, MessagePart, ToolCall } from "@/types/chat"
import { ToolBadge, ToolGroupBadge } from "./tool-badge"
import { extractFilesFromMessage, FileChips, GeneratedFile } from "./file-tray"

const SvgDiagram = dynamic(
  () => import("./svg-diagram").then((m) => m.SvgDiagram),
  { ssr: false, loading: () => <div className="my-3 h-24 rounded-xl bg-gray-50 animate-pulse" /> }
)

// ── Group consecutive tool parts sharing the same parent_run_id ────────────
type NonToolPart = Exclude<MessagePart, { type: "tool" }>

type RenderItem =
  | { kind: "tool_single"; part: MessagePart & { type: "tool" }; index: number }
  | { kind: "tool_group"; tools: { tool: ToolCall; index: number }[]; groupKey: string }
  | { kind: "other"; part: NonToolPart; index: number }

function groupParts(parts: MessagePart[]): RenderItem[] {
  const items: RenderItem[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.type === "tool" && part.tool.parent_run_id) {
      const key = part.tool.parent_run_id
      const last = items[items.length - 1]
      if (last?.kind === "tool_group" && last.groupKey === key) {
        last.tools.push({ tool: part.tool, index: i })
      } else if (last?.kind === "tool_single" && last.part.tool.parent_run_id === key) {
        items[items.length - 1] = {
          kind: "tool_group",
          groupKey: key,
          tools: [{ tool: last.part.tool, index: last.index }, { tool: part.tool, index: i }],
        }
      } else {
        items.push({ kind: "tool_single", part: part as MessagePart & { type: "tool" }, index: i })
      }
    } else {
      items.push(part.type === "tool"
        ? { kind: "tool_single", part: part as MessagePart & { type: "tool" }, index: i }
        : { kind: "other", part: part as NonToolPart, index: i }
      )
    }
  }
  return items
}

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    if (!isStreaming) setIsOpen(false)
  }, [isStreaming])

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-500 transition-colors select-none"
      >
        <Brain className="size-3.5 shrink-0" />
        <span className="font-medium">{isStreaming ? "Thinking…" : "Thought process"}</span>
        <ChevronDown
          className="size-3 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {isOpen && (
        <div className="mt-1.5 ml-5 pl-3 border-l-2 border-gray-100 text-[12px] text-gray-400 font-mono leading-[18px] whitespace-pre-wrap max-h-52 overflow-y-auto">
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-block w-[3px] h-[11px] bg-gray-400 opacity-60 animate-pulse align-text-bottom" />
          )}
        </div>
      )}
    </div>
  )
}

export function MessageItem({
  message,
  previewFile,
  onPreviewFile,
}: {
  message: Message
  previewFile: GeneratedFile | null
  onPreviewFile: (f: GeneratedFile | null) => void
}) {
  const [copied, setCopied] = useState(false)

  const plainText = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.content)
    .join("")

  const copy = async () => {
    await navigator.clipboard.writeText(plainText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-gray-400 italic px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
          {plainText}
        </span>
      </div>
    )
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end group">
        <div className="max-w-[65%]">
          <div className="bg-[#5661f6] rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-[14px] font-medium text-white leading-[22px] whitespace-pre-wrap">
              {plainText}
            </p>
          </div>
          <div className="flex justify-end mt-1">
            <button
              onClick={copy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/60"
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-[95%]">
      <div className="flex items-center gap-2 mb-2">
        <div className="size-[22px] rounded-full bg-[#5661f6] flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] font-bold tracking-tight">AI</span>
        </div>
        <span className="text-[11px] font-semibold text-gray-500 tracking-wide uppercase">
          Jarvis
        </span>
      </div>

      <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm space-y-1">
        {groupParts(message.parts).map((item, ri) => {
          if (item.kind === "tool_group") {
            const lastToolIdx = item.tools[item.tools.length - 1].index
            const autoCollapsed = message.parts.slice(lastToolIdx + 1).some(
              (p) => p.type === "tool" || (p.type === "text" && p.content.length > 0)
            )
            return <ToolGroupBadge key={ri} tools={item.tools.map((t) => t.tool)} autoCollapsed={autoCollapsed} />
          }

          if (item.kind === "tool_single") {
            const { part, index: i } = item
            const autoCollapsed = message.parts.slice(i + 1).some(
              (p) => p.type === "tool" || (p.type === "text" && p.content.length > 0)
            )
            return <ToolBadge key={ri} tool={part.tool} autoCollapsed={autoCollapsed} />
          }

          const { part, index: i } = item

          if (part.type === "thinking") {
            return <ThinkingBlock key={ri} content={part.content} isStreaming={part.isStreaming} />
          }

          if (part.type === "viz") {
            // Old conversations may still hold "mermaid"/"webapp"/"html" blocks
            // from before those tools were removed — degrade gracefully instead of crashing.
            if (part.format !== "svg") {
              return (
                <div key={ri} className="my-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[12px] text-gray-400">
                  This visualization type is no longer supported.
                </div>
              )
            }
            return (
              <div key={ri} className="py-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart2 className="size-3 text-[#5661f6] shrink-0" />
                  <span className="text-[12px] font-semibold text-gray-600 font-mono">generate_visualization_svg</span>
                </div>
                <div className="ml-1 border-l-2 border-[#E0E7FF] pl-3.5">
                  <SvgDiagram code={part.code} title={part.title} />
                </div>
              </div>
            )
          }

          const isLast = i === message.parts.length - 1
          return (
            <div key={ri} className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => (
                    <p className="text-[14px] font-medium leading-[22px] text-gray-800 mb-2 last:mb-0">
                      {children}
                      {isLast && message.isStreaming && (
                        <span className="ml-0.5 inline-block w-[5px] h-[15px] bg-[#5661f6] opacity-80 animate-pulse align-text-bottom rounded-sm" />
                      )}
                    </p>
                  ),
                  h1: ({ children }) => <h1 className="text-[18px] font-bold leading-[26px] text-gray-900 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-[16px] font-bold leading-[24px] text-gray-900 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-[14px] font-semibold leading-[22px] text-gray-900 mb-1">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="text-[14px] font-medium leading-[22px] text-gray-800">{children}</li>,
                  code: ({ children, className }) => {
                    const lang = className?.replace("language-", "") ?? ""
                    if (lang) {
                      return (
                        <div className="rounded-xl overflow-hidden border border-gray-100 mb-2 text-[12px]">
                          <SyntaxHighlighter
                            language={lang}
                            style={oneLight}
                            customStyle={{
                              margin: 0,
                              padding: "12px 16px",
                              fontSize: "12px",
                              lineHeight: "18px",
                              background: "#FAFAFA",
                              borderRadius: 0,
                            }}
                            wrapLongLines
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      )
                    }
                    return (
                      <code className="bg-gray-100 text-[#5661f6] px-1.5 py-0.5 rounded text-[12px] font-mono">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => <>{children}</>,
                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                  a: ({ children, href }) => (
                    <a href={href} className="text-[#5661f6] underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[#5661f6] pl-3 text-gray-600 italic mb-2">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {part.content}
              </ReactMarkdown>
            </div>
          )
        })}

        {message.isStreaming && (
          <div className="flex items-center gap-[5px] py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 rounded-full bg-[#5661f6]"
                style={{
                  animation: "wave 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {!message.isStreaming && (
          <FileChips
            files={extractFilesFromMessage(message)}
            previewFile={previewFile}
            onSelect={onPreviewFile}
          />
        )}
      </div>

      {message.usage && (
        <div className="flex justify-start mt-1">
          <span
            className="text-[11px] text-gray-400 px-1"
            title={`Total: ${message.usage.total_tokens.toLocaleString()} tokens`}
          >
            {message.usage.input_tokens.toLocaleString()} in · {message.usage.output_tokens.toLocaleString()} out{message.isStreaming ? "…" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
