'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Header, PageContainer } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
} from '@/components/ui'
import { EnglishCopy } from '@/components/ui/english-copy'
import { PhotoUploadButton } from '@/components/ui/photo-upload'
import { ProvinceWardFields } from '@/components/address/province-ward-fields'
import { propertyProvince } from '@/lib/vn-admin/provinces'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { routes } from '@/lib/utils/routes'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Send,
  Share2,
  Clock,
  Wifi,
  FileText,
  Star,
  Save,
  ExternalLink,
  Info,
  Trash2,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react'

const PROPERTY_TYPES = [
  { value: 'HOTEL', label: 'Khách sạn tiêu chuẩn (Hotel)' },
  { value: 'RESORT', label: 'Khu nghỉ dưỡng (Resort)' },
  { value: 'HOMESTAY', label: 'Nhà dân bản địa (Homestay)' },
  { value: 'VILLA', label: 'Biệt thự nghỉ dưỡng (Villa)' },
  { value: 'APARTMENT', label: 'Căn hộ dịch vụ (Apartment)' },
  { value: 'HOSTEL', label: 'Nhà nghỉ / Ký túc xá (Hostel / Motel)' },
  { value: 'BOUTIQUE', label: 'Khách sạn phong cách (Boutique Hotel)' },
]

const STAR_OPTIONS = [
  { value: '0', label: 'Không xếp hạng sao / Tiêu chuẩn tự do' },
  { value: '1', label: '⭐ 1 sao (Tiêu chuẩn cơ bản)' },
  { value: '2', label: '⭐⭐ 2 sao (Tiêu chuẩn tiện nghi)' },
  { value: '3', label: '⭐⭐⭐ 3 sao (Trung cấp chất lượng)' },
  { value: '4', label: '⭐⭐⭐⭐ 4 sao (Cao cấp sang trọng)' },
  { value: '5', label: '⭐⭐⭐⭐⭐ 5 sao (Đẳng cấp quốc tế)' },
]

/** Nút tròn chữ i hiển thị giải thích trực quan khi rê chuột hoặc nhấp */
function FieldInfo({ hint }: { hint: string }) {
  return (
    <span className="relative inline-flex items-center group cursor-help ml-1.5 align-middle">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-acc/10 text-acc hover:bg-acc/20 text-[11px] font-bold transition-colors">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block group-focus-within:block z-50 w-64 p-2 text-xs leading-relaxed text-on-ink bg-ink rounded-ctl shadow-lift text-center">
        {hint}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-ink" />
      </span>
    </span>
  )
}

