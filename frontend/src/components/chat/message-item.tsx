"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Message } from "@/types/chat"
import { ToolBadge } from "./tool-badge"

export function MessageItem({ message }: { message: Message }) {
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

  if (message.role === "user") {
    return (
      <div className="flex justify-end group">
        <div className="max-w-[65%]">
          <p className="text-[14px] font-medium text-gray-700 text-right leading-[22px]">
            {plainText}
          </p>
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
    <div className="flex flex-col max-w-[80%]">
      <div className="flex items-center gap-2 mb-2">
        <div className="size-[22px] rounded-full bg-[#5661f6] flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] font-bold tracking-tight">AI</span>
        </div>
        <span className="text-[11px] font-semibold text-gray-500 tracking-wide uppercase">
          Chat A.I ⓘ
        </span>
      </div>

      <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm space-y-1">
        {message.parts.map((part, i) => {
          if (part.type === "tool") {
            return <ToolBadge key={i} tool={part.tool} />
          }

          const isLast = i === message.parts.length - 1
          return (
            <div key={i} className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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

        {message.isStreaming && message.parts.length === 0 && (
          <span className="inline-block w-[5px] h-[15px] bg-[#5661f6] opacity-80 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}
