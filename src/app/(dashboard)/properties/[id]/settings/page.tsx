'use client'

import { useEffect } from 'react'

export default function PropertySettingsPage() {
  useEffect(() => {
    // Load the static HTML file
    window.location.href = '/settings.html'
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-on-surface-variant">Đang tải trang Cài đặt Cơ sở...</p>
      </div>
    </div>
  )
}