export default function PropertySettingsPage() {
  const params = useParams<{ slug: string; id: string }>()
  const router = useRouter()
  const slug = params.slug
  const propertyId = params.id

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'branding' | 'contact' | 'address' | 'operations' | 'legal'>('branding')
  const [property, setProperty] = React.useState<any>(null)

  const [form, setForm] = React.useState({
    name: '',
    type: 'HOTEL',
    starRating: 0,
    slogan: '',
    logo: '',
    coverImage: '',
    description: '',
    enDescription: '',

    // Contacts
    phone: '',
    hotline: '',
    receptionPhone: '',
    email: '',
    website: '',

    // Socials
    zalo: '',
    whatsapp: '',
    telegram: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',

    // Address
    provinceCode: '',
    wardCode: '',
    address: '',
    latitude: '',
    longitude: '',
    googleMapsUrl: '',
    directionsGuide: '',

    // Operations
    checkInTime: '14:00',
    checkOutTime: '12:00',
    wifiName: '',
    wifiPassword: '',

    // Legal
    businessName: '',
    taxCode: '',
    businessLicense: '',
    invoiceAddress: '',
  })

  const loadProperty = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}`)
      const json = await res.json()
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể tải thông tin khách sạn')
        return
      }
      const p = json.data
      setProperty(p)
      const savedProvince = propertyProvince(p)

      setForm({
        name: p.name || '',
        type: p.type || 'HOTEL',
        starRating: p.starRating ?? 0,
        slogan: p.slogan || '',
        logo: p.logo || '',
        coverImage: p.coverImage || '',
        description: p.description || '',
        enDescription: p.translations?.en?.description || '',

        phone: p.phone || '',
        hotline: p.hotline || '',
        receptionPhone: p.receptionPhone || '',
        email: p.email || '',
        website: p.website || '',

        zalo: p.zalo || '',
        whatsapp: p.whatsapp || '',
        telegram: p.telegram || '',
        facebook: p.facebook || '',
        instagram: p.instagram || '',
        tiktok: p.tiktok || '',
        youtube: p.youtube || '',

        provinceCode: savedProvince?.code ?? p.provinceCode ?? '',
        wardCode: p.wardCode ?? '',
        address: p.address || '',
        latitude: p.latitude != null ? String(p.latitude) : '',
        longitude: p.longitude != null ? String(p.longitude) : '',
        googleMapsUrl: p.googleMapsUrl || '',
        directionsGuide: p.directionsGuide || '',

        checkInTime: p.checkInTime || p.policy?.checkInTime || '14:00',
        checkOutTime: p.checkOutTime || p.policy?.checkOutTime || '12:00',
        wifiName: p.wifiName || '',
        wifiPassword: p.wifiPassword || '',

        businessName: p.businessName || '',
        taxCode: p.taxCode || '',
        businessLicense: p.businessLicense || '',
        invoiceAddress: p.invoiceAddress || '',
      })
    } catch {
      toast.error('Lỗi kết nối khi tải dữ liệu khách sạn')
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  React.useEffect(() => {
    loadProperty()
  }, [loadProperty])

  const setField = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    try {
      const place = form.provinceCode
        ? { provinceCode: form.provinceCode, wardCode: form.wardCode || null }
        : {}

      const payload = {
        name: form.name.trim(),
        type: form.type,
        starRating: Number(form.starRating) > 0 ? Number(form.starRating) : null,
        slogan: form.slogan.trim() || null,
        logo: form.logo.trim() || null,
        coverImage: form.coverImage.trim() || null,
        description: form.description.trim() || null,
        translations: {
          en: {
            description: form.enDescription.trim() || undefined,
          },
        },

        phone: form.phone.trim() || null,
        hotline: form.hotline.trim() || null,
        receptionPhone: form.receptionPhone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,

        zalo: form.zalo.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        telegram: form.telegram.trim() || null,
        facebook: form.facebook.trim() || null,
        instagram: form.instagram.trim() || null,
        tiktok: form.tiktok.trim() || null,
        youtube: form.youtube.trim() || null,

        address: form.address.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        googleMapsUrl: form.googleMapsUrl.trim() || null,
        directionsGuide: form.directionsGuide.trim() || null,

        checkInTime: form.checkInTime.trim() || '14:00',
        checkOutTime: form.checkOutTime.trim() || '12:00',
        wifiName: form.wifiName.trim() || null,
        wifiPassword: form.wifiPassword.trim() || null,

        businessName: form.businessName.trim() || null,
        taxCode: form.taxCode.trim() || null,
        businessLicense: form.businessLicense.trim() || null,
        invoiceAddress: form.invoiceAddress.trim() || null,

        ...place,
      }

      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast.error(apiError(data.error) || 'Không thể lưu thông tin khách sạn')
        return
      }

      toast.success('Đã lưu toàn bộ thông tin khách sạn thành công!')
      loadProperty()
    } catch {
      toast.error('Lỗi khi gửi yêu cầu cập nhật thông tin')
    } finally {
      setIsSaving(false)
    }
  }

  const savedProvince = property ? propertyProvince(property) : null
  const legacyCity = savedProvince ? undefined : property?.city

  if (isLoading) {
    return (
      <PageContainer>
        <div className="py-24 text-center text-muted">
          <div className="w-8 h-8 border-2 border-acc border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Đang tải thông tin chi tiết khách sạn...</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Thông tin khách sạn"
        description="Quản lý chi tiết hồ sơ khách sạn, thương hiệu, kênh liên hệ trực tiếp, mạng xã hội, định vị và thông tin vận hành."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {property?.subdomain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/${property.subdomain}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Xem website
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave()}
              isLoading={isSaving}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Lưu thay đổi
            </Button>
          </div>
        }
      />

      {/* Tabs bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-line pb-px mb-6 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'branding'
              ? 'border-acc text-acc bg-acc/5 rounded-t-ctl'
              : 'border-transparent text-muted hover:text-fg hover:border-line'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Thương hiệu & Hình ảnh
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'contact'
              ? 'border-acc text-acc bg-acc/5 rounded-t-ctl'
              : 'border-transparent text-muted hover:text-fg hover:border-line'
          }`}
        >
          <Phone className="w-4 h-4" />
          Liên hệ & Mạng xã hội
          {(form.zalo || form.whatsapp || form.facebook) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('address')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'address'
              ? 'border-acc text-acc bg-acc/5 rounded-t-ctl'
              : 'border-transparent text-muted hover:text-fg hover:border-line'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Địa chỉ & Định vị GPS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'operations'
              ? 'border-acc text-acc bg-acc/5 rounded-t-ctl'
              : 'border-transparent text-muted hover:text-fg hover:border-line'
          }`}
        >
          <Clock className="w-4 h-4" />
          Vận hành & Tiện ích khách
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('legal')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'legal'
              ? 'border-acc text-acc bg-acc/5 rounded-t-ctl'
              : 'border-transparent text-muted hover:text-fg hover:border-line'
          }`}
        >
          <FileText className="w-4 h-4" />
          Pháp lý & Doanh nghiệp
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: THƯƠNG HIỆU & HÌNH ẢNH */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-5 h-5 text-acc" />
                  Logo & Ảnh bìa khách sạn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo upload / input */}
                  <div className="space-y-3 p-4 rounded-box border border-line bg-raised/30">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-fg flex items-center">
                        Logo khách sạn
                        <FieldInfo hint="Ảnh đại diện chính thức hình vuông (tỷ lệ 1:1, dung lượng dưới 5MB). Hiển thị trên đầu trang web, thanh bên, hóa đơn và email gửi khách." />
                      </label>
                      <PhotoUploadButton
                        target={{ propertyId }}
                        onUploaded={(url) => setForm((prev) => ({ ...prev, logo: url }))}
                        label="Tải ảnh logo"
                        size="sm"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-line bg-page shrink-0 flex items-center justify-center shadow-sm">
                        {form.logo ? (
                          <Image src={form.logo} alt="Logo" fill className="object-contain p-1" />
                        ) : (
                          <Building2 className="w-8 h-8 text-muted/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Input
                          placeholder="Hoặc dán URL logo (https://...)"
                          value={form.logo}
                          onChange={setField('logo')}
                        />
                        {form.logo && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, logo: '' }))}
                            className="text-xs text-err hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Gỡ logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cover banner upload / input */}
                  <div className="space-y-3 p-4 rounded-box border border-line bg-raised/30">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-fg flex items-center">
                        Ảnh bìa (Cover Banner)
                        <FieldInfo hint="Hình nền lớn hiển thị ở đầu trang chủ (Hero section), ảnh xem trước khi gửi link qua Zalo/Facebook." />
                      </label>
                      <PhotoUploadButton
                        target={{ propertyId }}
                        onUploaded={(url) => setForm((prev) => ({ ...prev, coverImage: url }))}
                        label="Tải ảnh bìa"
                        size="sm"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-line bg-page shrink-0 flex items-center justify-center shadow-sm">
                        {form.coverImage ? (
                          <Image src={form.coverImage} alt="Cover Banner" fill className="object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Input
                          placeholder="Hoặc dán URL ảnh bìa (https://...)"
                          value={form.coverImage}
                          onChange={setField('coverImage')}
                        />
                        {form.coverImage && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, coverImage: '' }))}
                            className="text-xs text-err hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Gỡ ảnh bìa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-acc" />
                  Định vị thương hiệu & Giới thiệu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      label={
                        <span className="flex items-center">
                          Tên khách sạn / Cơ sở lưu trú <span className="text-err ml-1">*</span>
                          <FieldInfo hint="Tên thương hiệu đầy đủ của khách sạn. Tên này xuất hiện trên toàn bộ website, tin nhắn và văn bản xuất hóa đơn." />
                        </span>
                      }
                      value={form.name}
                      onChange={setField('name')}
                      required
                      minLength={2}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Select
                      label={
                        <span className="flex items-center">
                          Loại hình lưu trú
                          <FieldInfo hint="Mô hình hoạt động của bạn giúp hệ thống tối ưu hóa thuật toán hiển thị và các tiện nghi phòng phù hợp." />
                        </span>
                      }
                      options={PROPERTY_TYPES}
                      value={form.type}
                      onChange={setField('type')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label={
                        <span className="flex items-center">
                          Tiêu chuẩn xếp hạng sao
                          <FieldInfo hint="Xếp hạng sao theo chứng nhận của Tổng cục Du lịch hoặc tiêu chuẩn dịch vụ khách sạn hướng tới." />
                        </span>
                      }
                      options={STAR_OPTIONS}
                      value={String(form.starRating)}
                      onChange={setField('starRating')}
                    />
                  </div>

                  <div>
                    <Input
                      label={
                        <span className="flex items-center">
                          Khẩu hiệu / Slogan ngắn
                          <FieldInfo hint="Câu slogan truyền cảm hứng, hiển thị nổi bật dưới tên khách sạn (ví dụ: 'Nơi khởi đầu cho kỳ nghỉ hoàn hảo')." />
                        </span>
                      }
                      placeholder="VD: Không gian nghỉ dưỡng đẳng cấp giữa lòng thành phố"
                      value={form.slogan}
                      onChange={setField('slogan')}
                      maxLength={255}
                    />
                  </div>
                </div>

                <div>
                  <Textarea
                    label={
                      <span className="flex items-center">
                        Giới thiệu chi tiết khách sạn (Tiếng Việt)
                        <FieldInfo hint="Mô tả tổng thể về quy mô, không gian, vị trí, phong cách phục vụ và những điểm đặc sắc nhất của khách sạn." />
                      </span>
                    }
                    placeholder="Mô tả chi tiết về lịch sử hình thành, kiến trúc, các tiện ích nổi bật và trải nghiệm mà khách sẽ nhận được khi lưu trú..."
                    value={form.description}
                    onChange={setField('description')}
                    rows={5}
                    maxLength={4000}
                  />
                </div>

                <EnglishCopy filled={Boolean(form.enDescription)}>
                  <Textarea
                    label="Giới thiệu chi tiết bằng Tiếng Anh (English Description)"
                    placeholder="Describe your property for international visitors..."
                    value={form.enDescription}
                    onChange={setField('enDescription')}
                    rows={4}
                    maxLength={4000}
                  />
                </EnglishCopy>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: LIÊN HỆ & MẠNG XÃ HỘI */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-5 h-5 text-acc" />
                  Kênh liên hệ trực tiếp (Điện thoại & Email)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Hotline đặt phòng 24/7
                        <FieldInfo hint="Số điện thoại ưu tiên để khách gọi đặt phòng hoặc yêu cầu hỗ trợ khẩn cấp. Khách có thể bấm để gọi ngay trên điện thoại." />
                      </span>
                    }
                    type="tel"
                    placeholder="VD: 0901234567 hoặc 1900xxxx"
                    value={form.hotline}
                    onChange={setField('hotline')}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Số điện thoại lễ tân / bàn tiếp tân
                        <FieldInfo hint="Số máy bàn lễ tân hoặc số hotline trực ban tại quầy check-in." />
                      </span>
                    }
                    type="tel"
                    placeholder="VD: 024.3822xxxx"
                    value={form.receptionPhone}
                    onChange={setField('receptionPhone')}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Số điện thoại quản lý / phụ trợ
                        <FieldInfo hint="Số điện thoại bổ sung hiển thị trên hóa đơn hoặc danh bạ liên hệ." />
                      </span>
                    }
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={form.phone}
                    onChange={setField('phone')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Email tiếp nhận đặt phòng
                        <FieldInfo hint="Email dùng để nhận thông báo đặt phòng mới và gửi thư xác nhận (Booking Confirmation) cho khách lưu trú." />
                      </span>
                    }
                    type="email"
                    placeholder="booking@hotelname.com"
                    value={form.email}
                    onChange={setField('email')}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Website chính thức riêng (nếu có)
                        <FieldInfo hint="Nếu khách sạn có tên miền riêng ngoài hệ thống subdomain Digistay, bạn có thể điền tại đây." />
                      </span>
                    }
                    type="url"
                    placeholder="https://yourhotel.com"
                    value={form.website}
                    onChange={setField('website')}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-acc" />
                  Mạng xã hội & Kênh chat trực tiếp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted mb-2">
                  Khách hàng có thể nhấn vào các nút mạng xã hội này trên website để kết nối và chat trực tiếp với nhân viên khách sạn.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2" />
                          Zalo Khách sạn (Số ĐT hoặc Link OA)
                          <FieldInfo hint="Nhập số điện thoại đăng ký Zalo hoặc link Zalo Official Account. Khách nhấn vào sẽ mở ngay khung chat Zalo." />
                        </span>
                      }
                      placeholder="VD: 0901234567 hoặc https://zalo.me/..."
                      value={form.zalo}
                      onChange={setField('zalo')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                          WhatsApp (Khách quốc tế)
                          <FieldInfo hint="Số WhatsApp gồm mã quốc tế (VD: +84901234567) hoặc link wa.me/... Rất quan trọng khi đón khách du lịch nước ngoài." />
                        </span>
                      }
                      placeholder="VD: +84901234567 hoặc https://wa.me/..."
                      value={form.whatsapp}
                      onChange={setField('whatsapp')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-2" />
                          Telegram (Hỗ trợ 24/7)
                          <FieldInfo hint="Tên người dùng Telegram (@hotel_support) hoặc liên kết chat https://t.me/yourhotel." />
                        </span>
                      }
                      placeholder="VD: @hotel_support hoặc https://t.me/..."
                      value={form.telegram}
                      onChange={setField('telegram')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mr-2" />
                          Facebook Fanpage
                          <FieldInfo hint="Link trang Facebook chính thức của khách sạn (VD: https://facebook.com/hotelname)." />
                        </span>
                      }
                      placeholder="https://facebook.com/yourfanpage"
                      value={form.facebook}
                      onChange={setField('facebook')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 mr-2" />
                          Instagram
                          <FieldInfo hint="Trang Instagram chia sẻ hình ảnh phòng và cảnh quan khách sạn." />
                        </span>
                      }
                      placeholder="https://instagram.com/yourhotel hoặc @yourhotel"
                      value={form.instagram}
                      onChange={setField('instagram')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 dark:bg-neutral-100 mr-2" />
                          TikTok
                          <FieldInfo hint="Kênh TikTok đăng tải video ngắn review phòng và dịch vụ khách sạn." />
                        </span>
                      }
                      placeholder="https://tiktok.com/@yourhotel"
                      value={form.tiktok}
                      onChange={setField('tiktok')}
                    />
                  </div>

                  <div className="p-3 rounded-ctl border border-line bg-raised/20 space-y-1.5 sm:col-span-2">
                    <Input
                      label={
                        <span className="flex items-center font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 mr-2" />
                          YouTube
                          <FieldInfo hint="Kênh video giới thiệu tour tham quan thực tế toàn cảnh khách sạn." />
                        </span>
                      }
                      placeholder="https://youtube.com/@yourhotel"
                      value={form.youtube}
                      onChange={setField('youtube')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: ĐỊA CHỈ & ĐỊNH VỊ GPS */}
        {activeTab === 'address' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-acc" />
                  Địa chỉ hành chính chính thức
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProvinceWardFields
                  value={{ provinceCode: form.provinceCode, wardCode: form.wardCode }}
                  onChange={(place) => setForm((prev) => ({ ...prev, ...place }))}
                  required={!legacyCity}
                  legacyCity={legacyCity}
                  savedWardName={
                    form.wardCode && form.wardCode === property?.wardCode
                      ? property?.ward ?? undefined
                      : undefined
                  }
                />

                <Input
                  label={
                    <span className="flex items-center">
                      Địa chỉ chi tiết (Số nhà, tên đường, khu phố) <span className="text-err ml-1">*</span>
                      <FieldInfo hint="Số nhà, đường phố hoặc thôn xóm để khách và tài xế xe dễ dàng tìm thấy địa điểm." />
                    </span>
                  }
                  value={form.address}
                  onChange={setField('address')}
                  placeholder="VD: 123 Đường Trần Phú, Khu phố 4"
                  required
                  minLength={5}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-5 h-5 text-acc" />
                  Tọa độ GPS & Chỉ đường Google Maps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Vĩ độ (Latitude)
                        <FieldInfo hint="Tọa độ vĩ độ GPS (ví dụ: 16.0544 cho Đà Nẵng). Dùng để cắm mốc trên bản đồ số." />
                      </span>
                    }
                    placeholder="VD: 16.0544"
                    value={form.latitude}
                    onChange={setField('latitude')}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Kinh độ (Longitude)
                        <FieldInfo hint="Tọa độ kinh độ GPS (ví dụ: 108.2022 cho Đà Nẵng)." />
                      </span>
                    }
                    placeholder="VD: 108.2022"
                    value={form.longitude}
                    onChange={setField('longitude')}
                  />
                </div>

                <Input
                  label={
                    <span className="flex items-center">
                      Đường dẫn Google Maps (Chia sẻ vị trí)
                      <FieldInfo hint="Link vị trí khách sạn từ Google Maps (VD: https://maps.app.goo.gl/...). Khách có thể nhấn vào để mở ứng dụng Google Maps chỉ đường trực tiếp." />
                    </span>
                  }
                  placeholder="https://maps.app.goo.gl/..."
                  value={form.googleMapsUrl}
                  onChange={setField('googleMapsUrl')}
                />

                <Textarea
                  label={
                    <span className="flex items-center">
                      Hướng dẫn chỉ đường & Mô tả vị trí lân cận
                      <FieldInfo hint="Chỉ dẫn các mốc nhận biết thuận tiện cho khách (VD: 'Cách sân bay 10 phút lái xe, đối diện cổng vào bãi biển Mỹ Khê, kế bên nhà hàng ABC')." />
                    </span>
                  }
                  placeholder="Mô tả vị trí xung quanh, khoảng cách đến ga tàu, sân bay, bến xe hoặc điểm du lịch nổi tiếng..."
                  value={form.directionsGuide}
                  onChange={setField('directionsGuide')}
                  rows={3}
                  maxLength={2000}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: VẬN HÀNH & TIỆN ÍCH KHÁCH */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-acc" />
                  Khung giờ nhận / trả phòng tiêu chuẩn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted mb-2">
                  Khung giờ này hiển thị trong thông tin đặt phòng, email xác nhận và dùng làm căn cứ tính phí check-in sớm hoặc check-out trễ.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Giờ nhận phòng tiêu chuẩn (Check-in time)
                        <FieldInfo hint="Khung giờ sớm nhất khách có thể nhận phòng (định dạng HH:mm, thường là 14:00)." />
                      </span>
                    }
                    type="time"
                    value={form.checkInTime}
                    onChange={setField('checkInTime')}
                    required
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Giờ trả phòng tiêu chuẩn (Check-out time)
                        <FieldInfo hint="Khung giờ muộn nhất khách phải bàn giao phòng (định dạng HH:mm, thường là 12:00 trưa)." />
                      </span>
                    }
                    type="time"
                    value={form.checkOutTime}
                    onChange={setField('checkOutTime')}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-acc" />
                  Thông tin kết nối Wi-Fi dành cho khách
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted mb-2">
                  Thông tin Wi-Fi tự động hiển thị trong trang xác nhận đặt phòng và hướng dẫn nhận phòng gửi đến điện thoại khách hàng.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Tên mạng Wi-Fi (SSID)
                        <FieldInfo hint="Tên sóng Wi-Fi phát trong khuôn viên khách sạn (VD: 'Hotel_Guests_Free')." />
                      </span>
                    }
                    placeholder="VD: Digistay_Guest_Highspeed"
                    value={form.wifiName}
                    onChange={setField('wifiName')}
                    maxLength={100}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Mật khẩu Wi-Fi (Password)
                        <FieldInfo hint="Mật khẩu truy cập mạng Wi-Fi của khách sạn." />
                      </span>
                    }
                    placeholder="VD: chaomungquykhach2026"
                    value={form.wifiPassword}
                    onChange={setField('wifiPassword')}
                    maxLength={100}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 5: PHÁP LÝ & DOANH NGHIỆP */}
        {activeTab === 'legal' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-acc" />
                  Thông tin doanh nghiệp & Pháp lý
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Tên công ty / Đơn vị chủ quản
                        <FieldInfo hint="Tên pháp nhân công ty hoặc hộ kinh doanh sở hữu khách sạn (hiển thị trên hóa đơn tài chính)." />
                      </span>
                    }
                    placeholder="VD: Công ty TNHH Khách Sạn Biển Xanh"
                    value={form.businessName}
                    onChange={setField('businessName')}
                    maxLength={200}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Mã số thuế (MST)
                        <FieldInfo hint="Mã số thuế doanh nghiệp hoặc hộ kinh doanh cấp bởi Cơ quan Thuế." />
                      </span>
                    }
                    placeholder="VD: 0101234567"
                    value={form.taxCode}
                    onChange={setField('taxCode')}
                    maxLength={50}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={
                      <span className="flex items-center">
                        Số Giấy phép kinh doanh (ĐKKD)
                        <FieldInfo hint="Số giấy chứng nhận đăng ký kinh doanh hoặc giấy phép hoạt động lưu trú du lịch." />
                      </span>
                    }
                    placeholder="VD: 01A8012345/ĐKKD"
                    value={form.businessLicense}
                    onChange={setField('businessLicense')}
                    maxLength={100}
                  />

                  <Input
                    label={
                      <span className="flex items-center">
                        Địa chỉ đăng ký xuất hóa đơn VAT
                        <FieldInfo hint="Địa chỉ trụ sở pháp lý của công ty in trên hóa đơn điện tử." />
                      </span>
                    }
                    placeholder="VD: Tầng 3, Tòa nhà ABC, Quận 1, TP. Hồ Chí Minh"
                    value={form.invoiceAddress}
                    onChange={setField('invoiceAddress')}
                    maxLength={300}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action bar bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(routes.property(slug, propertyId))}
          >
            Về trang Tổng quan khách sạn
          </Button>

          <Button type="submit" variant="primary" isLoading={isSaving}>
            <Save className="w-4 h-4 mr-1.5" />
            Lưu tất cả thay đổi
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}

