"use client"

import { useState, useEffect } from "react"
import { Terminal, Globe, FileText, BarChart2, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Category = {
  Icon: LucideIcon
  label: string
  prompts: string[]
}

const CATEGORIES: Category[] = [
  {
    Icon: FileText,
    label: "Phân tích tài liệu",
    prompts: [
      "Tóm tắt nội dung chính của file tôi vừa upload",
      "Trích xuất tất cả số liệu và bảng biểu trong tài liệu này",
      "So sánh hai file PDF và tìm điểm khác nhau",
      "Chuyển bảng dữ liệu CSV này thành báo cáo phân tích",
      "Tìm tất cả các điều khoản quan trọng trong hợp đồng này",
      "Dịch tài liệu này sang tiếng Việt và giữ nguyên định dạng",
      "Tóm tắt 3 điểm chính từ file Word này trong 5 câu",
      "Phân tích sentiment của các đánh giá khách hàng trong file",
      "Tạo mind map từ nội dung tài liệu này",
      "Trả lời câu hỏi dựa trên nội dung file tôi đã upload",
    ],
  },
  {
    Icon: Globe,
    label: "Tìm kiếm web",
    prompts: [
      "Tìm thông tin mới nhất về AI và LLM năm 2025",
      "So sánh giá iPhone 16 Pro và Samsung S25 Ultra hiện tại",
      "Tìm các startup AI nổi bật nhất quý này",
      "Thời tiết Hà Nội tuần tới như thế nào?",
      "Tỷ giá USD/VND hôm nay là bao nhiêu?",
      "Tìm kiếm review laptop gaming tốt nhất dưới 30 triệu",
      "Cập nhật tin tức chứng khoán Việt Nam hôm nay",
      "Tìm các khoá học lập trình Python miễn phí chất lượng",
      "Tìm hiểu về chính sách visa Nhật Bản cho người Việt",
      "Các framework JavaScript phổ biến nhất 2025 là gì?",
    ],
  },
  {
    Icon: Terminal,
    label: "Chạy code",
    prompts: [
      "Viết script Python đọc CSV và vẽ biểu đồ cột",
      "Tạo script bash tự động backup thư mục mỗi ngày",
      "Viết hàm Python tính toán chuỗi Fibonacci hiệu quả",
      "Scrape dữ liệu từ một trang web bằng Python requests",
      "Tạo REST API đơn giản với FastAPI và chạy thử",
      "Viết script đổi tên hàng loạt file trong thư mục",
      "Phân tích log Nginx và tìm IP truy cập nhiều nhất",
      "Tạo bot Telegram đơn giản bằng Python",
      "Viết unit test cho hàm Python với pytest",
      "Tối ưu đoạn SQL query này cho nhanh hơn",
    ],
  },
  {
    Icon: BarChart2,
    label: "Tạo biểu đồ",
    prompts: [
      "Vẽ biểu đồ so sánh GDP các nước Đông Nam Á 2020–2024",
      "Tạo pie chart phân bổ ngân sách marketing theo kênh",
      "Vẽ line chart xu hướng doanh thu theo tháng",
      "Tạo heatmap tương quan giữa các biến dữ liệu",
      "Vẽ biểu đồ dân số Việt Nam theo độ tuổi",
      "Tạo flowchart kiến trúc microservices",
      "Vẽ sequence diagram luồng đăng nhập OAuth2",
      "Tạo biểu đồ Gantt cho dự án 3 tháng",
      "Vẽ radar chart so sánh năng lực của 5 ứng viên",
      "Tạo mind map các khái niệm cốt lõi của machine learning",
    ],
  },
  {
    Icon: Sparkles,
    label: "Giải thích khái niệm",
    prompts: [
      "Giải thích Transformer architecture bằng ví dụ đơn giản",
      "RAG là gì và khi nào nên dùng thay vì fine-tuning?",
      "Giải thích CAP theorem cho người mới học distributed systems",
      "Sự khác nhau giữa TCP và UDP là gì?",
      "Docker và VM khác nhau như thế nào, dùng cái nào?",
      "Giải thích khái niệm event loop trong JavaScript",
      "SOLID principles là gì, cho ví dụ thực tế",
      "Cơ chế hoạt động của HTTPS và TLS handshake",
      "Giải thích attention mechanism trong deep learning",
      "GraphQL vs REST — nên chọn cái nào cho dự án mới?",
    ],
  },
]

export function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  const [picked, setPicked] = useState(() =>
    CATEGORIES.map((cat) => ({ ...cat, prompt: cat.prompts[0] }))
  )

  useEffect(() => {
    setPicked(CATEGORIES.map((cat) => ({
      ...cat,
      prompt: cat.prompts[Math.floor(Math.random() * cat.prompts.length)],
    })))
  }, [])

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
        {picked.map(({ Icon, label, prompt }) => (
          <button
            key={label}
            onClick={() => onSend(prompt)}
            className="group bg-white hover:bg-[#5661f6] rounded-2xl p-4 text-left shadow-sm border border-gray-100/80 hover:border-[#5661f6] hover:shadow-lg hover:shadow-[#5661f6]/15 transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div className="size-6 rounded-lg bg-[#EEF0FF] group-hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
                <Icon className="size-3.5 text-[#5661f6] group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] font-semibold text-[#5661f6]/70 group-hover:text-white/60 uppercase tracking-wide transition-colors">
                {label}
              </span>
            </div>
            <p className="text-[12px] font-medium text-gray-700 group-hover:text-white leading-[17px] transition-colors line-clamp-3">
              {prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
