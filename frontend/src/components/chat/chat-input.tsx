"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { SendHorizontal, Loader2, Brain, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThinkingEffort } from "@/types/chat"

const EFFORT_OPTIONS: { value: ThinkingEffort; label: string; desc: string }[] = [
  { value: "low", label: "Low", desc: "Faster, lighter thinking" },
  { value: "medium", label: "Medium", desc: "Balanced reasoning" },
  { value: "high", label: "High", desc: "Deep reasoning" },
  { value: "xhigh", label: "Max", desc: "Most thorough, slowest" },
]

type Props = {
  onSend: (content: string, effort: ThinkingEffort) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("")
  const [effort, setEffort] = useState<ThinkingEffort>("high")
  const [open, setOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, effort)
    setValue("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const current = EFFORT_OPTIONS.find((o) => o.value === effort)!

  return (
    <div className="px-8 pb-7 pt-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col bg-white rounded-3xl px-5 py-3 shadow-sm border border-gray-100/80 gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => { setValue(e.target.value); resize() }}
            onKeyDown={onKeyDown}
            placeholder="What's in your mind..."
            className="flex-1 bg-transparent text-[14px] font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-medium outline-none leading-[22px] resize-none overflow-y-auto"
            style={{ maxHeight: "200px" }}
            disabled={disabled}
          />

          <div className="flex items-center justify-between">
            {/* Thinking effort selector */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 bg-[#EEF0FF] hover:bg-[#E4E7FF] transition-colors rounded-full px-2.5 py-1"
              >
                <Brain className="size-3 text-[#5661f6] shrink-0" />
                <span className="text-[11px] font-semibold text-[#5661f6]">{current.label}</span>
                <ChevronDown
                  className="size-2.5 text-[#5661f6] transition-transform duration-150"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {open && (
                <div className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                  {EFFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setEffort(opt.value); setOpen(false) }}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left",
                        opt.value === effort && "bg-[#EEF0FF] hover:bg-[#E4E7FF]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-[12px] font-semibold leading-[16px]",
                          opt.value === effort ? "text-[#5661f6]" : "text-gray-700"
                        )}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-gray-400 leading-[15px] mt-0.5">{opt.desc}</p>
                      </div>
                      {opt.value === effort && (
                        <Check className="size-3 text-[#5661f6] shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
    </div>
  )
}
