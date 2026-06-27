"use client"

import { MessageSquare, Plus, Search, Settings, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const RECENT = [
  "Create Html Game Environment...",
  "Apply To Leave For Emergency",
  "What is UI UX Design?",
  "Create POS System",
  "What Is UX Audit?",
  "Create Chatbot GPT...",
  "How Chat GPT Work?",
]

const LAST_7_DAYS = ["Crypto Landing App Name", "Operator Grammar Types"]

export function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  return (
    <aside className="w-[220px] bg-white flex flex-col h-full shrink-0 border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 pt-7 pb-4">
        <h1 className="text-[11px] font-bold tracking-[0.22em] text-gray-900 uppercase">
          Chat A.I+
        </h1>
      </div>

      {/* Actions */}
      <div className="px-4 pb-5 flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 bg-[#5661f6] text-white rounded-full px-4 py-2 text-[13px] font-medium leading-[18px] hover:bg-[#4550e0] transition-colors"
        >
          <Plus className="size-3.5 shrink-0" />
          New chat
        </button>
        <button className="size-8 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors shrink-0">
          <Search className="size-3.5" />
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <span className="text-[11px] font-medium text-gray-400 tracking-wide">Your conversations</span>
          <button className="text-[11px] font-medium text-[#5661f6] hover:underline">Clear All</button>
        </div>

        <ul>
          {RECENT.map((title, i) => (
            <li key={i}>
              <button
                className={cn(
                  "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                  i === 5
                    ? "bg-[#EEF0FF] text-[#5661f6]"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                )}
              >
                <MessageSquare className="size-3 shrink-0 opacity-60" />
                <span className="truncate leading-[18px]">{title}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="px-2 mt-4 mb-1.5">
          <span className="text-[11px] font-medium text-gray-400 tracking-wide">Last 7 Days</span>
        </div>

        <ul>
          {LAST_7_DAYS.map((title, i) => (
            <li key={i}>
              <button className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                <Clock className="size-3 shrink-0 opacity-60" />
                <span className="truncate leading-[18px]">{title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="px-3 pb-5 pt-3 border-t border-gray-100">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">
          <Settings className="size-3.5 opacity-70" />
          Settings
        </button>
        <div className="flex items-center gap-2.5 px-2 py-1.5 mt-0.5">
          <div className="size-6 rounded-full bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            A
          </div>
          <span className="text-[13px] font-medium text-gray-700 truncate">Andrew Nelson</span>
        </div>
      </div>
    </aside>
  )
}
