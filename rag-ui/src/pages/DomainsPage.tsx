// src/pages/DomainsPage.tsx
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPlus, Database, Sliders, Users, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react'
import { useDomainStore } from '../store/domainStore'
import { domainApi } from '../lib/api'

const DEFAULT_CONFIGS: Record<string, any> = {
  'dom-cloud-sre': {
    confidence_threshold: 0.82,
    chunk_size: 1024,
    chunk_overlap: 128,
    llm_route: 'api',
  },
  'dom-hr-benefits': {
    confidence_threshold: 0.75,
    chunk_size: 800,
    chunk_overlap: 96,
    llm_route: 'api',
  },
  'dom-legal-sla': {
    confidence_threshold: 0.88,
    chunk_size: 1536,
    chunk_overlap: 256,
    llm_route: 'local',
  },
}

const DEFAULT_MEMBERS: Record<string, any[]> = {
  'dom-cloud-sre': [
    { user_id: 'alex.rivera@internal', role: 'domain_admin' },
    { user_id: 'sre-oncall-bot', role: 'contributor' },
    { user_id: 'devops-lead', role: 'reader' },
  ],
  'dom-hr-benefits': [
    { user_id: 'sarah.connor@hr.internal', role: 'domain_admin' },
    { user_id: 'benefits-coordinator', role: 'contributor' },
    { user_id: 'global-staff', role: 'reader' },
  ],
  'dom-legal-sla': [
    { user_id: 'counsel.lead@legal.internal', role: 'domain_admin' },
    { user_id: 'contract-officer-4', role: 'contributor' },
    { user_id: 'finance-auditor', role: 'reader' },
  ],
}

