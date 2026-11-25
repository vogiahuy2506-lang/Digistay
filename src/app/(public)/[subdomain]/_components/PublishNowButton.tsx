'use client'

import * as React from 'react'
import { Globe, Loader2, Check } from 'lucide-react'

export function PublishNowButton({ propertyId }: { propertyId?: string }) {
  const [publishing, setPublishing] = React.useState(false)
  const [published, setPublished] = React.useState(false)

  if (!propertyId) return null

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch('/api/website/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          settings: { isPublished: true },
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        setPublished(true)
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        alert('Không thể xuất bản website lúc này. Vui lòng vào trang Quản trị Website để xuất bản.')
      }
    } catch {
      alert('Lỗi kết nối khi xuất bản website.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={publishing || published}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-950 text-amber-200 hover:bg-neutral-900 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-75 shrink-0"
    >
      {publishing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : published ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Globe className="w-3.5 h-3.5" />
      )}
      <span>{published ? 'Đã xuất bản!' : 'Xuất bản website ngay'}</span>
    </button>
  )
}
