"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

const MIN = 0.2
const MAX = 5
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z))

type Props = { children: React.ReactNode; title?: string }

export function VizContainer({ children, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  const apply = (z: number, o: { x: number; y: number }) => {
    zoomRef.current = z
    offsetRef.current = o
    setZoom(z)
    setOffset(o)
  }

  const reset = () => apply(1, { x: 0, y: 0 })

  // Zoom toward viewport center (for buttons)
  const zoomBy = (delta: number) => {
    const prevZ = zoomRef.current
    const newZ = clamp(prevZ + delta)
    const scale = newZ / prevZ
    const o = offsetRef.current
    // keep the visual center fixed: zoom toward (0,0) which is container center
    apply(newZ, { x: o.x * scale, y: o.y * scale })
  }

  // Zoom toward cursor (for wheel)
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    // Mouse pos relative to container CENTER
    const mx = e.clientX - rect.left - rect.width / 2
    const my = e.clientY - rect.top - rect.height / 2

    const prevZ = zoomRef.current
    const newZ = clamp(prevZ * (e.deltaY < 0 ? 1.1 : 0.9))
    const scale = newZ / prevZ
    const o = offsetRef.current

    apply(newZ, {
      x: mx + (o.x - mx) * scale,
      y: my + (o.y - my) * scale,
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onWheel])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    const o = offsetRef.current
    apply(zoomRef.current, { x: o.x + dx, y: o.y + dy })
  }

  const onMouseUp = () => { dragging.current = false }

  return (
    <div className="my-3 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50">
        {title
          ? <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
          : <span />
        }
        <div className="flex items-center gap-0.5">
          <button onClick={() => zoomBy(-0.25)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <ZoomOut className="size-3.5" />
          </button>
          <span className="text-[11px] text-gray-400 w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => zoomBy(0.25)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <ZoomIn className="size-3.5" />
          </button>
          <div className="w-px h-3 bg-gray-200 mx-1" />
          <button onClick={reset} title="Reset" className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Maximize2 className="size-3" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: 320 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className="w-full h-full flex items-center justify-center pointer-events-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
