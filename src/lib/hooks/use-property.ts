'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiError } from '@/lib/i18n/api-errors'

export interface PropertyContext {
  id: string
  name: string
  type: string
  slug: string
  subdomain: string
  city: string
  isActive: boolean
  coverImage: string | null
}

/**
 * Resolve the current property from the [id] route param (or `fallbackId`
 * on a page without one: the sidebar on the workspace's own pages shows the
 * property opened last). Fetches /api/properties/[id] for full context.
 */
export function useProperty(fallbackId?: string): {
  property: PropertyContext | null
  loading: boolean
  error: string | null
} {
  const params = useParams<{ id?: string }>()
  const id = params?.id ?? fallbackId
  const [property, setProperty] = useState<PropertyContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/properties/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && data.data) {
          const p = data.data
          setProperty({
            id: p.id,
            name: p.name,
            type: p.type,
            slug: p.slug,
            subdomain: p.subdomain,
            city: p.city,
            isActive: p.isActive,
            coverImage: p.coverImage ?? null,
          })
        } else {
          setError(apiError(data?.error) || apiError('Cơ sở không tồn tại') || 'Cơ sở không tồn tại')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Lỗi mạng')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { property, loading, error }
}
