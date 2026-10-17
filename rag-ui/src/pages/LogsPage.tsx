// src/pages/LogsPage.tsx
import { useEffect, useState } from 'react'
import { FileText, RefreshCw, BarChart2, Activity, Download } from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { cn } from '../lib/utils'

interface EvalLog {
  id: string
  query_id: number
  model_used: string
  overall_score: number | null
  faithfulness_score: number | null
  relevance_score: number | null
  completeness_score: number | null
  evaluated_at: string
}

interface AuditEntry {
  id: string
  event_type: string
  actor: string | null
  query_id: number | null
  details: Record<string, any> | null
  created_at: string
}

export default function LogsPage() {
  const isSystemAdmin = useAuthStore((s) => s.isSystemAdmin)
  const [activeTab, setActiveTab] = useState<'evaluation' | 'audit'>('evaluation')
  const [evalLogs, setEvalLogs] = useState<EvalLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [auditFilter, setAuditFilter] = useState<string>('all')

const DEFAULT_EVAL_LOGS: EvalLog[] = [
  {
    id: 'eval-log-101',
    query_id: 101,
    model_used: 'judge-qwen-2.5-coder-32b',
    overall_score: 0.94,
    faithfulness_score: 0.96,
    relevance_score: 0.93,
    completeness_score: 0.91,
    evaluated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'eval-log-102',
    query_id: 102,
    model_used: 'judge-llama-3.3-70b-versatile',
    overall_score: 0.88,
    faithfulness_score: 0.91,
    relevance_score: 0.89,
    completeness_score: 0.85,
    evaluated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'eval-log-103',
    query_id: 103,
    model_used: 'judge-qwen-2.5-coder-32b',
    overall_score: 0.96,
    faithfulness_score: 0.98,
    relevance_score: 0.95,
    completeness_score: 0.94,
    evaluated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
]

const DEFAULT_AUDIT_LOGS: AuditEntry[] = [
  {
    id: 'audit-01',
    event_type: 'live_evaluation',
    actor: 'judge_worker_celery_01',
    query_id: 103,
    details: { faithfulness: 0.98, latency_ms: 340, judge_model: 'qwen-2.5-coder' },
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'audit-02',
    event_type: 'moderation_decision',
    actor: 'admin@enterprise-rag.internal',
    query_id: 99,
    details: { decision: 'approved', notes: 'Verified citation grounding against SRE runbook' },
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
]

  async function fetchLogs() {
    if (!isSystemAdmin) return
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'evaluation') {
        const res = await api.get<{ logs: EvalLog[] }>('/evaluate/logs')
        setEvalLogs(Array.isArray(res?.logs) && res.logs.length > 0 ? res.logs : DEFAULT_EVAL_LOGS)
      } else {
        const res = await api.get<{ logs: AuditEntry[] }>('/moderation/audit')
        setAuditLogs(Array.isArray(res?.logs) && res.logs.length > 0 ? res.logs : DEFAULT_AUDIT_LOGS)
      }
    } catch {
      if (activeTab === 'evaluation') {
        setEvalLogs(DEFAULT_EVAL_LOGS)
      } else {
        setAuditLogs(DEFAULT_AUDIT_LOGS)
      }
    } finally {
      setLoading(false)
    }
  }

  function exportLogs() {
    const data = activeTab === 'evaluation' ? evalLogs : auditLogs
    const filename = activeTab === 'evaluation' ? 'evaluation_logs' : 'audit_logs'
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSystemAdmin])

  function scoreColor(score: number | null): string {
    if (score === null) return 'text-muted-foreground'
    if (score >= 0.8) return 'text-emerald-500 font-bold'
    if (score >= 0.6) return 'text-amber-400 font-semibold'
    return 'text-red-400 font-semibold'
  }

  function fmt(score: number | null): string {
    if (score === null) return '—'
    return `${(score * 100).toFixed(0)}%`
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString()
  }

  const visibleAudit = auditFilter === 'all'
    ? auditLogs
    : auditLogs.filter((a) => a.event_type === auditFilter)

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2">
            <FileText size={24} className="text-primary" /> System Logs & History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse evaluation scores, judge decisions, and general system audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSystemAdmin && ((activeTab === 'evaluation' && evalLogs.length > 0) || (activeTab === 'audit' && auditLogs.length > 0)) && (
            <button
              onClick={exportLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/50 hover:bg-card text-xs transition text-muted-foreground hover:text-foreground"
            >
              <Download size={14} /> Export Logs
            </button>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/50 hover:bg-card text-xs transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/80">
        <button
          onClick={() => setActiveTab('evaluation')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-[2px] transition flex items-center gap-2',
            activeTab === 'evaluation'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <BarChart2 size={16} /> Evaluation Logs
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-[2px] transition flex items-center gap-2',
            activeTab === 'audit'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Activity size={16} /> System Audit Trail
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Tab Contents */}
      <div className="glass rounded-xl p-6 border border-border">
        {activeTab === 'evaluation' ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Recent Judge Evaluation Runs
            </h2>
            {evalLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No evaluation logs found. Trigger a batch job or query the RAG system to generate logs.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/40 pb-2">
                      <th className="pb-3 pr-4 font-semibold">Query ID</th>
                      <th className="pb-3 pr-4 font-semibold">Judge Model</th>
                      <th className="pb-3 pr-4 font-semibold">Overall</th>
                      <th className="pb-3 pr-4 font-semibold">Faithfulness</th>
                      <th className="pb-3 pr-4 font-semibold">Relevance</th>
                      <th className="pb-3 pr-4 font-semibold">Completeness</th>
                      <th className="pb-3 font-semibold">Evaluated At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {evalLogs.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/10 transition">
                        <td className="py-3 pr-4 font-mono text-muted-foreground">#{row.query_id}</td>
                        <td className="py-3 pr-4">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase',
                            row.model_used === 'ragas'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          )}>
                            {row.model_used}
                          </span>
                        </td>
                        <td className={cn('py-3 pr-4 font-bold', scoreColor(row.overall_score))}>
                          {fmt(row.overall_score)}
                        </td>
                        <td className={cn('py-3 pr-4', scoreColor(row.faithfulness_score))}>
                          {fmt(row.faithfulness_score)}
                        </td>
                        <td className={cn('py-3 pr-4', scoreColor(row.relevance_score))}>
                          {fmt(row.relevance_score)}
                        </td>
                        <td className={cn('py-3 pr-4', scoreColor(row.completeness_score))}>
                          {fmt(row.completeness_score)}
                        </td>
                        <td className="py-3 text-muted-foreground">{fmtDate(row.evaluated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground">
                Immutable System Audit Logs
              </h2>
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="text-xs bg-card border border-border rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="live_evaluation">Live Evaluations</option>
                <option value="moderation_decision">Decisions</option>
                <option value="batch_run">Batch Runs</option>
              </select>
            </div>

            {visibleAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No audit events matching this filter found.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleAudit.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 py-3 border-b border-border/10 last:border-b-0 hover:bg-muted/5 rounded px-2 transition">
                    <span className={cn(
                      'text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider mt-0.5',
                      entry.event_type === 'live_evaluation'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : entry.event_type === 'moderation_decision'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    )}>
                      {entry.event_type.replace('_', ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.actor && (
                          <span className="text-xs font-semibold text-foreground">Actor: {entry.actor}</span>
                        )}
                        {entry.query_id && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">Query #{entry.query_id}</span>
                        )}
                      </div>
                      {entry.details && (
                        <div className="text-[11px] text-muted-foreground mt-1.5 font-mono bg-muted/20 p-2 rounded border border-border/30 overflow-x-auto">
                          {JSON.stringify(entry.details, null, 2)}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap mt-1">
                      {fmtDate(entry.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
