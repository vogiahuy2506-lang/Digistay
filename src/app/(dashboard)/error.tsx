'use client'

/**
 * Error boundary for the (dashboard) route group.
 *
 * Without this, an unhandled throw in any dashboard page bubbles all
 * the way up to the root `error.tsx`, which replaces the entire app
 * shell (including the sidebar + workspace switcher) and leaves the
 * user stranded. With this file, a single broken page is contained
 * to that page; the rest of the dashboard (sidebar, header, etc.)
 * stays mounted so the user can hit "Thử lại" or navigate to a
 * different workspace.
 */
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to the browser console so the error shows up in dev-tools
    // and the server-side digest (when present) is captured.
    // eslint-disable-next-line no-console
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-err-soft mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-err" />
        </div>
        <h2 className="text-lg font-semibold text-fg mb-2">
          Trang này gặp sự cố
        </h2>
        <p className="text-sm text-muted mb-5">
          {error.message || 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc quay về dashboard.'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-on-ink rounded-lg text-sm font-semibold hover:bg-ink/90 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load leaves the broken state behind */}
          <a
            href="/workspaces"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-fg bg-fg/5 hover:bg-fg/10 rounded-lg transition"
          >
            <Home className="w-4 h-4" />
            Về workspaces
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted font-mono">Mã lỗi: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
