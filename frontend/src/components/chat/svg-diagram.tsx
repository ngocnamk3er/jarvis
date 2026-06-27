"use client"

import DOMPurify from "dompurify"
import { VizContainer } from "./viz-container"

type Props = { code: string; title?: string }

export function SvgDiagram({ code, title }: Props) {
  const clean = DOMPurify.sanitize(code, { USE_PROFILES: { svg: true, svgFilters: true } })

  if (!clean) {
    return (
      <div className="my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-500">
        Invalid SVG.
      </div>
    )
  }

  return (
    <VizContainer title={title}>
      <div
        className="[&_svg]:max-w-none"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </VizContainer>
  )
}
