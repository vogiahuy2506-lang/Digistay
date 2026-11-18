'use client'

import * as React from 'react'
import { Sparkles, Check, ArrowRight, Loader2, Wand2, Copy, RefreshCw } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AiTextCopilotProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  label?: string
  onApplyText: (newText: string) => void
}

const ACTIONS = [
  { id: 'rewrite', label: '✨ Viết lại mượt mà', desc: 'Diễn đạt tự nhiên, lôi cuốn' },
  { id: 'luxury', label: '💎 Sang trọng & Thượng lưu', desc: 'Văn phong tinh tế chuẩn boutique' },
  { id: 'shorten', label: '✂️ Rút ngắn súc tích', desc: 'Đúc kết câu ngắn đắt giá' },
  { id: 'seo', label: '🎯 Tối ưu SEO du lịch', desc: 'Chèn từ khóa lưu trú tự nhiên' },
  { id: 'translate_en', label: '🌐 Dịch sang Tiếng Anh', desc: 'Chuẩn ngành hospitality bản ngữ' },
] as const

type ActionId = (typeof ACTIONS)[number]['id']

export function AiTextCopilot({
  isOpen,
  onClose,
  initialText,
  label = 'Đoạn văn bản',
  onApplyText,
}: AiTextCopilotProps) {
  const [selectedAction, setSelectedAction] = React.useState<ActionId>('rewrite')
  const [currentText, setCurrentText] = React.useState(initialText)
  const [refinedText, setRefinedText] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (isOpen) {
      setCurrentText(initialText)
      setRefinedText('')
      setError('')
    }
  }, [isOpen, initialText])

  const handleRefine = async (actionToUse = selectedAction) => {
    if (!currentText.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/website/ai/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          action: actionToUse,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Không thể chỉnh sửa văn bản bằng AI lúc này')
        return
      }

      setRefinedText(json.data.text)
    } catch {
      setError('Lỗi kết nối máy chủ AI')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader className="border-b border-line pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-fg">
              AI Trợ Lý Biên Tập: {label}
            </h2>
            <p className="text-xs text-muted">
              Tinh chỉnh và nâng tầm câu từ cho website khách sạn của bạn.
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="py-4 space-y-4">
        {/* Văn bản gốc */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Văn bản hiện tại
          </label>
          <textarea
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-ctl border border-line bg-page p-3 text-xs text-fg focus:border-ink focus:outline-hidden"
          />
        </div>

        {/* Action pills */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Chọn phong cách biên tập
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((act) => {
              const active = selectedAction === act.id
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setSelectedAction(act.id)
                    handleRefine(act.id)
                  }}
                  className={cn(
                    'flex flex-col rounded-ctl border p-2.5 text-left transition-all',
                    active
                      ? 'border-indigo-600 bg-indigo-500/[0.08] text-fg shadow-xs ring-1 ring-indigo-500/20'
                      : 'border-line text-muted hover:text-fg hover:border-muted'
                  )}
                >
                  <span className="text-xs font-semibold">{act.label}</span>
                  <span className="text-[10.5px] text-muted line-clamp-1">{act.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Kết quả sau AI */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-center text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-600" />
            AI đang tinh chỉnh câu từ chuẩn hospitality…
          </div>
        ) : error ? (
          <p className="text-xs text-warn">{error}</p>
        ) : refinedText ? (
          <div className="rounded-ctl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
              <span>✓ Bản thảo gợi ý từ AI:</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(refinedText)}
                className="text-[11px] font-normal hover:underline inline-flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Sao chép
              </button>
            </div>
            <p className="text-fg text-xs leading-relaxed">{refinedText}</p>
          </div>
        ) : null}
      </ModalBody>

      <ModalFooter className="border-t border-line pt-3 flex items-center justify-between">
        <Button variant="secondary" onClick={onClose} size="sm">
          Hủy
        </Button>
        <div className="flex gap-2">
          {!refinedText && (
            <Button
              onClick={() => handleRefine()}
              disabled={loading || !currentText.trim()}
              size="sm"
              className="bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              {loading ? 'Đang xử lý…' : 'Thực hiện với AI'}
            </Button>
          )}
          {refinedText && (
            <Button
              onClick={() => {
                onApplyText(refinedText)
                onClose()
              }}
              size="sm"
              className="bg-emerald-600 text-white font-medium hover:bg-emerald-700"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Áp dụng vào website
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
