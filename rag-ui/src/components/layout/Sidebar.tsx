// src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { 
  MessageSquare, 
  Database, 
  FileUp, 
  ShieldCheck, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  BarChart2, 
  FileText,
  Sparkles,
  Cpu
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/chat', label: 'FixedRAG Chat', icon: <MessageSquare size={20} />, roles: ['system_admin', 'domain_admin', 'contributor', 'reader'] },
  { to: '/domains', label: 'Domain Config', icon: <Database size={20} />, roles: ['system_admin', 'domain_admin'] },
  { to: '/documents', label: 'Knowledge Base', icon: <FileUp size={20} />, roles: ['system_admin', 'domain_admin', 'contributor'] },
  { to: '/fine-tune', label: 'Fine-Tune Studio', icon: <Cpu size={20} />, roles: ['system_admin', 'domain_admin'] },
  { to: '/admin', label: 'Administration', icon: <ShieldCheck size={20} />, roles: ['system_admin'] },
  { to: '/monitoring', label: 'Telemetry & Infra', icon: <Activity size={20} />, roles: ['system_admin'] },
  { to: '/quality', label: 'Judge LLM Quality', icon: <BarChart2 size={20} />, roles: ['system_admin'] },
  { to: '/logs', label: 'Audit & Query Logs', icon: <FileText size={20} />, roles: ['system_admin'] },
]

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const roles = useAuthStore((s) => s.roles)
  const effectiveRoles = roles.length ? roles : ['reader']

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.some((r) => effectiveRoles.includes(r)))

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col border-r border-white/10 bg-black/60 backdrop-blur-xl transition-all duration-300 z-30 shadow-2xl',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/25">
              <Sparkles className="text-white" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white leading-tight">
                FixedRAG
              </span>
              <span className="text-[10px] text-rose-400 font-mono tracking-wider">
                FIXED SOLUTIONS AI
              </span>
            </div>
          </div>
        )}
        <button 
          onClick={onToggle} 
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors shadow-sm ml-auto"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* Nav list */}
      <nav className="flex-1 p-3 space-y-1.5 mt-3 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 border',
                isActive 
                  ? 'bg-rose-600/20 text-white border-rose-500/40 shadow-lg shadow-rose-500/10' 
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5',
                collapsed && 'justify-center px-0 py-2.5'
              )
            }
          >
            <span className={cn('shrink-0 text-rose-400')}>
              {item.icon}
            </span>
            {!collapsed && <span className="tracking-wide">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      
      {/* Footer system spec */}
      {!collapsed && (
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>FixedRAG Platform</span>
            <span className="text-rose-400 font-bold">v2.5-ENTERPRISE</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
            <Sparkles size={11} className="text-rose-400" />
            <span>Hybrid Retrieval + Fine-Tune</span>
          </div>
        </div>
      )}
    </aside>
  )
}
