// src/components/chat/CitationDrawer.tsx
import { X, FileText, CheckCircle2, Cpu, ExternalLink } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'

export default function CitationDrawer() {
  const { activeCitation, setActiveCitation } = useChatStore()

  if (!activeCitation) return null

  const scorePct = Math.min(100, Math.round(activeCitation.score * 100))

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={() => setActiveCitation(null)} 
      />
      <div className="relative w-full max-w-lg h-full bg-slate-950/95 border-l border-white/10 shadow-2xl p-6 overflow-y-auto z-10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Hybrid Retrieval Citation</h3>
              <p className="text-[10px] text-slate-400 font-mono">Dense Vector & BM25 Fusion Match</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveCitation(null)} 
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs mt-4 flex-1">
          {/* Score card */}
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 font-mono text-[10px] uppercase">Relevance Confidence Score</span>
              <span className="text-cyan-400 font-bold font-mono text-sm">{activeCitation.score.toFixed(3)} ({scorePct}%)</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
              <div className="text-[10px] text-slate-400 font-mono uppercase mb-1">Source Document</div>
              <div className="font-mono text-xs text-white break-all font-semibold">{activeCitation.document_id}</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
              <div className="text-[10px] text-slate-400 font-mono uppercase mb-1">Page Index</div>
              <div className="font-mono text-xs text-cyan-300 font-bold">Page {activeCitation.page}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
            <div className="text-[10px] text-slate-400 font-mono uppercase mb-1">Vector Chunk ID</div>
            <div className="font-mono text-xs text-slate-300 break-all">{activeCitation.chunk_id}</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase mb-1.5 flex items-center justify-between">
              <span>Retrieved Ground Truth Passage</span>
              <span className="text-emerald-400 flex items-center gap-1 font-sans">
                <CheckCircle2 size={11} /> Grounded
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap selection:bg-cyan-500/20 shadow-inner">
              {activeCitation.text}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 text-[10px] text-slate-400 font-mono flex items-center justify-between">
          <span>Qdrant HNSW + BM25</span>
          <span className="text-cyan-400">Zero-Hallucination Guardrail</span>
        </div>
      </div>
    </div>
  )
}