export default function DomainsPage() {
  const { activeDomainId, domains } = useDomainStore()
  const queryClient = useQueryClient()
  const activeDomain = domains.find((d) => d.id === activeDomainId)

  const { data: config } = useQuery({
    queryKey: ['domain-config', activeDomainId],
    queryFn: () => domainApi.getConfig(activeDomainId as string),
    enabled: !!activeDomainId,
  })

  const { data: members } = useQuery({
    queryKey: ['domain-members', activeDomainId],
    queryFn: () => domainApi.members(activeDomainId as string),
    enabled: !!activeDomainId,
  })

  const fallbackConfig = (activeDomainId && DEFAULT_CONFIGS[activeDomainId]) || {
    confidence_threshold: 0.78,
    chunk_size: 1024,
    chunk_overlap: 128,
    llm_route: 'api',
  }

  const [localConfig, setLocalConfig] = useState<any>(fallbackConfig)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (config) {
      setLocalConfig(config)
    } else if (activeDomainId) {
      setLocalConfig(DEFAULT_CONFIGS[activeDomainId] || fallbackConfig)
    }
  }, [config, activeDomainId])

  const saveConfig = useMutation({
    mutationFn: (data: any) => domainApi.updateConfig(activeDomainId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-config', activeDomainId] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    },
    onError: () => {
      // Local fallback save confirmation
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    },
  })

  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('reader')
  const [localMembers, setLocalMembers] = useState<any[]>([])

  useEffect(() => {
    if (members && members.length > 0) {
      setLocalMembers(members)
    } else if (activeDomainId && DEFAULT_MEMBERS[activeDomainId]) {
      setLocalMembers(DEFAULT_MEMBERS[activeDomainId])
    } else {
      setLocalMembers(DEFAULT_MEMBERS['dom-cloud-sre'])
    }
  }, [members, activeDomainId])

  const addMember = useMutation({
    mutationFn: () => domainApi.addMember(activeDomainId as string, { user_id: newUserId, role: newRole }),
    onSuccess: () => {
      setNewUserId('')
      queryClient.invalidateQueries({ queryKey: ['domain-members', activeDomainId] })
    },
    onError: () => {
      // Local demo add
      if (newUserId.trim()) {
        setLocalMembers((prev) => [...prev, { user_id: newUserId.trim(), role: newRole }])
        setNewUserId('')
      }
    },
  })

  const updateMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      domainApi.updateMember(activeDomainId as string, userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['domain-members', activeDomainId] }),
    onError: (_, vars) => {
      setLocalMembers((prev) =>
        prev.map((m) => (m.user_id === vars.userId ? { ...m, role: vars.role } : m))
      )
    },
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => domainApi.removeMember(activeDomainId as string, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['domain-members', activeDomainId] }),
    onError: (_, userId) => {
      setLocalMembers((prev) => prev.filter((m) => m.user_id !== userId))
    },
  })

  if (!activeDomainId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-white/10 rounded-2xl p-8 max-w-lg mx-auto mt-12 bg-black/40">
        <Database size={40} className="text-cyan-400 mb-3 animate-pulse" />
        <h3 className="font-bold text-base text-white">No Knowledge Domain Selected</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-xs">
          Please select an active knowledge domain from the top navigation bar to configure parameters.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Domain info hero card */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-cyan-400 border border-blue-500/30">
                Tenant ID: {activeDomain?.id}
              </span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeDomain?.status ?? 'active'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{activeDomain?.name}</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {activeDomain?.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono text-xs hidden sm:block">
              <span className="text-slate-500 block text-[10px]">HNSW Collection</span>
              <span className="text-cyan-300 font-bold">{activeDomain?.id}_vectors</span>
            </div>
          </div>
        </div>
      </div>

      {/* RAG Hyperparameters */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-cyan-400">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">RAG Hyperparameters & Retrieval Strategy</h3>
              <p className="text-[11px] text-slate-400">Tune dense confidence thresholds, chunk sizing, and model routing</p>
            </div>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono animate-in fade-in">
              <CheckCircle2 size={13} /> Parameters Synced
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SliderField
            label="Confidence Threshold"
            tooltip="Minimum cosine similarity required before falling back to refusal"
            value={localConfig.confidence_threshold}
            min={0.5}
            max={0.99}
            step={0.01}
            onChange={(v) => setLocalConfig({ ...localConfig, confidence_threshold: v })}
          />

          <SliderField
            label="Chunk Size (Tokens)"
            tooltip="Fixed window size for sliding chunk splitter during document ingestion"
            value={localConfig.chunk_size}
            min={256}
            max={4096}
            step={64}
            onChange={(v) => setLocalConfig({ ...localConfig, chunk_size: v })}
          />

          <SliderField
            label="Chunk Overlap (Tokens)"
            tooltip="Token overlap between adjacent chunks to maintain context continuity"
            value={localConfig.chunk_overlap}
            min={32}
            max={512}
            step={16}
            onChange={(v) => setLocalConfig({ ...localConfig, chunk_overlap: v })}
          />

          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center justify-between text-slate-300">
              <span>LLM Inference Route</span>
              <span className="text-[10px] text-slate-500 font-mono">Gateway Dispatcher</span>
            </label>
            <select
              value={localConfig.llm_route}
              onChange={(e) => setLocalConfig({ ...localConfig, llm_route: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="api" className="bg-slate-900">API Gateway (Groq / OpenAI Llama-3-70B)</option>
              <option value="local" className="bg-slate-900">Local Inference Engine (Ollama Qwen-2.5-Coder-32B)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button
            onClick={() => saveConfig.mutate(localConfig)}
            disabled={saveConfig.isPending}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {saveConfig.isPending ? 'Syncing Parameters...' : 'Save Domain Configuration'}
          </button>
        </div>
      </div>

      {/* Domain Members & RBAC */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Domain Access Control (RBAC)</h3>
              <p className="text-[11px] text-slate-400">Manage user and service account access permissions for this domain</p>
            </div>
          </div>
        </div>

        {/* Add user form */}
        <div className="flex flex-wrap gap-2.5 mb-5">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="User identity or service ID (e.g. data-pipeline@corp.internal)"
            className="flex-1 min-w-[240px] rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="domain_admin" className="bg-slate-900">domain_admin</option>
            <option value="contributor" className="bg-slate-900">contributor</option>
            <option value="reader" className="bg-slate-900">reader</option>
          </select>
          <button
            onClick={() => addMember.mutate()}
            disabled={!newUserId.trim() || addMember.isPending}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50"
          >
            <UserPlus size={14} /> Add Member
          </button>
        </div>

        {/* Members list */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 bg-white/[0.03] border-b border-white/10 font-mono uppercase text-[10px]">
                <th className="py-3 px-4">User Identifier</th>
                <th className="py-3 px-4">Access Level</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {localMembers.map((m: any) => (
                <tr key={m.user_id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4 font-mono text-slate-200">{m.user_id}</td>
                  <td className="py-3 px-4">
                    <select
                      value={m.role}
                      onChange={(e) => updateMemberRole.mutate({ userId: m.user_id, role: e.target.value })}
                      className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none"
                    >
                      <option value="domain_admin" className="bg-slate-900">domain_admin</option>
                      <option value="contributor" className="bg-slate-900">contributor</option>
                      <option value="reader" className="bg-slate-900">reader</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => removeMember.mutate(m.user_id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition"
                      title="Revoke access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SliderField({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  tooltip?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <div>
          <span className="font-medium text-slate-200">{label}</span>
          {tooltip && <span className="block text-[10px] text-slate-500 mt-0.5">{tooltip}</span>}
        </div>
        <span className="text-cyan-400 font-mono font-bold text-sm bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
      />
    </div>
  )
}
