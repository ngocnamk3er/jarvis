import { Sparkles } from "lucide-react"

export function UpgradeBanner() {
  return (
    <div className="w-8 flex flex-col items-center justify-center shrink-0 py-8">
      <button
        className="flex flex-col items-center gap-2 bg-gradient-to-b from-pink-400 via-fuchsia-500 to-purple-600 text-white rounded-full px-1.5 py-5 shadow-md hover:opacity-90 transition-opacity"
        style={{ writingMode: "vertical-rl" }}
      >
        <Sparkles className="size-3 rotate-90 mb-1" />
        <span
          className="text-[9px] font-semibold tracking-[0.15em] uppercase whitespace-nowrap"
          style={{ transform: "rotate(180deg)" }}
        >
          Upgrade to Pro
        </span>
      </button>
    </div>
  )
}
