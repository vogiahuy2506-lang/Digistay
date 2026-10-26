'use client'

import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Header, PageContainer } from '@/components/layout'
import type { WorkspaceRole } from '@/components/layout/nav'
import { useWorkspaceRole } from '@/components/layout/workspace-context'

/** Owner (as ADMIN) and managers: revenue and money totals. */
export const MONEY_MANAGERS: readonly WorkspaceRole[] = ['ADMIN', 'MANAGER']

/** Whether the signed-in user's role in this workspace is one of `roles`. */
export function useHasRole(roles: readonly WorkspaceRole[]) {
  const role = useWorkspaceRole()
  return role != null && roles.includes(role)
}

/**
 * What a money page shows to a role the menu does not give it
 * (src/components/layout/nav.ts), opened by its address: a plain "no
 * permission" instead of an empty list or a failed load.
 */
export function NoAccess({ title }: { title: string }) {
  const tc = useTranslations('dash.common')
  const t = useTranslations('dash.money.access')
  return (
    <PageContainer>
      <Header title={title} />
      <div role="status" className="rounded-box border border-line bg-panel px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fg/5">
          <Lock className="h-6 w-6 text-muted" aria-hidden="true" />
        </div>
        <p className="font-semibold text-fg">{tc('states.noPermission')}</p>
        <p className="mx-auto mt-1 max-w-md text-small text-muted">{t('hint')}</p>
      </div>
    </PageContainer>
  )
}
