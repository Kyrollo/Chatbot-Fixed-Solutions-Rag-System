// src/components/layout/Header.tsx
import { useEffect, useState } from 'react'
import { Moon, Sun, LogOut, Activity, Database, User, Shield, Layers, Radio } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useDomainStore } from '../../store/domainStore'
import { useNavigate } from 'react-router-dom'
import { healthApi } from '../../lib/api'

const SERVICES = [
  { label: 'Domain Gateway', path: '/domains' },
  { label: 'Ingest & OCR', path: '/ingest' },
  { label: 'Hybrid Retrieval', path: '/retrieve' },
  { label: 'LLM Judge', path: '/evaluate' },
]

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

export default function Header() {
  const { dark, toggle } = useTheme()
  const { username, email, roles, logout, isDemo } = useAuthStore()
  const { domains, activeDomainId, setActiveDomain } = useDomainStore()
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState<Record<string, boolean>>({
    'Domain Gateway': true,
    'Ingest & OCR': true,
    'Hybrid Retrieval': true,
    'LLM Judge': true,
  })

  useEffect(() => {
    let mounted = true
    async function check() {
      const results: Record<string, boolean> = {}
      for (const s of SERVICES) {
        try {
          const ok = await healthApi.check(s.path)
          results[s.label] = isDemo ? true : ok
        } catch {
          results[s.label] = isDemo ? true : false
        }
      }
      if (mounted) setStatuses(results)
    }
    check()
    const id = setInterval(check, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [isDemo])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeDomain = domains.find((d) => d.id === activeDomainId)

  return (
    <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 gap-4 bg-black/40 backdrop-blur-xl sticky top-0 z-20">
      {/* Domain Selector */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <Database size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 font-mono">
            Active Knowledge Domain
          </span>
          <select
            value={activeDomainId ?? ''}
            onChange={(e) => setActiveDomain(e.target.value)}
            className="text-sm font-semibold text-white bg-slate-900/80 border border-white/10 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer hover:border-rose-500/40 transition max-w-[280px] sm:max-w-md truncate"
          >
            {domains.length === 0 && <option value="">No domains configured</option>}
            {domains.map((d) => (
              <option key={d.id} value={d.id} className="bg-slate-950 text-white">
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Microservices Live Status Pill */}
        <div className="hidden lg:flex items-center gap-4 border-r border-white/10 pr-5">
          {SERVICES.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-300"
              title={`${s.label} status`}
            >
              <span
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  statuses[s.label]
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                }`}
              />
              {s.label}
            </div>
          ))}
          <Radio size={15} className="text-cyan-400 animate-pulse" />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition shadow-sm"
          title="Toggle theme"
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* User badge */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-cyan-300">
            <User size={18} />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold leading-tight text-white flex items-center gap-1.5">
              <span>{username ?? 'Enterprise User'}</span>
              {isDemo && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  DEMO
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 leading-tight mt-0.5 font-mono truncate max-w-[150px]">
              {email ?? 'user@fixed-solutions-rag.internal'}
            </div>
          </div>

          <div className="hidden sm:flex gap-1 ml-1">
            {roles.slice(0, 1).map((r) => (
              <span
                key={r}
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono"
              >
                {r.replace('_', ' ')}
              </span>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-red-500/15 text-slate-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition shadow-sm ml-1"
            title="Sign Out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  )
}
