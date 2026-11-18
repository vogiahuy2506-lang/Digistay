'use client'

import * as React from 'react'
import { Sparkles, Wand2, Check, RefreshCw, Layers, Compass, Palette, Type, HelpCircle, Loader2 } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { THEME_PRESETS } from '@/lib/ai/website-theme-presets'

export interface AiStudioModalProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  propertyName: string
  onApplySite: (data: { settings: any; blocks: any[] }) => void
}

const STYLES = [
  {
    id: 'luxury_boutique',
    title: 'Luxury Boutique',
    desc: 'Sang trọng, thượng lưu, tông màu xanh navy và vàng đồng hoàng gia.',
    primaryColor: '#1A2B49',
    secondaryColor: '#C5A880',
    font: 'Playfair Display + Inter',
  },
  {
    id: 'tropical_eco',
    title: 'Tropical Eco Resort',
    desc: 'Nghỉ dưỡng sinh thái xanh mát, tông xanh rừng và đất nung ấm áp.',
    primaryColor: '#1E4D3B',
    secondaryColor: '#E8A87C',
    font: 'Playfair Display + Jakarta',
  },
  {
    id: 'modern_clean',
    title: 'Modern Minimalist',
    desc: 'Hiện đại, sắc sảo, tối giản thanh lịch chuẩn phong cách Bắc Âu.',
    primaryColor: '#2563EB',
    secondaryColor: '#10B981',
    font: 'Plus Jakarta Sans',
  },
  {
    id: 'vintage_boho',
    title: 'Vintage & Heritage',
    desc: 'Hoài niệm di sản, mộc mạc ấm cúng, đậm nét văn hóa bản địa.',
    primaryColor: '#8B4513',
    secondaryColor: '#D27D2D',
    font: 'Merriweather + Vietnam Pro',
  },
  {
    id: 'coastal_breeze',
    title: 'Coastal Ocean Breeze',
    desc: 'Hơi thở biển cả trong lành, phóng khoáng với sắc xanh biển và ngọc lam.',
    primaryColor: '#0284C7',
    secondaryColor: '#0D9488',
    font: 'Playfair Display + Inter',
  },
]

const QUICK_PROMPTS = [
  'Resort ven sông yên bình, ẩm thực hữu cơ, hồ bơi tràn bờ',
  'Khách sạn boutique phố cổ, kiến trúc Indochine, dịch vụ cá nhân hóa',
  'Homestay ấm cúng phong cách Đà Lạt, vườn hoa rực rỡ và cafe săn mây',
  'Villa biển sang trọng view hoàng hôn cho gia đình và cặp đôi',
]

const GENERATION_STEPS = [
  'Đang phân tích phong cách kiến trúc & vị trí cơ sở…',
  'Đang tuyển chọn bảng màu & phông chữ mỹ thuật…',
  'Đang soạn thảo câu chuyện thương hiệu & headline chuẩn SEO…',
  'Đang sắp xếp các khối phòng nghỉ & tiện ích tối ưu chuyển đổi…',
  'Đang hoàn tất bản dựng website hoàn chỉnh…',
]

export function AiStudioModal({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  onApplySite,
}: AiStudioModalProps) {
  const [selectedStyle, setSelectedStyle] = React.useState('luxury_boutique')
  const [prompt, setPrompt] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev))
    }, 2000)
    return () => clearInterval(interval)
  }, [loading])

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setStepIndex(0)

    try {
      const res = await fetch('/api/website/ai/generate-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          prompt: prompt.trim() || undefined,
          stylePreset: selectedStyle,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Không thể tạo website bằng AI lúc này. Vui lòng thử lại.')
        setLoading(false)
        return
      }

      onApplySite(json.data)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối máy chủ AI.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen onClose={loading ? () => {} : onClose} size="lg">
      <ModalHeader className="border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-on-ink shadow-sm border border-line">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-fg">
              Digistay AI Website Studio
            </h2>
            <p className="text-xs text-muted">
              Tạo website hoàn chỉnh cho: <strong className="text-fg">{propertyName}</strong>
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[75vh] overflow-y-auto py-5 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20 p-1 shadow-sm">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-panel">
                <Wand2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>

            <h3 className="mt-6 text-base font-semibold text-fg">
              {GENERATION_STEPS[stepIndex]}
            </h3>
            <p className="mt-2 text-xs text-muted max-w-sm">
              Trí tuệ nhân tạo Gemini đang tự động cấu hình bảng màu, viết toàn bộ nội dung và sắp xếp các khối block.
            </p>

            <div className="mt-6 w-full max-w-xs bg-line rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${((stepIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-ctl border border-warn/40 bg-warn-soft p-3 text-xs text-warn">
                {error}
              </div>
            )}

            {/* Bước 1: Chọn phong cách lưu trú */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                1. Chọn phong cách chủ đạo (Style & Vibe)
              </label>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {STYLES.map((st) => {
                  const active = selectedStyle === st.id
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStyle(st.id)}
                      className={cn(
                        'flex flex-col rounded-xl border p-3.5 text-left transition-all relative',
                        active
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                          : 'border-line hover:border-muted hover:bg-fg/[0.01]'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-fg">{st.title}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-3 w-3 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: st.primaryColor }}
                          />
                          <span
                            className="h-3 w-3 rounded-full border border-black/10 shadow-xs"
                            style={{ backgroundColor: st.secondaryColor }}
                          />
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-muted leading-relaxed">{st.desc}</p>
                      <span className="mt-2 text-[11px] font-mono text-muted/80">
                        {st.font}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bước 2: Tùy biến bằng Prompt tự nhiên */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  2. Mô tả mong muốn bổ sung (Tùy chọn)
                </span>
                <span className="text-[11px] font-normal text-muted">Prompt tự do</span>
              </label>
              <div className="mt-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Resort ven sông Hội An yên bình, nhấn mạnh vào trải nghiệm chèo thuyền kayak ngắm bình minh và ẩm thực hữu cơ địa phương..."
                  className="w-full rounded-xl border border-line bg-page p-3 text-xs text-fg placeholder:text-muted/60 focus:border-primary focus:outline-hidden min-h-[75px]"
                />
              </div>

              {/* Quick suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt(qp)}
                    className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-muted hover:text-fg hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    + {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Thông tin tự động kéo từ hệ thống */}
            <div className="rounded-xl border border-dashed border-line p-3 text-xs text-muted flex items-start gap-2.5 bg-fg/[0.01]">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-fg">Tự động đồng bộ dữ liệu thật:</span>
                <p className="mt-0.5">
                  AI sẽ tự động đọc danh sách các hạng phòng, giá niêm yết, ảnh cơ sở và tiện ích đã có trong cơ sở để ghép vào website. Bạn không cần phải tải lên lại.
                </p>
              </div>
            </div>
          </>
        )}
      </ModalBody>

      <ModalFooter className="border-t border-line pt-3 flex items-center justify-between">
        <Button variant="secondary" onClick={onClose} disabled={loading} size="sm">
          Hủy bỏ
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          className="bg-primary hover:bg-primary-hover text-on-primary font-medium shadow-xs px-5"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Đang tạo website…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Tạo website bằng AI
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
