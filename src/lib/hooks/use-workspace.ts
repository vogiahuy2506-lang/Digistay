'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export interface WorkspaceContext {
  id: string
  name: string
  slug: string
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
}

/**
 * Resolve the current workspace from the [slug] route param by fetching /api/workspaces.
 * Returns { workspace, loading, error }.
 */
export function useWorkspace(): {
  workspace: WorkspaceContext | null
  loading: boolean
  error: string | null
} {
  const params = useParams<{ slug?: string }>()
  const slug = params?.slug
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success) {
          const found = (data.data as any[]).find((w) => w.slug === slug)
          if (found) {
            setWorkspace({
              id: found.id,
              name: found.name,
              slug: found.slug,
              role: found.role,
            })
          } else {
            setError('Workspace không tồn tại hoặc bạn không có quyền truy cập')
          }
        } else {
          setError(data?.error || 'Không thể tải workspace')
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
  }, [slug])

  return { workspace, loading, error }
}
