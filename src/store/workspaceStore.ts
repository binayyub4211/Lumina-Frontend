'use client'

import { create } from 'zustand'

export interface OrgMeta {
  id: string
  name: string
  slug: string
}

export interface WorkspaceState {
  activeOrg: OrgMeta | null
  orgs: OrgMeta[]
  permissions: Record<string, number> // Map of org.id to permission mask bitfield
  activePermissionMask: number
  switchWorkspace: (slug: string) => void
  initializeOrgs: (orgs: OrgMeta[], permissions: Record<string, number>) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeOrg: null,
  orgs: [],
  permissions: {},
  activePermissionMask: 0,

  switchWorkspace: (slug: string) => {
    const { orgs, permissions } = get()
    const org = orgs.find((o) => o.slug === slug) || null
    const mask = org ? permissions[org.id] ?? 0 : 0
    
    set({ activeOrg: org, activePermissionMask: mask })

    // Workspace state survives page reload via URL search param ?org=<slug>
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (slug) {
        url.searchParams.set('org', slug)
      } else {
        url.searchParams.delete('org')
      }
      window.history.pushState({}, '', url.toString())
    }
  },

  initializeOrgs: (orgs: OrgMeta[], permissions: Record<string, number>) => {
    set({ orgs, permissions })

    // Auto-select active organization based on query param ?org=<slug>
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const orgSlug = searchParams.get('org')
      if (orgSlug) {
        const org = orgs.find((o) => o.slug === orgSlug)
        if (org) {
          const mask = permissions[org.id] ?? 0
          set({ activeOrg: org, activePermissionMask: mask })
          return
        }
      }
    }

    // Default to first org if none specified or matches
    if (orgs.length > 0) {
      const firstOrg = orgs[0]
      const mask = permissions[firstOrg.id] ?? 0
      set({ activeOrg: firstOrg, activePermissionMask: mask })
    }
  },
}))
