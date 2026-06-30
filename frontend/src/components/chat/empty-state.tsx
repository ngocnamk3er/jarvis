"use client"

import { Terminal, Globe, FileText, BarChart2, Sparkles, Code2 } from "lucide-react"

const SUGGESTIONS = [
  {
    Icon: FileText,
    title: "Phân tích tài liệu",
    desc: "Đọc & tóm tắt PDF, Word, dữ liệu CSV",
    prompt: "Hãy phân tích file tôi vừa upload và tóm tắt nội dung chính",
  },
  {
    Icon: Globe,
    title: "Tìm kiếm web",
    desc: "Tra cứu thông tin mới nhất từ internet",
    prompt: "Tìm kiếm thông tin mới nhất về AI năm 2025",
  },
  {
    Icon: Terminal,
    title: "Chạy code",
    desc: "Viết & thực thi Python, bash ngay trong chat",
    prompt: "Viết script Python đọc file CSV và vẽ biểu đồ",
  },
  {
    Icon: BarChart2,
    title: "Tạo biểu đồ",
    desc: "Visualize dữ liệu thành chart, diagram",
    prompt: "Tạo biểu đồ so sánh GDP các nước Đông Nam Á 2020–2024",
  },
  {
    Icon: Code2,
    title: "Xây dựng webapp",
    desc: "Tạo mini app, game chạy thẳng trong chat",
    prompt: "Tạo một app tính lãi suất kép tương tác",
  },
  {
    Icon: Sparkles,
    title: "Giải thích khái niệm",
    desc: "Giải thích bất kỳ chủ đề nào dễ hiểu",
    prompt: "Giải thích Transformer architecture bằng ví dụ đơn giản",
  },
]

export function EmptyState({ onSend }: { onSend: (text: string) => void }) {
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
      <p className="text-[14px] text-gray-400 mb-9 text-center">
        Tôi có thể giúp gì cho bạn hôm nay?
      </p>

      {/* Suggestion cards */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[680px]">
        {SUGGESTIONS.map(({ Icon, title, desc, prompt }) => (
          <button
            key={title}
            onClick={() => onSend(prompt)}
            className="group bg-white hover:bg-[#5661f6] rounded-2xl p-4 text-left shadow-sm border border-gray-100/80 hover:border-[#5661f6] hover:shadow-lg hover:shadow-[#5661f6]/15 transition-all duration-200"
          >
            <div className="size-8 rounded-xl bg-[#EEF0FF] group-hover:bg-white/20 flex items-center justify-center mb-3 transition-colors">
              <Icon className="size-4 text-[#5661f6] group-hover:text-white transition-colors" />
            </div>
            <p className="text-[12px] font-semibold text-gray-800 group-hover:text-white mb-1 leading-[17px] transition-colors">
              {title}
            </p>
            <p className="text-[11px] text-gray-400 group-hover:text-white/70 leading-[15px] transition-colors">
              {desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
