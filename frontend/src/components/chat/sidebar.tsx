"use client"

import { MessageSquare, Plus, Search, Settings, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Conversation } from "@/types/chat"

type Props = {
  conversations: Conversation[]
  activeId: string | null
  loadingThreadIds: ReadonlySet<string>
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function Sidebar({ conversations, activeId, loadingThreadIds, onNewChat, onSelect, onDelete }: Props) {
  return (
    <aside className="w-[220px] bg-white flex flex-col h-full shrink-0 border-r border-gray-100">
      <div className="px-5 pt-7 pb-4">
        <h1 className="text-[11px] font-bold tracking-[0.22em] text-gray-900 uppercase">Jarvis</h1>
      </div>

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

      <div className="flex-1 overflow-y-auto px-3">
        {conversations.length > 0 && (
          <>
            <div className="px-2 mb-1.5">
              <span className="text-[11px] font-medium text-gray-400 tracking-wide">Conversations</span>
            </div>
            <ul>
              {conversations.map((conv) => {
                const isLoading = loadingThreadIds.has(conv.id)
                return (
                  <li key={conv.id} className="group relative">
                    <button
                      onClick={() => onSelect(conv.id)}
                      className={cn(
                        "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-colors pr-7",
                        conv.id === activeId
                          ? "bg-[#EEF0FF] text-[#5661f6]"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      )}
                    >
                      {isLoading
                        ? <SpinnerIcon className={cn("size-3 shrink-0", conv.id === activeId ? "text-[#5661f6]" : "text-gray-400")} />
                        : <MessageSquare className="size-3 shrink-0 opacity-60" />
                      }
                      <span className="truncate leading-[18px]">{conv.title}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-500 text-gray-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {conversations.length === 0 && (
          <p className="px-2 text-[12px] text-gray-400 mt-2">No conversations yet</p>
        )}
      </div>

      <div className="px-3 pb-5 pt-3 border-t border-gray-100">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">
          <Settings className="size-3.5 opacity-70" />
          Settings
        </button>
        <div className="flex items-center gap-2.5 px-2 py-1.5 mt-0.5">
          <div className="size-6 rounded-full bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">N</div>
          <span className="text-[13px] font-medium text-gray-700 truncate">Nam Nguyen</span>
        </div>
      </div>
    </aside>
  )
}
