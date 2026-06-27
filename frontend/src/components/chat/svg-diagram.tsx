"use client"

import DOMPurify from "dompurify"

type Props = {
  code: string
  title?: string
}

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
    <div className="my-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {title && (
        <p className="mb-3 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </p>
      )}
      <div
        className="overflow-x-auto flex justify-center [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </div>
  )
}
