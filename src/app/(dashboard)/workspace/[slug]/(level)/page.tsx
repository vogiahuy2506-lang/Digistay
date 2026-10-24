'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, Button, Input, Loading } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { ArrowRight, Building2, Search, SlidersHorizontal } from 'lucide-react'

interface Property {
  id: string
  name: string
  type: string
  isActive: boolean
  subdomain: string
  address: string | null
  city: string | null
  district: string | null
  _count: { roomTypes: number }
}

/**
 * Workspace home: the properties of this workspace, one per row, in the same
 * shape as /workspaces lists workspaces. Numbers, revenue and today's arrivals
 * lived here before; each of them has a page of its own now.
 */
export default function WorkspaceDashboardPage() {
  const t = useTranslations('workspaceHome')
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const { workspace, loading: wsLoading } = useWorkspace()

  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (!workspace?.id) return
    let cancelled = false

    const search = new URLSearchParams({ workspaceId: workspace.id })
    fetch(`/api/properties?${search}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setProperties(data.data ?? [])
        } else {
          setError(data.error || t('failed'))
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('failed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // t is stable enough here: it only appears inside the catch handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return properties
    return properties.filter((property) =>
      [property.name, property.city, property.address, property.district, property.subdomain]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    )
  }, [properties, query])

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div className="max-w-xl">
          <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-fg sm:text-[38px]">
            {t('title')}
          </h1>
          <p className="mt-2 text-small text-muted sm:text-body">{t('lead')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Members and shared details live in settings; the members list is
              one page of its own next to it. */}
          <Link
            href={routes.members(slug)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctl border border-ink h-9 sm:h-8 px-3',
              'text-small font-medium text-fg hover:bg-panel transition-colors duration-160',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
            )}
          >
            {t('members')}
          </Link>
          <Link
            href={routes.settings(slug)}
            aria-label={t('customizeLabel')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctl border border-ink h-9 sm:h-8 px-3',
              'text-small font-medium text-fg hover:bg-panel transition-colors duration-160',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            {t('customize')}
          </Link>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* One field, right-aligned above the list, the way /workspaces does it. */}
      <div className="mt-9 flex justify-end">
        <div className="sm:w-64">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
            icon={<Search className="w-4 h-4" aria-hidden="true" />}
          />
        </div>
      </div>

      {loading ? (
        <Loading className="py-20" />
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-box border border-line bg-panel px-6 py-16 text-center">
          <p className="text-body text-fg">
            {properties.length === 0 ? t('empty.title') : t('noMatch.title')}
          </p>
          <p className="mt-1.5 text-small text-muted">
            {properties.length === 0 ? t('empty.text') : t('noMatch.text')}
          </p>
          {properties.length === 0 && (
            <Link href={routes.newProperty(slug)} className="inline-block mt-6">
              <Button>
                <Building2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
                {t('empty.action')}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 border-t border-line">
          {visible.map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              href={routes.property(slug, property.id)}
              labels={{
                active: t('active'),
                paused: t('paused'),
                roomTypes: t('roomTypes', { count: property._count.roomTypes }),
                open: t('open'),
              }}
            />
          ))}
        </ul>
      )}
    </>
  )
}

interface PropertyRowProps {
  property: Property
  href: string
  labels: { active: string; paused: string; roomTypes: string; open: string }
}

/** One property: name and address on the left, counts, then the way in. */
function PropertyRow({ property, href, labels }: PropertyRowProps) {
  const where = [property.district, property.city, property.address].filter(Boolean).join(', ')

  return (
    <li className="border-b border-line">
      <div className="flex items-center gap-3 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Building2 className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <Link
              href={href}
              className="text-body font-medium text-fg truncate hover:text-acc rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
            >
              {property.name}
            </Link>
            <span
              className={cn(
                'shrink-0 rounded-sm px-1.5 py-0.5 text-[11px]',
                property.isActive ? 'bg-ok-soft text-ok' : 'bg-plain-soft text-plain'
              )}
            >
              {property.isActive ? labels.active : labels.paused}
            </span>
          </div>
          {where && <p className="mt-1 text-small text-muted line-clamp-1">{where}</p>}
          <p className="mt-1.5 text-small text-muted tabular-nums">{labels.roomTypes}</p>
        </div>

        <Link
          href={href}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-ctl border border-ink px-3 h-9 sm:h-8 text-small font-medium text-fg',
            'hover:bg-panel transition-colors duration-160 shrink-0',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-page'
          )}
        >
          {labels.open}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  )
}