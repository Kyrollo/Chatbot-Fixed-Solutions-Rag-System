// src/pages/FineTunePage.tsx
import { useState } from 'react'
import { useDomainStore } from '../store/domainStore'
import { 
  Cpu, 
  Database, 
  Sparkles, 
  Download, 
  FileText, 
  Layers, 
  CheckCircle2, 
  Sliders,
  Play,
  Copy,
  Check
} from 'lucide-react'

interface QAPair {
  id: string
  instruction: string
  input: string
  output: string
  tokens: number
}

const PRESET_CORPUS_TEMPLATES = [
  {
    title: 'PostgreSQL Failover & Disaster Recovery Runbook',
    domain: 'Cloud SRE',
    text: `DOCUMENT: Postgres High Availability & Automated Failover Runbook v4.2
SECTION 1: Patroni & Raft Consensus Failover
When the primary database leader node encounters hardware fault or network partition exceeding 30 seconds, Patroni triggers leader election via etcd/Consul consensus.
Remediation Action:
1. Verify etcd cluster health: 'etcdctl endpoint health'.
2. Confirm standby lag: 'SELECT client_addr, state, sync_state, replay_lag FROM pg_stat_replication;'
3. If failover fails automatically, initiate manual switchover: 'patronictl -c /etc/patroni/db.yml switchover --master db-node-01'.
4. Check pg_rewind replay before rejoining demoted primary as standby node.`,
  },
  {
    title: 'Kubernetes Ingress & TLS Termination Security Policy',
    domain: 'Infrastructure',
    text: `DOCUMENT: Enterprise Kubernetes Ingress Controller Hardening Standard
SECTION 2: Ingress-Nginx mTLS & Cipher Suite Directives
All external endpoints must enforce TLS 1.3 with strict mutual authentication for back-office microservices.
Configuration Directives:
- ssl-ciphers: ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
- ssl-protocols: TLSv1.3
- client-auth-required: true
- HSTS Max-Age: 31536000 with includeSubDomains and preload
Audit verification command: 'nmap --script ssl-enum-ciphers -p 443 api.enterprise.internal'.`,
  },
]

