"use client"

import { VizContainer } from "./viz-container"

// HTML entities are invalid in SVG XML — replace with Unicode equivalents
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–",
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

export function SvgDiagram({ code, title }: Props) {
  const trimmed = code.trim()

  if (!trimmed.startsWith("<svg")) {
    return (
      <div className="my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-500">
        Invalid SVG.
      </div>
    )
  }

  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvg(trimmed))}`

  return (
    <VizContainer title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUri}
        alt={title || "visualization"}
        className="max-w-none block"
        style={{ height: "280px", width: "auto" }}
      />
    </VizContainer>
  )
}
