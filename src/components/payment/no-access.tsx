'use client'

import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Header, PageContainer } from '@/components/layout'

/**
 * What a page shows to someone without its permission (useCan in
 * src/components/layout/workspace-context.tsx; the menu hides its entry),
 * opened by its address: a plain "no permission" instead of an empty list
 * or a failed load.
 */
export function NoAccess({ title, inPage = false }: { title: string; /** Inside a page container already (the workspace's own pages). */ inPage?: boolean }) {
  const tc = useTranslations('dash.common')
  const t = useTranslations('dash.money.access')
  const body = (
    <>
      <Header title={title} />
      <div role="status" className="rounded-box border border-line bg-panel px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fg/5">
          <Lock className="h-6 w-6 text-muted" aria-hidden="true" />
        </div>
        <p className="font-semibold text-fg">{tc('states.noPermission')}</p>
        <p className="mx-auto mt-1 max-w-md text-small text-muted">{t('hint')}</p>
      </div>
    </>
  )
  return inPage ? body : <PageContainer>{body}</PageContainer>
}
