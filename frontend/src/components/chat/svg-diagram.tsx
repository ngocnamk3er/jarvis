"use client"

import { memo, useMemo, useState } from "react"
import { Maximize2, Minimize2, RefreshCw } from "lucide-react"

// HTML entities are invalid in SVG XML — replace with Unicode equivalents
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–",
  "&hellip;": "…", "&laquo;": "«", "&raquo;": "»",
  "&ldquo;": "“", "&rdquo;": "”", "&lsquo;": "‘", "&rsquo;": "’",
  "&copy;": "©", "&reg;": "®", "&trade;": "™",
  "&times;": "×", "&divide;": "÷", "&plusmn;": "±",
  "&deg;": "°", "&micro;": "µ", "&middot;": "·",
}

function sanitizeSvg(svg: string): string {
  return svg.replace(/&[a-zA-Z]+;/g, (e) => HTML_ENTITIES[e] ?? e)
}

type Props = { code: string; title?: string }

export const SvgDiagram = memo(function SvgDiagram({ code, title }: Props) {
  const trimmed = code.trim()
  const [key, setKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  // Navigate the iframe directly to the SVG as its own document (src=data:
  // URI), not srcDoc with an HTML wrapper. A sandboxed HTML-wrapped SVG runs
  // its script and builds the DOM correctly but silently fails to paint —
  // loading the SVG as the actual document (like a real .svg file) avoids
  // that and lets :hover/:active CSS, <a> links, SMIL <animate>, and inline
  // <script> all work as intended.
  const dataUri = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvg(trimmed))}`,
    [trimmed]
  )

  if (!trimmed.startsWith("<svg")) {
    return (
      <div className="my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-500">
        Invalid SVG.
      </div>
    )
  }

  const iframeEl = (
    <iframe
      key={key}
      src={dataUri}
      sandbox="allow-scripts"
      width="100%"
      height={fullscreen ? "100%" : "320"}
      style={{ display: "block", border: "none" }}
      title={title || "visualization"}
    />
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 shrink-0">
          <span className="text-[12px] font-semibold text-gray-300 truncate">{title || "Visualization"}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setKey((k) => k + 1)}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="size-3.5" />
              <span className="text-[11px]">Reload</span>
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors ml-2"
            >
              <Minimize2 className="size-3.5" />
              <span className="text-[11px]">Exit</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{iframeEl}</div>
      </div>
    )
  }

  return (
    <div className="my-1">
      {title && <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{title}</p>}
      <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-white">
        {iframeEl}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white rounded-full px-2.5 py-1 transition-colors"
          >
            <RefreshCw className="size-3" />
            <span className="text-[11px] font-medium">Reload</span>
          </button>
          <button
            onClick={() => setFullscreen(true)}
            className="flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white rounded-full px-2.5 py-1 transition-colors"
          >
            <Maximize2 className="size-3" />
            <span className="text-[11px] font-medium">Fullscreen</span>
          </button>
        </div>
      </div>
    </div>
  )
})
