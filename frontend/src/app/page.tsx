import { Suspense } from "react"
import { ChatWindow } from "@/components/chat/chat-window"

export default function Home() {
  return (
    <Suspense>
      <ChatWindow />
    </Suspense>
  )
}
