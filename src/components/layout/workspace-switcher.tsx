'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui'
import { routes } from '@/lib/utils/routes'
import type { WorkspaceRole } from './nav'

type WorkspaceItem = { id: string; name: string; slug: string; role: WorkspaceRole }

/**
 * The workspace being shown and the way to another one, next to the logo in
 * the site header (MarketingHeader's `context`) on the workspace level pages.
 */
export function WorkspaceSwitcher({ workspace, workspaces }: { workspace: WorkspaceItem; workspaces: WorkspaceItem[] }) {
  const t = useTranslations('workspaces')
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Dropdown
      align="left"
      className="w-64"
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 max-w-[44vw] items-center gap-1.5 rounded-ctl px-1.5 text-[14px] text-fg transition-colors duration-160 hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc sm:max-w-[240px]"
        >
          <span className="truncate">{workspace.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        </button>
      }
    >
      {workspaces.map((ws) => (
        <DropdownItem key={ws.id} onClick={() => router.push(routes.workspace(ws.slug))}>
          <span className="flex-1 truncate">{ws.name}</span>
          {ws.slug === workspace.slug && (
            <span className="text-acc" aria-label={t('current')}>
              ✓
            </span>
          )}
        </DropdownItem>
      ))}
      <DropdownDivider />
      <DropdownItem onClick={() => router.push(routes.workspaces())}>{t('allWorkspaces')}</DropdownItem>
    </Dropdown>
  )
}
