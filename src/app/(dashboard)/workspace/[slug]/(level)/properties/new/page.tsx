'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { TitleBlock } from '@/components/layout'
import { Card, CardContent, Loading } from '@/components/ui'
import { Building2, BedDouble, Landmark, Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import { NoAccess } from '@/components/payment/no-access'
import { useCan } from '@/components/layout/workspace-context'
import { CreatePropertyForm } from '@/components/properties/create-property-modal'

export default function NewPropertyPage() {
  const router = useRouter()
  const t = useTranslations('dash.property')
  const tw = useTranslations('dash.workspace')
  const { workspace, loading: wsLoading } = useWorkspace()
  const allowed = useCan('properties_create')

  if (!allowed) return <NoAccess title={t('new.title')} inPage />
  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspace) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Building2 className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg">{tw('noWorkspace.title')}</p>
      </div>
    )
  }

  return (
    <div>
      <TitleBlock
        title={t('new.title')}
        lead={t('new.description', { workspace: workspace.name })}
      />

      <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
        <Card>
          <CardContent className="p-6">
            <CreatePropertyForm
              workspaceId={workspace.id}
              workspaceSlug={workspace.slug}
              onCancel={() => router.push(routes.workspace(workspace.slug))}
            />
          </CardContent>
        </Card>

        <aside className="rounded-box border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold text-fg">{t('new.next.title')}</h2>
          <ol className="mt-4 space-y-4 text-sm">
            {(
              [
                ['rooms', BedDouble],
                ['payments', Landmark],
                ['website', Globe],
              ] as const
            ).map(([key, Icon], i) => (
              <li key={key} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/5 text-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-medium text-fg">
                    {i + 1}. {t(`new.next.${key}`)}
                  </span>
                  <span className="block text-muted">{t(`new.next.${key}Text`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
