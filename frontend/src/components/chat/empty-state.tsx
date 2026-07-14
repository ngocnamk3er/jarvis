"use client"

export function EmptyState() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-y-auto">

      {/* Logo mark */}
      <div className="relative mb-6">
        <div className="size-14 rounded-2xl bg-[#5661f6] flex items-center justify-center shadow-lg shadow-[#5661f6]/25">
          <span className="text-white font-bold text-2xl tracking-tight">J</span>
        </div>
        <div className="absolute -inset-1 rounded-2xl bg-[#5661f6]/10 -z-10 blur-md" />
      </div>

      {/* Greeting */}
      <p className="text-[11px] font-semibold tracking-[0.2em] text-[#5661f6]/60 uppercase mb-2">
        Jarvis
      </p>
      <h2 className="text-[26px] font-bold text-gray-900 mb-1 text-center leading-tight tracking-tight">
        {greeting}
      </h2>
      <p className="text-[14px] text-gray-400 text-center">
        Tôi có thể giúp gì cho bạn hôm nay?
      </p>
    </div>
  )
}
