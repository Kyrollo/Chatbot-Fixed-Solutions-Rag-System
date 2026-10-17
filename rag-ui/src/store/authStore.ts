// src/store/authStore.ts
import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'

export type RealmRole = 'system_admin' | 'domain_admin' | 'contributor' | 'reader' | string

interface DecodedToken {
  sub?: string
  preferred_username?: string
  email?: string
  realm_access?: { roles: string[] }
  resource_access?: Record<string, { roles?: string[] }>
  exp?: number
}

export function createMockJwt(userId: string, username: string, email: string, roles: string[]): string {
  const toBase64 = (obj: any) => {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    } catch {
      return btoa(JSON.stringify(obj))
    }
  }
  const header = toBase64({ alg: 'HS256', typ: 'JWT' })
  const payload = toBase64({
    sub: userId,
    preferred_username: username,
    email: email,
    realm_access: { roles },
    resource_access: { 'rag-ui': { roles } },
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
  })
  return `${header}.${payload}.enterprise-demo-sig`
}

function extractAllRoles(decoded: DecodedToken): RealmRole[] {
  const roles: string[] = []
  if (decoded.realm_access?.roles) {
    roles.push(...decoded.realm_access.roles)
  }
  if (decoded.resource_access) {
    Object.values(decoded.resource_access).forEach((client) => {
      if (client?.roles) {
        roles.push(...client.roles)
      }
    })
  }
  return Array.from(new Set(roles))
}

interface AuthState {
  token: string | null
  userId: string | null
  username: string | null
  email: string | null
  roles: RealmRole[]
  isSystemAdmin: boolean
  isDemo: boolean
  setToken: (token: string) => void
  loginDemo: (role?: RealmRole, name?: string) => void
  logout: () => void
  init: () => void
  isTokenValid: () => boolean
}

// Synchronously boot from sessionStorage to prevent flash-to-login on refresh
const initialToken = sessionStorage.getItem('access_token')
let initialUserId: string | null = null
let initialUsername: string | null = null
let initialEmail: string | null = null
let initialRoles: RealmRole[] = []
let initialIsSystemAdmin = false
let initialIsDemo = false

if (initialToken) {
  try {
    const decoded = jwtDecode<DecodedToken>(initialToken)
    if (decoded.exp && decoded.exp * 1000 > Date.now() - 30_000) {
      initialUserId = decoded.sub ?? null
      initialUsername = decoded.preferred_username ?? null
      initialEmail = decoded.email ?? null
      initialRoles = extractAllRoles(decoded)
      initialIsSystemAdmin = initialRoles.includes('system_admin')
      initialIsDemo = initialToken.includes('enterprise-demo-sig')
    } else {
      sessionStorage.removeItem('access_token')
    }
  } catch {
    sessionStorage.removeItem('access_token')
  }
}

function decodeAndSet(token: string, set: (s: Partial<AuthState>) => void): boolean {
  try {
    const decoded = jwtDecode<DecodedToken>(token)
    if (decoded.exp && decoded.exp * 1000 < Date.now() - 30_000) {
      return false
    }
    const roles = extractAllRoles(decoded)
    const isDemo = token.includes('enterprise-demo-sig')
    set({
      token,
      userId: decoded.sub ?? null,
      username: decoded.preferred_username ?? null,
      email: decoded.email ?? null,
      roles,
      isSystemAdmin: roles.includes('system_admin'),
      isDemo,
    })
    return true
  } catch {
    return false
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialToken ? (sessionStorage.getItem('access_token') ? initialToken : null) : null,
  userId: initialUserId,
  username: initialUsername,
  email: initialEmail,
  roles: initialRoles,
  isSystemAdmin: initialIsSystemAdmin,
  isDemo: initialIsDemo,

  setToken: (token: string) => {
    const ok = decodeAndSet(token, set)
    if (ok) {
      sessionStorage.setItem('access_token', token)
    } else {
      console.error('Token is invalid or already expired')
    }
  },

  loginDemo: (role: RealmRole = 'system_admin', name?: string) => {
    const roleMap: Record<string, { username: string; email: string; roles: string[] }> = {
      system_admin: {
        username: name || 'Enterprise Lead Architect',
        email: 'admin@fixed-solutions-rag.internal',
        roles: ['system_admin', 'domain_admin', 'contributor', 'reader'],
      },
      domain_admin: {
        username: name || 'Domain Operations Manager',
        email: 'manager@fixed-solutions-rag.internal',
        roles: ['domain_admin', 'contributor', 'reader'],
      },
      contributor: {
        username: name || 'Knowledge Contributor',
        email: 'contributor@fixed-solutions-rag.internal',
        roles: ['contributor', 'reader'],
      },
      reader: {
        username: name || 'Audit & Verification Viewer',
        email: 'viewer@fixed-solutions-rag.internal',
        roles: ['reader'],
      },
    }

    const config = roleMap[role] || roleMap['system_admin']
    const mockJwt = createMockJwt('demo-user-' + role, config.username, config.email, config.roles)
    sessionStorage.setItem('access_token', mockJwt)
    decodeAndSet(mockJwt, set)
  },

  logout: () => {
    sessionStorage.removeItem('access_token')
    set({ token: null, userId: null, username: null, email: null, roles: [], isSystemAdmin: false, isDemo: false })
  },

  init: () => {
    const token = sessionStorage.getItem('access_token')
    if (!token) return
    const ok = decodeAndSet(token, set)
    if (!ok) {
      sessionStorage.removeItem('access_token')
      set({ token: null, userId: null, username: null, email: null, roles: [], isSystemAdmin: false, isDemo: false })
    }
  },

  isTokenValid: () => {
    const token = get().token
    if (!token) return false
    try {
      const decoded = jwtDecode<DecodedToken>(token)
      return !decoded.exp || decoded.exp * 1000 > Date.now()
    } catch {
      return false
    }
  },
}))
