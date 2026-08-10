"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { useSession } from "next-auth/react"
import { SendHorizontal, Loader2, Brain, ChevronDown, Check, Cpu, Bot, Paperclip, X, File, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { ThinkingEffort, Model } from "@/types/chat"
import { useModels } from "@/hooks/use-models"

const EFFORT_OPTIONS: { value: ThinkingEffort; label: string; desc: string }[] = [
  { value: "none", label: "None", desc: "No thinking — fastest, direct answer" },
  { value: "low", label: "Low", desc: "Faster, lighter thinking" },
  { value: "medium", label: "Medium", desc: "Balanced reasoning" },
  { value: "high", label: "High", desc: "Deep reasoning" },
  { value: "xhigh", label: "Max", desc: "Most thorough, slowest" },
]

// Shown next to open-weight models in the picker (Model.huggingFaceId
// non-null) — see AVAILABLE_MODELS in backend/app/schemas/chat.py, sourced
// from OpenRouter's own hugging_face_id field.
function OpenWeightBadge({ huggingFaceId }: { huggingFaceId: string | null }) {
  if (!huggingFaceId) return null
  return (
    <span
      title={`Open-weight — ${huggingFaceId} on Hugging Face`}
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5"
    >
      <Unlock className="size-2.5" />
      Open
    </span>
  )
}

type AttachedFile = { name: string; virtualPath: string }

type Props = {
  onSend: (content: string, effort: ThinkingEffort, model: Model, subagentModel?: Model) => void
  disabled: boolean
  threadId: string | null
  onCreateConversation?: () => Promise<string>
  // Last model actually used for this conversation (persisted server-side —
  // see touch_conversation in chat.py), so switching back to it shows what
  // was really used instead of always resetting to the global default.
  initialModelId?: string | null
  // Last model the research subagent actually used for this conversation.
  // null/unset means "inherit the main model" — the backend already does
  // this by default (LangGraph merges the root run's config into the
  // subagent's), so leaving this unset is not a degraded state.
  initialSubagentModelId?: string | null
}

export function ChatInput({ onSend, disabled, threadId, onCreateConversation, initialModelId, initialSubagentModelId }: Props) {
  const { data: session } = useSession()
  const accessToken = session?.accessToken
  const { models } = useModels()
  const [value, setValue] = useState("")
  const [effort, setEffort] = useState<ThinkingEffort>("high")
  const [model, setModel] = useState<Model | null>(null)
  const [subagentModel, setSubagentModel] = useState<Model | null>(null)
  const [effortOpen, setEffortOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [subagentModelOpen, setSubagentModelOpen] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const effortRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const subagentModelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const submit = () => {
    const trimmed = value.trim()
    if ((!trimmed && attachedFiles.length === 0) || disabled || !model) return

    let content = trimmed
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map((f) => `📎 ${f.name} → ${f.virtualPath}`).join("\n")
      content = trimmed ? `${trimmed}\n\n${fileList}` : fileList
    }

    onSend(content, effort, model, subagentModel ?? undefined)
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
        const res = await apiFetch(`/api/v1/files/upload/${tid}`, accessToken, {
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
      apiFetch(`/api/v1/files/upload/${threadId}/${encodeURIComponent(file.name)}`, accessToken, {
        method: "DELETE",
      }).catch(() => {})
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (effortRef.current && !effortRef.current.contains(e.target as Node)) setEffortOpen(false)
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false)
      if (subagentModelRef.current && !subagentModelRef.current.contains(e.target as Node)) setSubagentModelOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (!model && models.length > 0) {
      const remembered = initialModelId ? models.find((m) => m.id === initialModelId) : undefined
      setModel(remembered ?? models.find((m) => m.default) ?? models[0])
    }
  }, [models, model, initialModelId])

  // Ref (not state) so a user explicitly picking "Same as main model" back
  // to null doesn't get immediately overwritten by this effect re-firing —
  // it should only apply the remembered value once, on initial mount.
  const subagentModelInitialized = useRef(false)
  useEffect(() => {
    if (!subagentModelInitialized.current && initialSubagentModelId && models.length > 0) {
      const remembered = models.find((m) => m.id === initialSubagentModelId)
      if (remembered) {
        setSubagentModel(remembered)
        subagentModelInitialized.current = true
      }
    }
  }, [models, initialSubagentModelId])

  // Only the levels this model actually supports meaningfully/safely (see
  // AVAILABLE_MODELS in backend/app/schemas/chat.py for per-model evidence).
  const availableEffortOptions = EFFORT_OPTIONS.filter((o) => model?.effortOptions.includes(o.value))

  // If switching models drops the currently-selected level (e.g. "xhigh" on
  // a model where it's unsafe, or "low" on a model where it's a no-op),
  // snap to "high" if still available, else the first remaining option.
  useEffect(() => {
    if (!model) return
    if (model.effortOptions.includes(effort)) return
    setEffort(model.effortOptions.includes("high") ? "high" : model.effortOptions[0])
  }, [model, effort])

  const currentEffort = EFFORT_OPTIONS.find((o) => o.value === effort) ?? availableEffortOptions[0]
  const canSend = !disabled && !!model && (value.trim().length > 0 || attachedFiles.length > 0)

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

              {/* Thinking effort selector — options filtered per-model to
                  only levels verified meaningful/safe for it (see
                  Model.effortOptions / AVAILABLE_MODELS for the evidence).
                  When a model only has one real option, there's nothing to
                  choose between (e.g. Qwen's chat template only has a
                  binary thinking on/off, no graduated levels) — disable
                  the control instead of showing a pointless 1-item dropdown. */}
              <div ref={effortRef} className="relative">
                <button
                  onClick={() => { if (availableEffortOptions.length > 1) { setEffortOpen((o) => !o); setModelOpen(false) } }}
                  disabled={availableEffortOptions.length <= 1}
                  title={availableEffortOptions.length > 1 ? undefined : `${model?.name ?? "This model"} only has one real thinking level — no graduated effort control exists to switch between`}
                  className={cn(
                    "flex items-center gap-1.5 transition-colors rounded-full px-2.5 py-1",
                    availableEffortOptions.length > 1
                      ? "bg-[#EEF0FF] hover:bg-[#E4E7FF] cursor-pointer"
                      : "bg-gray-100 cursor-not-allowed opacity-60"
                  )}
                >
                  <Brain className={cn("size-3 shrink-0", availableEffortOptions.length > 1 ? "text-[#5661f6]" : "text-gray-400")} />
                  <span className={cn("text-[11px] font-semibold", availableEffortOptions.length > 1 ? "text-[#5661f6]" : "text-gray-400")}>{currentEffort?.label}</span>
                  <ChevronDown
                    className={cn("size-2.5 transition-transform duration-150", availableEffortOptions.length > 1 ? "text-[#5661f6]" : "text-gray-400")}
                    style={{ transform: effortOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {effortOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                    {availableEffortOptions.map((opt) => (
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
                  <span className="text-[11px] font-semibold text-[#5661f6]">{model?.name ?? "Loading…"}</span>
                  <ChevronDown
                    className="size-2.5 text-[#5661f6] transition-transform duration-150"
                    style={{ transform: modelOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {modelOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m); setModelOpen(false) }}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left",
                          m.id === model?.id && "bg-[#EEF0FF] hover:bg-[#E4E7FF]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn(
                              "text-[12px] font-semibold leading-[16px]",
                              m.id === model?.id ? "text-[#5661f6]" : "text-gray-700"
                            )}>
                              {m.name}
                            </p>
                            <OpenWeightBadge huggingFaceId={m.huggingFaceId} />
                          </div>
                          <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">{m.desc}</p>
                          <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">{m.size}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400">in {m.inputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">out {m.outputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">{m.context} ctx</span>
                          </div>
                        </div>
                        {m.id === model?.id && (
                          <Check className="size-3 text-[#5661f6] shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subagent model selector */}
              <div ref={subagentModelRef} className="relative">
                <button
                  onClick={() => { setSubagentModelOpen((o) => !o); setEffortOpen(false); setModelOpen(false) }}
                  title="Model used by the research subagent"
                  className="flex items-center gap-1.5 bg-[#EEF0FF] hover:bg-[#E4E7FF] transition-colors rounded-full px-2.5 py-1"
                >
                  <Bot className="size-3 text-[#5661f6] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#5661f6]">{subagentModel?.name ?? "Same as main"}</span>
                  <ChevronDown
                    className="size-2.5 text-[#5661f6] transition-transform duration-150"
                    style={{ transform: subagentModelOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {subagentModelOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-10">
                    <button
                      onClick={() => { setSubagentModel(null); setSubagentModelOpen(false) }}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left",
                        !subagentModel && "bg-[#EEF0FF] hover:bg-[#E4E7FF]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-[12px] font-semibold leading-[16px]",
                          !subagentModel ? "text-[#5661f6]" : "text-gray-700"
                        )}>
                          Same as main model
                        </p>
                        <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">
                          Subagent follows whichever model is selected above
                        </p>
                      </div>
                      {!subagentModel && (
                        <Check className="size-3 text-[#5661f6] shrink-0 mt-0.5" />
                      )}
                    </button>
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSubagentModel(m); setSubagentModelOpen(false) }}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left",
                          m.id === subagentModel?.id && "bg-[#EEF0FF] hover:bg-[#E4E7FF]"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn(
                              "text-[12px] font-semibold leading-[16px]",
                              m.id === subagentModel?.id ? "text-[#5661f6]" : "text-gray-700"
                            )}>
                              {m.name}
                            </p>
                            <OpenWeightBadge huggingFaceId={m.huggingFaceId} />
                          </div>
                          <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">{m.desc}</p>
                          <p className="text-[10px] text-gray-400 leading-[14px] mt-0.5">{m.size}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400">in {m.inputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">out {m.outputPrice}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] text-gray-400">{m.context} ctx</span>
                          </div>
                        </div>
                        {m.id === subagentModel?.id && (
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
