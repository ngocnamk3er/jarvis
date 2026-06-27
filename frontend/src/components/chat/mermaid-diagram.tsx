"use client"

import { useEffect, useRef, useState } from "react"

type MermaidLib = typeof import("mermaid")["default"]
let lib: MermaidLib | null = null

async function getMermaid(): Promise<MermaidLib> {
  if (!lib) {
    const { default: mermaid } = await import("mermaid")
    mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "inherit", fontSize: 14 })
    lib = mermaid
  }
  return lib
}

type Props = { code: string; title?: string }

export function MermaidDiagram({ code, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    setError(null)

    const el = containerRef.current
    el.innerHTML = code
    el.removeAttribute("data-processed")

    getMermaid()
      .then((m) => m.run({ nodes: [el] }))
      .catch((err) => {
        el.innerHTML = ""
        setError(String(err?.message ?? err))
      })
  }, [code])

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-500">
        Diagram error: {error}
      </div>
    )
  }

  return (
    <div className="my-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {title && (
        <p className="mb-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      )}
      <div ref={containerRef} className="overflow-x-auto flex justify-center [&_svg]:max-w-full" />
    </div>
  )
}
