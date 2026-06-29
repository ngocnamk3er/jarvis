"use client"

import { useState, useEffect } from "react"
import { X, Download, FileText, Image, File, Sheet, Loader2 } from "lucide-react"
import { Message } from "@/types/chat"

interface GeneratedFile {
  name: string
  url: string
  ext: string
}

function FileIcon({ ext, className = "size-3.5" }: { ext: string; className?: string }) {
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return <Image className={className} />
  if (["xlsx", "xls", "csv"].includes(ext))
    return <Sheet className={className} />
  if (["doc", "docx", "pdf", "txt"].includes(ext))
    return <FileText className={className} />
  return <File className={className} />
}

// ── per-type preview bodies ───────────────────────────────────────────────────

function ImagePreview({ url, name }: { url: string; name: string }) {
  return (
    <img src={url} alt={name} className="max-w-full h-auto rounded-lg shadow-sm" />
  )
}

function PdfPreview({ url, name }: { url: string; name: string }) {
  return (
    <iframe src={url} className="w-full h-full rounded-lg border-0" title={name} />
  )
}

function DocxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const mammoth = await import("mammoth")
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (!cancelled) setHtml(result.value)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [url])

  if (error) return <p className="text-[13px] text-red-400">Failed to render document.</p>
  if (html === null) return <Loader2 className="size-5 animate-spin text-[#5661f6]" />
  return (
    <div
      className="w-full bg-white rounded-lg shadow-sm p-6 text-[13px] leading-relaxed text-gray-800
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2
        [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2
        [&_p]:mb-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mb-1
        [&_table]:w-full [&_table]:border-collapse
        [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1
        [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function XlsxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buf, { type: "array" })
        if (!cancelled) {
          setSheets(wb.SheetNames)
          setHtml(XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]))
          setActive(0)
          // Store workbook for tab switching
          ;(window as unknown as Record<string, unknown>).__xlsxWb = wb
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [url])

  const switchSheet = async (i: number) => {
    const XLSX = await import("xlsx")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wb = (window as any).__xlsxWb
    if (!wb) return
    setActive(i)
    setHtml(XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[i]]))
  }

  if (error) return <p className="text-[13px] text-red-400">Failed to render spreadsheet.</p>
  if (html === null) return <Loader2 className="size-5 animate-spin text-[#5661f6]" />

  return (
    <div className="w-full flex flex-col gap-2">
      {sheets.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {sheets.map((s, i) => (
            <button
              key={s}
              onClick={() => switchSheet(i)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                i === active
                  ? "bg-[#5661f6] text-white border-[#5661f6]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#5661f6]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div
        className="overflow-auto rounded-lg bg-white shadow-sm
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px]
          [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_td]:whitespace-nowrap
          [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-[#F5F6FF] [&_th]:font-semibold [&_th]:whitespace-nowrap"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function SvgPreview({ url, name }: { url: string; name: string }) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    fetch(url).then(r => r.text()).then(setSvg).catch(() => setSvg(""))
  }, [url])

  if (svg === null) return <Loader2 className="size-5 animate-spin text-[#5661f6]" />
  if (!svg) return <img src={url} alt={name} className="max-w-full h-auto" />
  return (
    <div
      className="max-w-full bg-white rounded-lg shadow-sm p-4 [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// ── main panel ───────────────────────────────────────────────────────────────

function PreviewPanel({ file, onClose }: { file: GeneratedFile; onClose: () => void }) {
  const { name, url, ext } = file
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
  const isSvg = ext === "svg"
  const isPdf = ext === "pdf"
  const isDocx = ["doc", "docx"].includes(ext)
  const isSheet = ["xlsx", "xls", "csv"].includes(ext)

  return (
    <div className="flex flex-col w-[480px] shrink-0 h-full bg-white border-l border-gray-200 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon ext={ext} className="size-4 text-[#5661f6] shrink-0" />
          <span className="text-[13px] font-semibold text-gray-800 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <a
            href={url}
            download={name}
            className="flex items-center gap-1 text-[12px] text-[#5661f6] font-medium hover:opacity-70 transition-opacity"
          >
            <Download className="size-3.5" />
            Download
          </a>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="size-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Preview body */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4 flex flex-col items-start">
        {isImage && <ImagePreview url={url} name={name} />}
        {isSvg   && <SvgPreview  url={url} name={name} />}
        {isPdf   && <PdfPreview  url={url} name={name} />}
        {isDocx  && <DocxPreview url={url} />}
        {isSheet && <XlsxPreview url={url} />}
      </div>
    </div>
  )
}

// ── file extraction + chips ───────────────────────────────────────────────────

export function extractFilesFromMessage(message: Message): GeneratedFile[] {
  const seen = new Set<string>()
  const files: GeneratedFile[] = []
  for (const part of message.parts) {
    if (part.type !== "tool" || part.tool.name !== "represent_file" || !part.tool.output) continue
    const re = /\[⬇ Download ([^\]]+)\]\((https?:\/\/[^)]+)\)/g
    for (const m of part.tool.output.matchAll(re)) {
      const [, name, url] = m
      if (!seen.has(url)) {
        seen.add(url)
        files.push({ name, url, ext: name.split(".").pop()?.toLowerCase() ?? "" })
      }
    }
  }
  return files
}

export function FileChips({
  files,
  previewFile,
  onSelect,
}: {
  files: GeneratedFile[]
  previewFile: GeneratedFile | null
  onSelect: (f: GeneratedFile | null) => void
}) {
  if (files.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
      {files.map((f) => {
        const active = previewFile?.url === f.url
        return (
          <button
            key={f.url}
            onClick={() => onSelect(active ? null : f)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all border ${
              active
                ? "bg-[#5661f6] text-white border-[#5661f6] shadow-sm"
                : "bg-[#F5F6FF] text-gray-700 border-[#E0E7FF] hover:border-[#5661f6] hover:text-[#5661f6]"
            }`}
          >
            <FileIcon ext={f.ext} className="size-3.5 shrink-0" />
            <span className="max-w-[200px] truncate">{f.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export { PreviewPanel }
export type { GeneratedFile }
