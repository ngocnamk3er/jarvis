"use client"

import { Check, X, Terminal } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { PendingHitl } from "@/types/chat"

interface Props {
  hitl: PendingHitl
  onApprove: () => void
  onReject: () => void
}

export function HitlApproval({ hitl, onApprove, onReject }: Props) {
  const action = hitl.actions[0]
  if (!action) return null

  const command = typeof action.args?.command === "string" ? action.args.command : JSON.stringify(action.args)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-100/60">
          <Terminal className="size-3.5 text-amber-700 shrink-0" />
          <span className="text-[12px] font-semibold text-amber-800">Agent wants to run a command</span>
        </div>

        {/* Command preview */}
        <div className="px-4 py-3">
          <div className="rounded-xl overflow-hidden border border-amber-200 text-[12px]">
            <SyntaxHighlighter
              language="bash"
              style={oneLight}
              customStyle={{
                margin: 0,
                padding: "10px 14px",
                fontSize: "12px",
                lineHeight: "18px",
                background: "#FFFBEB",
                borderRadius: 0,
              }}
              wrapLongLines
            >
              {command}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 bg-[#5661f6] hover:bg-[#4550e0] text-white rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors"
          >
            <Check className="size-3.5" />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors"
          >
            <X className="size-3.5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
