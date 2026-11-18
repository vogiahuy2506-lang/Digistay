'use client'

import * as React from 'react'
import { Sparkles, Check, RefreshCw, Layers, Layout, ArrowRight, Loader2 } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AiRemixDrawerProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  block: {
    id: string
    type: string
    name: string
    layoutVariant?: string
    config: Record<string, any>
  } | null
  onApplyVariant: (blockId: string, layoutVariant: string, newConfig: Record<string, any>) => void
}

export function AiRemixDrawer({
  isOpen,
  onClose,
  propertyId,
  block,
  onApplyVariant,
}: AiRemixDrawerProps) {
  const [variants, setVariants] = React.useState<Array<{ layoutVariant: string; title: string; config: Record<string, any> }>>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [selectedVariantIndex, setSelectedVariantIndex] = React.useState<number | null>(null)

  const loadVariants = React.useCallback(async () => {
    if (!block) return
    setLoading(true)
    setError('')
    setSelectedVariantIndex(null)

    try {
      const res = await fetch('/api/website/ai/remix-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          blockType: block.type,
          currentConfig: block.config || {},
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Không thể tạo biến thể remix lúc này')
        return
      }

      setVariants(json.data || [])
      if (json.data && json.data.length > 0) {
        setSelectedVariantIndex(0)
      }
    } catch {
      setError('Lỗi kết nối máy chủ AI')
    } finally {
      setLoading(false)
    }
  }, [block, propertyId])

  React.useEffect(() => {
    if (isOpen && block) {
      loadVariants()
    }
  }, [isOpen, block, loadVariants])

  if (!isOpen || !block) return null

  const handleApply = () => {
    if (selectedVariantIndex === null || !variants[selectedVariantIndex]) return
    const chosen = variants[selectedVariantIndex]
    onApplyVariant(block.id, chosen.layoutVariant, chosen.config)
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader className="border-b border-line pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-fg">
              ✨ Remix Khối: {block.name}
            </h2>
            <p className="text-xs text-muted">
              AI đề xuất các biến thể bố cục và văn phong mới tối ưu cho khối này.
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[70vh] overflow-y-auto py-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="mt-3 text-sm font-medium text-fg">Đang remix các biến thể layout và copywriting…</p>
            <p className="text-xs text-muted">Vui lòng chờ trong giây lát</p>
          </div>
        ) : error ? (
          <div className="rounded-ctl border border-warn/40 bg-warn-soft p-3 text-xs text-warn">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Chọn biến thể bạn thấy ưng ý nhất để tự động thay thế giao diện khối:
            </p>
            {variants.map((v, idx) => {
              const active = selectedVariantIndex === idx
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedVariantIndex(idx)}
                  className={cn(
                    'cursor-pointer rounded-ctl border p-4 transition-all relative',
                    active
                      ? 'border-indigo-600 bg-indigo-500/[0.05] ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-line hover:border-muted hover:bg-fg/[0.01]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-semibold text-fg">{v.title}</span>
                    </div>
                    {active && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                        <Check className="w-3.5 h-3.5" /> Đã chọn
                      </span>
                    )}
                  </div>

                  {/* Summary of changes */}
                  <div className="mt-2.5 rounded bg-page p-2.5 text-xs text-muted space-y-1">
                    {v.config.heroTitle && (
                      <div>
                        <strong className="text-fg">Tiêu đề:</strong> {v.config.heroTitle}
                      </div>
                    )}
                    {v.config.heroSubtitle && (
                      <div>
                        <strong className="text-fg">Mô tả:</strong> {v.config.heroSubtitle}
                      </div>
                    )}
                    {v.config.title && (
                      <div>
                        <strong className="text-fg">Tiêu đề:</strong> {v.config.title}
                      </div>
                    )}
                    {v.config.description && (
                      <div className="line-clamp-2">
                        <strong className="text-fg">Nội dung:</strong> {v.config.description}
                      </div>
                    )}
                    {v.config.badgeText && (
                      <div>
                        <strong className="text-fg">Huy hiệu:</strong> {v.config.badgeText}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="border-t border-line pt-3 flex items-center justify-between">
        <Button variant="secondary" onClick={onClose} size="sm">
          Đóng
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadVariants} disabled={loading} size="sm">
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} />
            Thử remix kiểu khác
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading || selectedVariantIndex === null}
            size="sm"
            className="bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Áp dụng biến thể này
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}