export default function FineTunePage() {
  const { domains, activeDomainId } = useDomainStore()
  const activeDomain = domains.find((d) => d.id === activeDomainId)

  const [inputText, setInputText] = useState(PRESET_CORPUS_TEMPLATES[0].text)
  const [qaPairs, setQaPairs] = useState<QAPair[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [loraRank, setLoraRank] = useState(16)
  const [loraAlpha, setLoraAlpha] = useState(32)
  const [epochs, setEpochs] = useState(3)
  const [learningRate, setLearningRate] = useState('2e-4')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleExtractQAPairs = () => {
    if (!inputText.trim()) return
    setIsExtracting(true)

    // Real parser: splits text into sections and structures Alpaca format QA pairs
    setTimeout(() => {
      const paragraphs = inputText.split('\n\n').filter((p) => p.trim().length > 20)
      const pairs: QAPair[] = paragraphs.map((para, idx) => {
        const lines = para.split('\n').filter((l) => l.trim())
        const firstLine = lines[0] || 'Technical Operational Directive'
        const isAction = para.toLowerCase().includes('action') || para.toLowerCase().includes('remediation')
        
        const instruction = isAction
          ? `Provide the operational resolution procedure for: ${firstLine.replace(/^(DOCUMENT:|SECTION \d+:)/, '').trim()}`
          : `Explain the technical specifications and standards for: ${firstLine.replace(/^(DOCUMENT:|SECTION \d+:)/, '').trim()}`
        
        const input = lines.length > 2 ? lines.slice(0, 2).join(' ') : 'Context: ' + (activeDomain?.name || 'Enterprise System')
        const output = lines.slice(1).join('\n')
        const totalWords = (instruction + input + output).split(/\s+/).length
        const estimatedTokens = Math.round(totalWords * 1.35)

        return {
          id: `qa-${idx + 1}-${Date.now().toString().slice(-4)}`,
          instruction,
          input,
          output,
          tokens: estimatedTokens,
        }
      })

      setQaPairs(pairs)
      setIsExtracting(false)
    }, 400)
  }

  const handleExportJSONL = () => {
    if (qaPairs.length === 0) return
    const jsonlContent = qaPairs
      .map((pair) =>
        JSON.stringify({
          instruction: pair.instruction,
          input: pair.input,
          output: pair.output,
        })
      )
      .join('\n')

    const blob = new Blob([jsonlContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fixedrag-dataset-${activeDomainId || 'general'}-${Date.now()}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyPair = async (pair: QAPair) => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ instruction: pair.instruction, input: pair.input, output: pair.output }, null, 2)
      )
      setCopiedId(pair.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard fallback
    }
  }

  const totalTokens = qaPairs.reduce((acc, p) => acc + p.tokens, 0)

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
              <Cpu size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                FixedRAG Fine-Tune Studio
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Curate instruction datasets from ingested technical solutions and export QLoRA weights for local RTX A5000 fine-tuning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSONL}
              disabled={qaPairs.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-semibold shadow-lg shadow-rose-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              <span>Export QLoRA Dataset ({qaPairs.length} Records)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Text & Presets (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Domain Knowledge Source</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                Alpaca Format
              </span>
            </div>

            {/* Presets */}
            <div>
              <span className="text-xs text-slate-400 block mb-2 font-medium">
                Load Technical Documentation Template:
              </span>
              <div className="flex flex-col gap-2">
                {PRESET_CORPUS_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(tmpl.text)}
                    className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 text-xs text-slate-300 hover:text-white transition text-left"
                  >
                    <span className="font-semibold text-rose-300 block">{tmpl.title}</span>
                    <span className="text-[10px] text-slate-500">Domain: {tmpl.domain}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Source Editor */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                Source Document Text:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={9}
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 leading-relaxed"
                placeholder="Paste technical solutions documentation, runbooks, or SLA clauses here..."
              />
            </div>

            {/* QLoRA Hyperparameters */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Sliders size={14} className="text-rose-400" />
                <span>QLoRA Parameter Config</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">LoRA Rank (r)</label>
                  <select
                    value={loraRank}
                    onChange={(e) => setLoraRank(Number(e.target.value))}
                    className="w-full p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-slate-200 focus:outline-none"
                  >
                    <option value={8}>r = 8 (Fast)</option>
                    <option value={16}>r = 16 (Standard)</option>
                    <option value={32}>r = 32 (Deep)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">LoRA Alpha</label>
                  <select
                    value={loraAlpha}
                    onChange={(e) => setLoraAlpha(Number(e.target.value))}
                    className="w-full p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-slate-200 focus:outline-none"
                  >
                    <option value={16}>alpha = 16</option>
                    <option value={32}>alpha = 32 (2x)</option>
                    <option value={64}>alpha = 64 (4x)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Training Epochs</label>
                  <input
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(Number(e.target.value))}
                    className="w-full p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Learning Rate</label>
                  <input
                    type="text"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    className="w-full p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleExtractQAPairs}
              disabled={isExtracting || !inputText.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold text-xs transition shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <Sparkles size={14} className="animate-spin text-white" />
                  <span>Tokenizing &amp; Compiling QA Pairs...</span>
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current text-white" />
                  <span>Synthesize QA Training Pairs</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Dataset Explorer & Statistics (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3.5 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 block mb-0.5">Instruction Records</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-white text-base">
                <Database size={15} className="text-rose-400" />
                <span>{qaPairs.length}</span>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 block mb-0.5">Estimated Tokens</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-rose-400 text-base">
                <Layers size={15} className="text-rose-400" />
                <span>{totalTokens}</span>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 block mb-0.5">Target Architecture</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-400 text-base">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>NF4 QLoRA</span>
              </div>
            </div>
          </div>

          {/* Records List */}
          <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Extracted Dataset Samples ({qaPairs.length})
              </h3>
              {qaPairs.length > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">
                  Ready for TuneForge / Ollama export
                </span>
              )}
            </div>

            {qaPairs.length > 0 ? (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {qaPairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="p-4 rounded-xl bg-black/60 border border-white/5 space-y-2 text-xs relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {pair.id} • ~{pair.tokens} tokens
                      </span>
                      <button
                        onClick={() => handleCopyPair(pair)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition px-2 py-0.5 rounded bg-white/5"
                      >
                        {copiedId === pair.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                        <span>{copiedId === pair.id ? 'Copied JSON' : 'Copy'}</span>
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">Instruction:</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{pair.instruction}</p>
                    </div>

                    {pair.input && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">Input Context:</span>
                        <p className="text-slate-400 mt-0.5 font-mono text-[11px]">{pair.input}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">Expected Output:</span>
                      <p className="text-slate-300 mt-0.5 font-mono text-[11px] whitespace-pre-wrap bg-black/40 p-2.5 rounded-lg border border-white/5">
                        {pair.output}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl bg-black/40 border border-white/5 text-slate-500 space-y-3">
                <Cpu size={36} className="text-slate-700 mx-auto" />
                <p className="text-xs">
                  Load technical documentation on the left and synthesize QA training pairs to curate a high-precision QLoRA dataset.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
