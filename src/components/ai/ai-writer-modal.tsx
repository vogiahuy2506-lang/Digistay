'use client'

import * as React from 'react'
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { Sparkles, Check, Wand2, Copy, Globe, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { AiContentType, AiLanguage, AiTone, GenerateContentOutput } from '@/lib/ai/types'

export interface AiWriterApplyData {
  title: string
  shortDescription: string
  fullDescription: string
  metaTitle?: string
  metaDescription?: string
  english?: {
    title: string
    shortDescription: string
    fullDescription: string
    metaTitle?: string
    metaDescription?: string
  }
}

interface AiWriterModalProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  contentType: AiContentType
  initialRoomName?: string
  initialArea?: number | null
  initialBedType?: string
  initialTopic?: string
  onApply: (data: AiWriterApplyData) => void
}

const TONE_OPTIONS: { value: AiTone; labelVi: string; labelEn: string }[] = [
  { value: 'COZY', labelVi: 'Ấm cúng & Gần gũi (Cozy)', labelEn: 'Cozy & Welcoming' },
  { value: 'LUXURY', labelVi: 'Sang trọng & Đẳng cấp (Luxury)', labelEn: 'Luxury & Upscale' },
  { value: 'MODERN', labelVi: 'Hiện đại & Thanh lịch (Modern)', labelEn: 'Modern & Chic' },
  { value: 'ROMANTIC', labelVi: 'Lãng mạn cho cặp đôi (Romantic)', labelEn: 'Romantic for Couples' },
  { value: 'FAMILY', labelVi: 'Rộng rãi cho gia đình (Family)', labelEn: 'Spacious for Families' },
]

