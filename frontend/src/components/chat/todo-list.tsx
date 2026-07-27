"use client"

import { Circle, CircleDot, CircleCheck } from "lucide-react"
import { Todo } from "@/types/chat"

export function TodoList({ todos }: { todos: Todo[] }) {
  if (!todos.length) return null

  return (
    <div className="py-1 mb-1">
      <div className="rounded-xl border border-[#E0E7FF] bg-[#F7F8FF] px-3.5 py-3 space-y-1.5">
        {todos.map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            {t.status === "completed" && (
              <CircleCheck className="size-3.5 text-[#5661f6] shrink-0 mt-[2px]" />
            )}
            {t.status === "in_progress" && (
              <CircleDot className="size-3.5 text-[#5661f6] shrink-0 mt-[2px] animate-pulse" />
            )}
            {t.status === "pending" && (
              <Circle className="size-3.5 text-gray-300 shrink-0 mt-[2px]" />
            )}
            <span
              className={`text-[13px] leading-[19px] ${
                t.status === "completed"
                  ? "text-gray-400 line-through"
                  : t.status === "in_progress"
                    ? "text-gray-800 font-medium"
                    : "text-gray-500"
              }`}
            >
              {t.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
