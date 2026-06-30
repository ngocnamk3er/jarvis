"use client"

import { memo, useState, useRef } from "react"
import { Maximize2, Minimize2, RefreshCw } from "lucide-react"

type Props = { html: string; title?: string }

export const WebAppBlock = memo(function WebAppBlock({ html, title }: Props) {
  const [key, setKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const reload = () => setKey((k) => k + 1)

  const iframeEl = (
    <iframe
      key={key}
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals allow-same-origin"
      width="100%"
      height={fullscreen ? "100%" : "480"}
      style={{ display: "block", border: "none" }}
      title={title || "webapp"}
      allow="fullscreen"
    />
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 shrink-0">
          <span className="text-[12px] font-semibold text-gray-300 truncate">{title || "Web App"}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={reload}
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
      <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
        {iframeEl}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            onClick={reload}
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
