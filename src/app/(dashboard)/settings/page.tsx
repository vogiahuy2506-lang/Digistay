'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Load the static HTML file into the current page
    window.location.href = '/settings.html'
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-on-surface-variant">Đang tải trang Cài đặt...</p>
      </div>
    </div>
  )
}
