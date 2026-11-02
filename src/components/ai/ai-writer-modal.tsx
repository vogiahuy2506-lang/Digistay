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
} from '@/components/ui'
import {
  Sparkles,
  Check,
  Wand2,
  Settings2,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Key,
} from 'lucide-react'
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

  // API Key & Model Setup State
  const [showApiSettings, setShowApiSettings] = React.useState(false)
  const [apiKey, setApiKey] = React.useState('')
  const [selectedModel, setSelectedModel] = React.useState('gemini-2.5-flash')
  const [showKeyText, setShowKeyText] = React.useState(false)
  const [isTestingKey, setIsTestingKey] = React.useState(false)
  const [hasServerEnvKey, setHasServerEnvKey] = React.useState(false)
  const [maskedServerKey, setMaskedServerKey] = React.useState<string | null>(null)

  // Load saved API Key from localStorage or check server config
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem(`digistay_ai_key_${propertyId}`) || localStorage.getItem('digistay_ai_key') || ''
      const savedModel = localStorage.getItem('digistay_ai_model') || 'gemini-2.5-flash'
      if (savedKey) setApiKey(savedKey)
      if (savedModel) setSelectedModel(savedModel)
    }

    if (isOpen && propertyId) {
      fetch(`/api/properties/${propertyId}/ai/config`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success && json.data) {
            setHasServerEnvKey(Boolean(json.data.hasEnvKey))
            setMaskedServerKey(json.data.maskedKey)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, propertyId])

  // Reset or preset keywords when opened
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

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Vui lòng nhập khóa API Gemini để kiểm tra')
      return
    }

    setIsTestingKey(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/ai/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: selectedModel,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Khóa API không hợp lệ')
      }

      toast.success('Kết nối Google Gemini thành công! Khóa API hợp lệ.')
      if (typeof window !== 'undefined') {
        localStorage.setItem(`digistay_ai_key_${propertyId}`, apiKey.trim())
        localStorage.setItem('digistay_ai_model', selectedModel)
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể xác thực khóa API Gemini')
    } finally {
      setIsTestingKey(false)
    }
  }

  const handleSaveApiKey = () => {
    if (typeof window !== 'undefined') {
      if (apiKey.trim()) {
        localStorage.setItem(`digistay_ai_key_${propertyId}`, apiKey.trim())
        localStorage.setItem('digistay_ai_model', selectedModel)
        toast.success('Đã lưu cấu hình API Key vào trình duyệt!')
      } else {
        localStorage.removeItem(`digistay_ai_key_${propertyId}`)
        toast.info('Đã xóa khóa cá nhân (sẽ dùng cấu hình hệ thống)')
      }
    }
    setShowApiSettings(false)
  }

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
          apiKey: apiKey.trim() || undefined,
          model: selectedModel,
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

  const isConfiguredWithKey = Boolean(apiKey.trim() || hasServerEnvKey)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader className="border-b border-line pb-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-acc/10 flex items-center justify-center text-acc">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-fg flex items-center gap-2">
                Trợ lý AI viết nội dung tự động
                <Badge variant="outline" className="text-acc border-acc/30 text-xs font-normal">
                  Gemini & AI
                </Badge>
              </h3>
              <p className="text-xs text-muted">
                {contentType === 'ROOM_DESCRIPTION'
                  ? 'Sinh mô tả phòng cuốn hút, chuẩn SEO đa ngôn ngữ từ từ khóa'
                  : 'Viết bài quảng bá & tin tức du lịch hấp dẫn, tối ưu lượt đọc'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowApiSettings((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showApiSettings
                ? 'bg-acc/10 text-acc border-acc/30'
                : 'bg-panel text-muted hover:text-fg border-line'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {isConfiguredWithKey ? 'Cấu hình API' : 'Thiết lập API Key'}
          </button>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
        {/* API Settings Section */}
        {showApiSettings && (
          <div className="p-4 rounded-xl border border-line bg-panel space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-acc" />
                Cài đặt Khóa Google Gemini API
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-acc hover:underline inline-flex items-center gap-1"
              >
                Nhận API Key miễn phí <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Input
                  type={showKeyText ? 'text' : 'password'}
                  placeholder={
                    hasServerEnvKey
                      ? `Đang dùng key hệ thống (${maskedServerKey || '****'}). Nhập key riêng nếu muốn thay đổi.`
                      : 'Dán khóa Gemini API Key vào đây (bắt đầu bằng AIzaSy...)'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute right-3 top-2.5 text-muted hover:text-fg transition-colors"
                >
                  {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Google cấp miễn phí 15 yêu cầu/phút không giới hạn thời gian. Khóa được bảo mật trong phiên làm việc của bạn.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Select
                label="Model Gemini"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng - Nhanh nhất)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </Select>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestApiKey}
                  isLoading={isTestingKey}
                  disabled={!apiKey.trim()}
                  className="w-full text-xs"
                >
                  Kiểm tra kết nối
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveApiKey}
                  className="w-full text-xs bg-acc text-acc-fg hover:bg-acc/90"
                >
                  Lưu thiết lập
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* API Status Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-ink/5 border border-line text-xs">
          <div className="flex items-center gap-2">
            {apiKey.trim() ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-ok" />
                <span className="text-fg font-medium">Đang sử dụng API Key cá nhân ({selectedModel})</span>
              </>
            ) : hasServerEnvKey ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-ok" />
                <span className="text-fg font-medium">Đã kết nối Gemini API hệ thống ({selectedModel})</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-warn" />
                <span className="text-muted">Chưa cài API Key (Đang dùng Heuristic Copywriting Engine)</span>
              </>
            )}
          </div>
          {!isConfiguredWithKey && !showApiSettings && (
            <button
              type="button"
              onClick={() => setShowApiSettings(true)}
              className="text-acc font-medium hover:underline"
            >
              Cài đặt Key
            </button>
          )}
        </div>

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
