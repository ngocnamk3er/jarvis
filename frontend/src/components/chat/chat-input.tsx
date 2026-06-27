"use client"

import { useState, KeyboardEvent } from "react"
import { SendHorizontal, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  onSend: (content: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("")

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="px-8 pb-7 pt-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 bg-white rounded-full px-5 py-3 shadow-sm border border-gray-100/80">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What's in your mind..."
            className="flex-1 bg-transparent text-[14px] font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-medium outline-none leading-[20px]"
            disabled={disabled}
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className={cn(
              "size-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
              disabled || !value.trim()
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : "bg-[#5661f6] text-white hover:bg-[#4550e0]"
            )}
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
