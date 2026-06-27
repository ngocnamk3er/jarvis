import { Globe, Zap, AlertTriangle, ArrowRight } from "lucide-react"

const CAPABILITIES = [
  {
    Icon: Globe,
    title: "Explore",
    desc: "Learn how to use chat ai platform for your needs",
  },
  {
    Icon: Zap,
    title: "Capabilities",
    desc: "How much capable chat.ai to full fill your needs",
  },
  {
    Icon: AlertTriangle,
    title: "Limitation",
    desc: "How much capable chat.ai to full fill your needs",
  },
]

const EXAMPLES = [
  { label: '"Explain"', desc: 'Quantum computing in simple terms' },
  { label: '"How to"', desc: "Make a search engine platform like google" },
  { label: '"Remember"', desc: 'Quantum computing in simple terms' },
  { label: '"Allows"', desc: "User to provide follow-up corrections" },
  { label: '"May"', desc: "Occasionally generate incorrect information" },
  { label: '"Limited"', desc: "Knowledge of world and events after 2021" },
]

export function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-10 py-10 overflow-y-auto">
      <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400 mb-3 uppercase">
        Jarvis
      </p>
      <h2 className="text-[28px] font-bold text-gray-900 mb-10 text-center leading-tight tracking-tight">
        Good day! How may I assist you today?
      </h2>

      <div className="flex gap-3 w-full max-w-[680px]">
        {/* Dark capability cards */}
        <div className="flex flex-col gap-3 w-[160px] shrink-0">
          {CAPABILITIES.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-gray-900 text-white rounded-2xl p-4">
              <Icon className="size-4 mb-2.5 opacity-80" />
              <p className="text-[13px] font-semibold mb-1 leading-[18px]">{title}</p>
              <p className="text-[11px] text-gray-400 leading-[16px]">{desc}</p>
            </div>
          ))}
        </div>

        {/* Example prompt cards */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          {EXAMPLES.map(({ label, desc }) => (
            <button
              key={label}
              onClick={() => onSend(desc)}
              className="bg-white rounded-2xl p-4 text-left hover:shadow-md transition-all shadow-sm flex flex-col justify-between group min-h-[86px]"
            >
              <div>
                <p className="text-[13px] font-semibold text-gray-900 mb-1 leading-[18px]">{label}</p>
                <p className="text-[11px] text-gray-500 leading-[16px]">{desc}</p>
              </div>
              <ArrowRight className="size-3.5 text-gray-300 group-hover:text-[#5661f6] mt-2 transition-colors self-end" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
