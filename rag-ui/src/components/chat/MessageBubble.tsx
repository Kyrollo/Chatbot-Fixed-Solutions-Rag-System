// src/components/chat/MessageBubble.tsx
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage, useChatStore } from '../../store/chatStore'
import { cn } from '../../lib/utils'
import { FileText, Copy, Check, Maximize2, Minimize2 } from 'lucide-react'

// Replaces [1], [2] tokens with clickable citation buttons
function renderWithCitations(content: string, msg: ChatMessage, onCite: (idx: number) => void) {
  const parts = content.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match && msg.citations) {
      const idx = parseInt(match[1], 10) - 1
      if (msg.citations[idx]) {
        return (
          <button
            key={i}
            onClick={() => onCite(idx)}
            title={`View Source Citation ${match[1]}: ${msg.citations[idx].document_id}`}
            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold mx-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition align-middle shadow-sm cursor-pointer"
          >
            <FileText size={10} className="inline" />
            <span>Ref {match[1]}</span>
          </button>
        )
      }
    }
    return <span key={i}>{part}</span>
  })
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const setActiveCitation = useChatStore((s) => s.setActiveCitation)
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  function handleCite(idx: number) {
    if (message.citations?.[idx]) setActiveCitation(message.citations[idx])
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard fallback
    }
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed transition-all shadow-md group relative',
          isUser
            ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white font-medium shadow-rose-500/20 rounded-br-sm'
            : 'bg-slate-900/90 border border-white/10 text-slate-100 backdrop-blur-md rounded-bl-sm shadow-black/40'
        )}
      >
        {!isUser && message.content && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs">
            <span className="font-mono text-[10px] uppercase text-rose-400 font-semibold tracking-wider">
              FixedRAG Synthesis
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                {isExpanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        <div className={cn('overflow-y-auto transition-all', isExpanded ? 'max-h-none' : 'max-h-[500px]')}>
          {message.citations && message.citations.length > 0 ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_h3]:text-rose-400 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-1 [&_ul]:pl-4 [&_li]:my-0.5">
              {renderWithCitations(message.content, message, handleCite)}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_h3]:text-rose-400 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-1 [&_ul]:pl-4 [&_li]:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || (message.streaming ? '...' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {message.streaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-rose-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
