"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { SendHorizontal, Loader2, Brain, ChevronDown, Check, Cpu, Paperclip, X, File } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThinkingEffort, Model } from "@/types/chat"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ""

const EFFORT_OPTIONS: { value: ThinkingEffort; label: string; desc: string }[] = [
  { value: "low", label: "Low", desc: "Faster, lighter thinking" },
  { value: "medium", label: "Medium", desc: "Balanced reasoning" },
  { value: "high", label: "High", desc: "Deep reasoning" },
  { value: "xhigh", label: "Max", desc: "Most thorough, slowest" },
]

type ModelOption = Model & {
  desc: string
  inputPrice: string
  outputPrice: string
  context: string
}

const MODELS: ModelOption[] = [
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    desc: "Fast, cheap, vision",
    inputPrice: "$0.05",
    outputPrice: "$0.40",
    context: "400K",
  },
  {
    id: "meta-llama/llama-4-scout",
    name: "Llama 4 Scout",
    desc: "10M context, vision",
    inputPrice: "$0.10",
    outputPrice: "$0.30",
    context: "10M",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    desc: "Google lightweight, vision",
    inputPrice: "$0.10",
    outputPrice: "$0.40",
    context: "1M",
  },
  {
    id: "qwen/qwen3-vl-32b-instruct",
    name: "Qwen3 VL 32B",
    desc: "Vision specialist",
    inputPrice: "$0.10",
    outputPrice: "$0.42",
    context: "262K",
  },
  {
    id: "qwen/qwen3.7-plus",
    name: "Qwen 3.7+",
    desc: "High quality, vision",
    inputPrice: "$0.32",
    outputPrice: "$1.28",
    context: "1M",
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    desc: "Frontier reasoning, vision",
    inputPrice: "$1.70",
    outputPrice: "$25.00",
    context: "1M",
  },
]

const DEFAULT_MODEL = MODELS[0]

type AttachedFile = { name: string; virtualPath: string }

type Props = {
  onSend: (content: string, effort: ThinkingEffort, model: Model) => void
  disabled: boolean
  threadId: string | null
  onCreateConversation?: () => Promise<string>
}

export function ChatInput({ onSend, disabled, threadId, onCreateConversation }: Props) {
  const [value, setValue] = useState("")
  const [effort, setEffort] = useState<ThinkingEffort>("high")
  const [model, setModel] = useState<ModelOption>(DEFAULT_MODEL)
  const [effortOpen, setEffortOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const effortRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const submit = () => {
    const trimmed = value.trim()
    if ((!trimmed && attachedFiles.length === 0) || disabled) return

    let content = trimmed
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map((f) => `📎 ${f.name} → ${f.virtualPath}`).join("\n")
      content = trimmed ? `${trimmed}\n\n${fileList}` : fileList
    }

    onSend(content, effort, model)
    setValue("")
    setAttachedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    let tid = threadId
    if (!tid) {
      if (!onCreateConversation) return
      tid = await onCreateConversation()
    }

    setUploading(true)
    try {
      const uploaded: AttachedFile[] = []
      for (const file of files) {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch(`${API_URL}/api/v1/files/upload/${tid}`, {
          method: "POST",
          body: form,
        })
        if (res.ok) {
          const data = await res.json()
          uploaded.push({ name: data.filename, virtualPath: data.virtual_path })
        }
      }
      setAttachedFiles((prev) => [...prev, ...uploaded])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeFile = (idx: number) => {
    const file = attachedFiles[idx]
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
    if (file && threadId) {
      fetch(`${API_URL}/api/v1/files/upload/${threadId}/${encodeURIComponent(file.name)}`, {
        method: "DELETE",
      }).catch(() => {})
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (effortRef.current && !effortRef.current.contains(e.target as Node)) setEffortOpen(false)
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const currentEffort = EFFORT_OPTIONS.find((o) => o.value === effort)!
  const canSend = !disabled && (value.trim().length > 0 || attachedFiles.length > 0)

  return (
    <div className="px-8 pb-7 pt-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col bg-white rounded-3xl px-5 py-3 shadow-sm border border-gray-100/80 gap-2">

          {/* Attached file chips */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-[#EEF0FF] rounded-full px-2.5 py-1 max-w-[200px]"
                >
                  <File className="size-3 text-[#5661f6] shrink-0" />
                  <span className="text-[11px] font-medium text-[#5661f6] truncate">{f.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[#5661f6] hover:text-[#4550e0] shrink-0 ml-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
            <div className="flex items-center gap-2">
              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || disabled}
                title="Attach files"
                className={cn(
                  "flex items-center justify-center size-7 rounded-full transition-colors",
                  uploading || disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-400 hover:text-[#5661f6] hover:bg-[#EEF0FF]"
                )}
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
              </button>

              {/* Thinking effort selector */}
              <div ref={effortRef} className="relative">
                <button
                  onClick={() => { setEffortOpen((o) => !o); setModelOpen(false) }}
                  className="flex items-center gap-1.5 bg-[#EEF0FF] hover:bg-[#E4E7FF] transition-colors rounded-full px-2.5 py-1"
                >
                  <Brain className="size-3 text-[#5661f6] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#5661f6]">{currentEffort.label}</span>
                  <ChevronDown
                    className="size-2.5 text-[#5661f6] transition-transform duration-150"
                    style={{ transform: effortOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {effortOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                    {EFFORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setEffort(opt.value); setEffortOpen(false) }}
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

              {/* Model selector */}
              <div ref={modelRef} className="relative">
                <button
                  onClick={() => { setModelOpen((o) => !o); setEffortOpen(false) }}
                  className="flex items-center gap-1.5 bg-[#EEF0FF] hover:bg-[#E4E7FF] transition-colors rounded-full px-2.5 py-1"
                >
                  <Cpu className="size-3 text-[#5661f6] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#5661f6]">{model.name}</span>
                  <ChevronDown
                    className="size-2.5 text-[#5661f6] transition-transform duration-150"
                    style={{ transform: modelOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {modelOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m); setModelOpen(false) }}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left",
                          m.id === model.id && "bg-[#EEF0FF] hover:bg-[#E4E7FF]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-[12px] font-semibold leading-[16px]",
                            m.id === model.id ? "text-[#5661f6]" : "text-gray-700"
                          )}>
                            {m.name}
                          </p>
                          <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">{m.desc}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400">in {m.inputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">out {m.outputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">{m.context} ctx</span>
                          </div>
                        </div>
                        {m.id === model.id && (
                          <Check className="size-3 text-[#5661f6] shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={!canSend}
              className={cn(
                "size-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                !canSend
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
