// src/store/domainStore.ts
import { create } from 'zustand'

export interface Domain {
  id: string
  name: string
  description?: string
  status?: string
  role?: string // local role of current user in this domain
}

export const DEFAULT_DOMAINS: Domain[] = [
  {
    id: 'dom-cloud-sre',
    name: 'Cloud Architecture & SRE Runbooks',
    description: 'Kubernetes operational runbooks, incident response playbooks, microservices architecture, and telemetry specs.',
    status: 'active',
    role: 'domain_admin',
  },
  {
    id: 'dom-hr-benefits',
    name: 'HR Policies & Global Benefits',
    description: 'Corporate HR compliance, international travel reimbursement, remote work policies, and employee benefits guide.',
    status: 'active',
    role: 'domain_admin',
  },
  {
    id: 'dom-legal-sla',
    name: 'Legal MSA & Enterprise SLAs',
    description: 'Master services agreements, indemnification clauses, GDPR/HIPAA compliance addendums, and 99.99% SLA liabilities.',
    status: 'active',
    role: 'domain_admin',
  },
]

interface DomainState {
  domains: Domain[]
  activeDomainId: string | null
  setDomains: (domains: Domain[]) => void
  setActiveDomain: (id: string) => void
}

const savedActiveId = localStorage.getItem('active_domain_id')
const initialActiveId = savedActiveId || DEFAULT_DOMAINS[0].id

export const useDomainStore = create<DomainState>((set) => ({
  domains: DEFAULT_DOMAINS,
  activeDomainId: initialActiveId,
  setDomains: (domains) =>
    set((state) => {
      const actualDomains = domains.length > 0 ? domains : DEFAULT_DOMAINS
      const exists = actualDomains.some((d) => d.id === state.activeDomainId)
      const newActiveId = exists ? state.activeDomainId : (actualDomains[0]?.id ?? null)
      if (newActiveId) {
        localStorage.setItem('active_domain_id', newActiveId)
      } else {
        localStorage.removeItem('active_domain_id')
      }
      return {
        domains: actualDomains,
        activeDomainId: newActiveId,
      }
    }),
  setActiveDomain: (id) => {
    localStorage.setItem('active_domain_id', id)
    set({ activeDomainId: id })
  },
}))