export function AiWriterModal({
  isOpen,
  onClose,
  propertyId,
  contentType,
  initialRoomName,
  initialArea,
  initialBedType,
  initialTopic,
  onApply,
}: AiWriterModalProps) {
  const [keywords, setKeywords] = React.useState('')
  const [tone, setTone] = React.useState<AiTone>('COZY')
  const [language, setLanguage] = React.useState<AiLanguage>('bilingual')
  const [targetAudience, setTargetAudience] = React.useState('')
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [result, setResult] = React.useState<GenerateContentOutput | null>(null)
  const [previewTab, setPreviewTab] = React.useState<'vi' | 'en'>('vi')

  // Reset or preset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setKeywords((current) => {
        if (current) return current
        if (contentType === 'ROOM_DESCRIPTION') {
          const suggestions = [
            initialArea ? `${initialArea}m²` : '',
            initialBedType ? `giường ${initialBedType.toLowerCase()}` : '',
            'view hồ bơi, yên tĩnh, bồn tắm nằm cao cấp, ban công thoáng mát',
          ].filter(Boolean)
          return suggestions.join(', ')
        }
        return 'món ăn địa phương, hải sản tươi sống, mở cửa đến đêm, giá bình dân'
      })
    }
  }, [isOpen, contentType, initialArea, initialBedType])

  const handleGenerate = async () => {
    if (!keywords.trim()) {
      toast.error('Vui lòng nhập vài từ khóa hoặc đặc điểm nổi bật')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/ai/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          keywords: keywords.trim(),
          roomName: initialRoomName,
          area: initialArea,
          bedType: initialBedType,
          topic: initialTopic,
          tone,
          language,
          targetAudience: targetAudience.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tạo nội dung')
      }

      setResult(data.data)
      setPreviewTab('vi')
      toast.success('Đã tạo nội dung AI thành công!')
    } catch (err: any) {
      toast.error(err.message || 'Đã có lỗi xảy ra khi tạo nội dung bằng AI')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplyToForm = () => {
    if (!result) return

    onApply({
      title: result.title,
      shortDescription: result.shortDescription,
      fullDescription: result.fullDescription,
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      english: result.english
        ? {
            title: result.english.title,
            shortDescription: result.english.shortDescription,
            fullDescription: result.english.fullDescription,
            metaTitle: result.english.metaTitle,
            metaDescription: result.english.metaDescription,
          }
        : undefined,
    })

    toast.success('Đã tự động điền nội dung AI vào biểu mẫu!')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader className="border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-acc/10 flex items-center justify-center text-acc">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-fg flex items-center gap-2">
              Trợ lý AI viết nội dung tự động
              <Badge variant="outline" className="text-acc border-acc/30 text-xs font-normal">
                AI Assistant
              </Badge>
            </h3>
            <p className="text-xs text-muted">
              {contentType === 'ROOM_DESCRIPTION'
                ? 'Sinh mô tả phòng cuốn hút, chuẩn SEO đa ngôn ngữ từ từ khóa'
                : 'Viết bài quảng bá & tin tức du lịch hấp dẫn, tối ưu lượt đọc'}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
        {/* Keywords and options */}
        <div className="space-y-3">
          <Textarea
            label="Từ khóa & Đặc điểm nổi bật (Keywords)"
            placeholder="Ví dụ: 30m2, view hồ bơi, yên tĩnh, bồn tắm kính, ban công đón hoàng hôn..."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={2}
            hint="Nhập các nét đặc sắc, tiện ích nổi bật phân cách bằng dấu phẩy."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Phong cách & Tone giọng"
              value={tone}
              onChange={(e) => setTone(e.target.value as AiTone)}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelVi}
                </option>
              ))}
            </Select>

            <Select
              label="Ngôn ngữ xuất bản"
              value={language}
              onChange={(e) => setLanguage(e.target.value as AiLanguage)}
            >
              <option value="bilingual">Song ngữ (Tiếng Việt & English)</option>
              <option value="vi">Chỉ Tiếng Việt</option>
              <option value="en">Only English</option>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleGenerate}
              isLoading={isGenerating}
              disabled={isGenerating || !keywords.trim()}
              className="bg-acc text-acc-fg hover:bg-acc/90 shadow-sm"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {result ? 'Tạo lại nội dung khác' : 'Tạo nội dung với AI'}
            </Button>
          </div>
        </div>

        {/* AI Result Section */}
        {result && (
          <div className="mt-4 pt-4 border-t border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-acc" />
                Kết quả tạo bởi {result.modelUsed}
              </span>

              {result.english && (
                <div className="flex items-center gap-1 bg-ink/5 p-0.5 rounded-lg border border-line text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('vi')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      previewTab === 'vi'
                        ? 'bg-panel shadow-xs font-medium text-fg'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    Tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('en')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      previewTab === 'en'
                        ? 'bg-panel shadow-xs font-medium text-fg'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            {/* Vietnamese Preview */}
            {previewTab === 'vi' && (
              <div className="space-y-3 bg-ink/5 p-4 rounded-xl border border-line">
                <div>
                  <span className="text-xs font-medium text-muted">Tiêu đề đề xuất</span>
                  <p className="font-semibold text-fg">{result.title}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted">Đoạn mô tả ngắn (Tóm tắt)</span>
                  <p className="text-sm text-fg/90">{result.shortDescription}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted">Mô tả đầy đủ (Markdown)</span>
                  <div className="text-xs text-muted font-mono whitespace-pre-wrap bg-panel p-3 rounded-lg border border-line max-h-48 overflow-y-auto">
                    {result.fullDescription}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
                  <div>
                    <span className="text-muted">SEO Title ({result.metaTitle.length}/60):</span>
                    <p className="truncate font-medium">{result.metaTitle}</p>
                  </div>
                  <div>
                    <span className="text-muted">SEO Description ({result.metaDescription.length}/160):</span>
                    <p className="truncate font-medium">{result.metaDescription}</p>
                  </div>
                </div>
              </div>
            )}

            {/* English Preview */}
            {previewTab === 'en' && result.english && (
              <div className="space-y-3 bg-ink/5 p-4 rounded-xl border border-line">
                <div>
                  <span className="text-xs font-medium text-muted">English Title</span>
                  <p className="font-semibold text-fg">{result.english.title}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted">English Short Summary</span>
                  <p className="text-sm text-fg/90">{result.english.shortDescription}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted">English Full Markdown</span>
                  <div className="text-xs text-muted font-mono whitespace-pre-wrap bg-panel p-3 rounded-lg border border-line max-h-48 overflow-y-auto">
                    {result.english.fullDescription}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
                  <div>
                    <span className="text-muted">SEO Title ({result.english.metaTitle.length}/60):</span>
                    <p className="truncate font-medium">{result.english.metaTitle}</p>
                  </div>
                  <div>
                    <span className="text-muted">SEO Description ({result.english.metaDescription.length}/160):</span>
                    <p className="truncate font-medium">{result.english.metaDescription}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="border-t border-line pt-3 flex justify-between items-center">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        {result && (
          <Button
            type="button"
            onClick={handleApplyToForm}
            className="bg-acc text-acc-fg hover:bg-acc/90 shadow-sm"
          >
            <Check className="w-4 h-4 mr-2" />
            Áp dụng vào biểu mẫu
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}

