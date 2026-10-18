'use client'

/**
 * Error boundary for the (public) route group. Keeps the marketing
 * site visible even when one of the blocks (rooms, gallery, etc.)
 * throws — visitors still see the rest of the page plus a "Thử lại"
 * affordance, instead of a blank screen.
 */
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function PublicSiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Public site error:', error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Không thể hiển thị trang này
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Đã xảy ra lỗi khi tải nội dung. Vui lòng thử lại sau ít phút.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-lg text-sm font-semibold hover:bg-terracotta-600 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </button>
      </div>
    </div>
  )
}
