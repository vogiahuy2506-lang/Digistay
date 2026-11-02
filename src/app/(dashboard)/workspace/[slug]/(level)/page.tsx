'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Alert,
  AlertDescription,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Input,
  Loading,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useCan, useWorkspaceAccess } from '@/components/layout/workspace-context'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import {
  ArrowRight,
  BedDouble,
  Building2,
  Calendar,
  ExternalLink,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { apiError } from '@/lib/i18n/api-errors'
import { addressLocality } from '@/lib/vn-admin/address'
import { RecentlyDeleted } from '@/components/deletion/recently-deleted'

interface Property {
  id: string
  name: string
  type: string
  isActive: boolean
  /** Locked because the workspace is over its plan (src/lib/billing/overage.ts): read-only. */
  planLockedAt?: string | null
  subdomain: string
  address: string | null
  city: string | null
  district: string | null
  ward: string | null
  _count: { roomTypes: number }
}

/**
 * Workspace home: the properties of this workspace, in the same shape and layout
 * as /workspaces lists workspaces.
 */
export default function WorkspaceDashboardPage() {
  const t = useTranslations('workspaceHome')
  const tb = useTranslations('dash.billing')
  const access = useWorkspaceAccess()
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const { workspace, loading: wsLoading } = useWorkspace()
  const canBilling = useCan('billing_manage') || access?.isOwner
  const canAddProperty = useCan('properties_create')

  const [properties, setProperties] = React.useState<Property[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [tab, setTab] = React.useState<'all' | 'active' | 'paused'>('all')
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
          setError(apiError(data.error) || t('failed'))
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

  const activeProperties = React.useMemo(() => properties.filter((p) => p.isActive), [properties])
  const pausedProperties = React.useMemo(() => properties.filter((p) => !p.isActive), [properties])

  const visible = React.useMemo(() => {
    let list = properties
    if (tab === 'active') list = activeProperties
    if (tab === 'paused') list = pausedProperties

    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((property) =>
      [property.name, property.city, property.address, property.ward, property.district, property.subdomain]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    )
  }, [properties, tab, activeProperties, pausedProperties, query])

  const emptyText = (() => {
    if (properties.length === 0) return { title: t('empty.title'), text: t('empty.text') }
    if (query.trim()) return { title: t('noMatch.title'), text: t('noMatch.text') }
    if (tab === 'active') {
      return { title: t('emptyActive.title'), text: t('emptyActive.text') }
    }
    if (tab === 'paused') {
      return { title: t('emptyPaused.title'), text: t('emptyPaused.text') }
    }
    return { title: t('empty.title'), text: t('empty.text') }
  })()

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  return (
    <div>
      {/* Header aligned like /workspaces */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div className="max-w-xl">
          <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.02em] text-fg sm:text-[38px]">
            {t('title')}
          </h1>
          <p className="mt-2 text-small text-muted sm:text-body">{t('lead')}</p>
        </div>
        {canAddProperty && (
          <Link href={routes.newProperty(slug)} className="shrink-0 self-start sm:self-auto">
            <Button>
              <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('addProperty')}
            </Button>
          </Link>
        )}
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Tabs and search bar filter */}
      <div className="mt-9 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList variant="underline">
            <TabsTrigger value="all">
              {t('filter.all')}
              <Count value={properties.length} />
            </TabsTrigger>
            <TabsTrigger value="active">
              {t('filter.active')}
              <Count value={activeProperties.length} />
            </TabsTrigger>
            <TabsTrigger value="paused">
              {t('filter.paused')}
              <Count value={pausedProperties.length} />
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
        <Loading className="py-20" text={t('searchPlaceholder')} />
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-box border border-line bg-panel px-6 py-16 text-center">
          <p className="text-body text-fg">{emptyText.title}</p>
          <p className="mt-1.5 text-small text-muted">{emptyText.text}</p>
          {(properties.length === 0 || (tab === 'active' && !query.trim())) && canAddProperty && (
            <Link href={routes.newProperty(slug)} className="inline-block mt-6">
              <Button>
                <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
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
              slug={slug}
              href={routes.property(slug, property.id)}
              labels={{
                active: t('active'),
                paused: t('paused'),
                roomTypes: t('roomTypes', { count: property._count.roomTypes }),
                open: t('open'),
                planLocked: tb('planLockedBadge'),
                viewWebsite: t('actions.viewWebsite'),
                rooms: t('actions.rooms'),
                bookings: t('actions.bookings'),
                settings: t('actions.settings'),
              }}
            />
          ))}
        </ul>
      )}

      {/* Properties deleted in the last 30 days, for the owner (who alone gets the list). */}
      {access?.isOwner && workspace && (
        <RecentlyDeleted kind="property" workspaceId={workspace.id} slug={slug} />
      )}
    </div>
  )
}

function Count({ value }: { value: number }) {
  return <span className="ml-1.5 text-xs text-muted tabular-nums">{value}</span>
}

interface PropertyRowProps {
  property: Property
  slug: string
  href: string
  labels: {
    active: string
    paused: string
    roomTypes: string
    open: string
    planLocked: string
    viewWebsite: string
    rooms: string
    bookings: string
    settings: string
  }
}

/** One property: name and address on the left, counts, actions dropdown, then the way in. */
function PropertyRow({ property, slug, href, labels }: PropertyRowProps) {
  const router = useRouter()
  // Where first (ward, or an older row's district, and province), then the street: the row shows one line.
  const where = [addressLocality(property), property.city, property.address].filter(Boolean).join(', ')

  const menuTrigger = (
    <button
      type="button"
      aria-label={labels.settings}
      aria-haspopup="menu"
      className="w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
    >
      <MoreVertical className="w-4 h-4" aria-hidden="true" />
    </button>
  )

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
            {property.planLockedAt && (
              <span className="shrink-0 rounded-sm bg-err-soft px-1.5 py-0.5 text-[11px] text-err">{labels.planLocked}</span>
            )}
          </div>
          {where && <p className="mt-1 text-small text-muted line-clamp-1">{where}</p>}
          <p className="mt-1.5 text-small text-muted flex items-center gap-3 flex-wrap">
            <span className="tabular-nums">{labels.roomTypes}</span>
            {property.subdomain && (
              <>
                <span aria-hidden="true" className="w-px h-3 bg-line" />
                <span className="tabular-nums text-muted">{property.subdomain}.digistay.vn</span>
              </>
            )}
          </p>
        </div>

        <Dropdown align="right" trigger={menuTrigger} className="min-w-[180px]">
          {property.subdomain && (
            <DropdownItem
              onClick={() => window.open(routes.publicSite(property.subdomain), '_blank')}
              icon={<ExternalLink className="w-4 h-4" />}
            >
              {labels.viewWebsite}
            </DropdownItem>
          )}
          <DropdownItem
            onClick={() => router.push(routes.propertyBookings(slug, property.id))}
            icon={<Calendar className="w-4 h-4" />}
          >
            {labels.bookings}
          </DropdownItem>
          <DropdownItem
            onClick={() => router.push(routes.propertyRooms(slug, property.id))}
            icon={<BedDouble className="w-4 h-4" />}
          >
            {labels.rooms}
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem
            onClick={() => router.push(routes.property(slug, property.id))}
            icon={<Settings className="w-4 h-4" />}
          >
            {labels.settings}
          </DropdownItem>
        </Dropdown>

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
