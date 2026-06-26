'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useWorkspaceStore } from '../../store/workspaceStore'

export function WorkspaceSwitcher() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  const { activeOrg, orgs, switchWorkspace, initializeOrgs } = useWorkspaceStore()

  // On mount, check if organizations are initialized. If empty, initialize mock options.
  useEffect(() => {
    if (orgs.length === 0) {
      const defaultOrgs = [
        { id: 'org-a', name: 'Kynova Org A', slug: 'org-a' },
        { id: 'org-b', name: 'Kynova Org B', slug: 'org-b' },
        { id: 'org-c', name: 'Kynova Org C', slug: 'org-c' },
      ]
      // Bitfield mask: READ=1, CREATE=2, UPDATE=4, DELETE=8
      const defaultPermissions = {
        'org-a': 15, // full: 1 + 2 + 4 + 8 = 15
        'org-b': 1,  // read-only: 1
        'org-c': 3,  // read + create: 1 + 2 = 3
      }
      initializeOrgs(defaultOrgs, defaultPermissions)
    }
  }, [orgs.length, initializeOrgs])

  // Synchronize active organization if the query parameters change externally
  useEffect(() => {
    if (orgs.length === 0) return
    const orgParam = searchParams.get('org')
    if (orgParam && activeOrg?.slug !== orgParam) {
      switchWorkspace(orgParam)
    }
  }, [searchParams, activeOrg?.slug, orgs, switchWorkspace])

  const handleSelect = (slug: string) => {
    switchWorkspace(slug)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(searchParams.toString())
      if (slug) {
        params.set('org', slug)
      } else {
        params.delete('org')
      }
      router.push(`${pathname}?${params.toString()}`)
    }
  }

  if (orgs.length === 0) return null

  return (
    <div className="relative inline-block w-full">
      <label htmlFor="workspace-select" className="sr-only">
        Switch Workspace
      </label>
      <select
        id="workspace-select"
        value={activeOrg?.slug || ''}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full rounded-lg border border-[#d8d0c1] bg-white px-3 py-2 text-sm text-[#171512] shadow-sm outline-none transition focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.slug}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  )
}
