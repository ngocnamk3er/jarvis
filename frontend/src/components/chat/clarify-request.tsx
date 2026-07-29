"use client"

import { useState, KeyboardEvent } from "react"
import { MessageCircleQuestion, Send } from "lucide-react"
import { PendingClarify } from "@/types/chat"

interface Props {
  clarify: PendingClarify
  onAnswer: (answer: string) => void
}

export function ClarifyRequest({ clarify, onAnswer }: Props) {
  const [text, setText] = useState("")

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAnswer(trimmed)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-3">
      <div className="rounded-2xl border border-[#5661f6]/20 bg-[#EEF0FF] overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#5661f6]/20 bg-[#E4E7FF]/60">
          <MessageCircleQuestion className="size-3.5 text-[#5661f6] shrink-0" />
          <span className="text-[12px] font-semibold text-[#4550e0]">Agent needs clarification</span>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-[13px] text-gray-700 leading-[19px]">{clarify.question}</p>

          {clarify.options && clarify.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {clarify.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onAnswer(opt)}
                  className="text-[12px] font-medium bg-white hover:bg-[#5661f6] hover:text-white text-[#5661f6] border border-[#5661f6]/30 rounded-full px-3 py-1.5 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Or type your own answer..."
              className="flex-1 text-[13px] bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#5661f6]/50"
            />
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="flex items-center justify-center size-8 rounded-lg bg-[#5661f6] hover:bg-[#4550e0] disabled:bg-gray-200 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
