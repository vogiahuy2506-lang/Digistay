'use client'

import * as React from 'react'
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
  Select,
  Badge,
} from '@/components/ui'
import {
  Sparkles,
  Check,
  Wand2,
  CheckCircle2,
  Camera,
  Upload,
  Trash2,
  Loader2,
  Eye,
  FileCode,
} from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { AiContentType, AiLanguage, AiTone, GenerateContentOutput } from '@/lib/ai/types'
import { prepareImage, uploadPhoto } from '@/lib/media/upload-client'
import { BlogContent } from '@/components/blog/blog-content'

export interface AiWriterApplyData {
  title: string
  shortDescription: string
  fullDescription: string
  metaTitle?: string
  metaDescription?: string
  coverImage?: string
  images?: string[]
  english?: {
    title: string
    shortDescription: string
    fullDescription: string
    metaTitle?: string
    metaDescription?: string
  }
}

interface AttachedImage {
  id: string
  url: string
  base64?: string
  caption?: string
  name: string
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
  const [viewMode, setViewMode] = React.useState<'rendered' | 'raw'>('rendered')

  // Attached images state
  const [attachedImages, setAttachedImages] = React.useState<AttachedImage[]>([])
  const [isUploadingImages, setIsUploadingImages] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (attachedImages.length + files.length > 5) {
      toast.error('Bạn chỉ có thể đính kèm tối đa 5 hình ảnh để AI phân tích tốt nhất.')
      return
    }

    setIsUploadingImages(true)
    try {
      for (const file of files) {
        // Prepare base64 for vision perception
        const base64 = await prepareImage(file, 1600)
        // Upload to server to get permanent public URL
        const uploadedUrl = await uploadPhoto(file, { propertyId })

        setAttachedImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url: uploadedUrl,
            base64,
            caption: '',
            name: file.name,
          },
        ])
      }
      toast.success(`Đã tải lên ${files.length} hình ảnh thành công`)
    } catch (err: any) {
      console.error('Image upload failed:', err)
      toast.error(err.message || 'Không thể tải ảnh lên lúc này')
    } finally {
      setIsUploadingImages(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleUpdateCaption = (id: string, caption: string) => {
    setAttachedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption } : img))
    )
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
          model: 'gemini-3.1-flash-lite',
          images: attachedImages.map((img) => ({
            url: img.url,
            base64: img.base64,
            caption: img.caption?.trim() || undefined,
            name: img.name,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tạo nội dung')
      }

      setResult(data.data)
      setPreviewTab('vi')
      setViewMode('rendered')
      toast.success('Đã tạo nội dung AI thành công kèm phân tích hình ảnh!')
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
      coverImage: attachedImages[0]?.url,
      images: attachedImages.map((img) => img.url),
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
    toast.success('Đã áp dụng nội dung vào biểu mẫu!')
    onClose()
  }

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
                  Gemini 3.1 Flash-Lite
                </Badge>
              </h3>
              <p className="text-xs text-muted">
                {contentType === 'ROOM_DESCRIPTION'
                  ? 'Sinh mô tả phòng cuốn hút, chuẩn SEO đa ngôn ngữ từ từ khóa'
                  : 'Viết bài quảng bá & tin tức du lịch hấp dẫn, tối ưu lượt đọc'}
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs font-medium flex items-center gap-1.5 py-1 px-2.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Hệ thống AI sẵn sàng
          </Badge>
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

          {/* Đính kèm hình ảnh để AI phân tích */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-line bg-page/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-acc" />
                <label className="text-xs sm:text-sm font-semibold text-fg">
                  Hình ảnh đính kèm (AI tự động phân tích & chèn vào bài viết)
                </label>
              </div>
              <span className="text-xs text-muted tabular-nums">
                {attachedImages.length}/5 ảnh
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Tải lên ảnh chụp thực tế (không gian phòng, tiện nghi, ẩm thực, cảnh quan...). Trợ lý AI Vision sẽ <strong>nhìn và phân tích bối cảnh bức ảnh</strong>, sau đó tự động chèn ảnh vào các vị trí phù hợp trong bài viết kèm chú thích sinh động.
            </p>

            {/* Danh sách ảnh đã đính kèm */}
            {attachedImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {attachedImages.map((img, idx) => (
                  <div key={img.id} className="relative group rounded-lg border border-line bg-panel overflow-hidden p-1.5 space-y-1.5 shadow-2xs">
                    <div className="relative aspect-video rounded-md overflow-hidden bg-fg/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.base64 || img.url} alt={img.name} className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-err text-white transition-colors"
                        title="Xóa ảnh này"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={img.caption || ''}
                      onChange={(e) => handleUpdateCaption(img.id, e.target.value)}
                      placeholder="Ghi chú cho AI (vd: Hồ bơi hoàng hôn)"
                      className="w-full text-[11px] px-1.5 py-1 rounded border border-line/60 bg-page text-fg placeholder:text-muted/70 focus:outline-none focus:border-acc"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Nút bấm tải ảnh */}
            {attachedImages.length < 5 && (
              <div className="pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  type="button"
                  disabled={isUploadingImages}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-lg border border-dashed border-line hover:border-acc/70 hover:bg-acc/5 text-xs font-medium text-fg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isUploadingImages ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-acc" />
                      Đang xử lý & tải ảnh lên...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-acc" />
                      <span>Thêm hình ảnh thực tế (Tối đa 5 ảnh)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleGenerate}
              isLoading={isGenerating || isUploadingImages}
              disabled={isGenerating || isUploadingImages || !keywords.trim()}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-acc" />
                Kết quả tạo bởi {result.modelUsed}
              </span>

              <div className="flex items-center gap-2">
                {/* Switch between rendered view and raw markdown */}
                <div className="flex items-center gap-1 bg-ink/5 p-0.5 rounded-lg border border-line text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('rendered')}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                      viewMode === 'rendered'
                        ? 'bg-panel shadow-xs font-medium text-fg'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    Xem bài viết có ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('raw')}
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                      viewMode === 'raw'
                        ? 'bg-panel shadow-xs font-medium text-fg'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    Mã Markdown
                  </button>
                </div>

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
                  <span className="text-xs font-medium text-muted">Nội dung chi tiết</span>
                  {viewMode === 'rendered' ? (
                    <div className="bg-panel p-4 rounded-lg border border-line max-h-64 overflow-y-auto">
                      <BlogContent content={result.fullDescription} />
                    </div>
                  ) : (
                    <div className="text-xs text-muted font-mono whitespace-pre-wrap bg-panel p-3 rounded-lg border border-line max-h-64 overflow-y-auto">
                      {result.fullDescription}
                    </div>
                  )}
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
                  <span className="text-xs font-medium text-muted">English Full Content</span>
                  {viewMode === 'rendered' ? (
                    <div className="bg-panel p-4 rounded-lg border border-line max-h-64 overflow-y-auto">
                      <BlogContent content={result.english.fullDescription} />
                    </div>
                  ) : (
                    <div className="text-xs text-muted font-mono whitespace-pre-wrap bg-panel p-3 rounded-lg border border-line max-h-64 overflow-y-auto">
                      {result.english.fullDescription}
                    </div>
                  )}
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
