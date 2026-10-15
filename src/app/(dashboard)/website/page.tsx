'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Input, Select, Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/components/ui'
import { 
  Settings, Palette, Type, Globe, Eye, Save, ExternalLink, 
  Smartphone, Monitor, ChevronRight, Check, AlertCircle, 
  Image, Layout as LayoutIcon, Link
} from 'lucide-react'

interface Property {
  id: string
  name: string
  subdomain: string
}

interface WebsiteSettings {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  headingFont: string
  layout: string
  metaTitle: string
  metaDescription: string
  customDomain: string
  isPublished: boolean
  publishedAt: string | null
}

const layoutOptions = [
  { value: 'modern', label: 'Hiện đại', description: 'Thiết kế tối giản, sang trọng' },
  { value: 'classic', label: 'Cổ điển', description: 'Phong cách truyền thống, ấm cúng' },
  { value: 'minimal', label: 'Tối giản', description: 'Tối đa hóa không gian trống' },
  { value: 'bold', label: 'Nổi bật', description: 'Màu sắc mạnh, ấn tượng' },
]

const fontOptions = [
  { value: 'Inter', label: 'Inter - Hiện đại, dễ đọc' },
  { value: 'Roboto', label: 'Roboto - Cổ điển, thanh lịch' },
  { value: 'Open Sans', label: 'Open Sans - Thân thiện, rõ ràng' },
  { value: 'Playfair Display', label: 'Playfair Display - Sang trọng, quý phái' },
  { value: 'Poppins', label: 'Poppins - Năng động, trẻ trung' },
]

const colorPresets = [
  { name: 'Xanh dương', primary: '#3B82F6', secondary: '#10B981', accent: '#F59E0B' },
  { name: 'Xanh lá', primary: '#059669', secondary: '#0891B2', accent: '#F59E0B' },
  { name: 'Tím', primary: '#7C3AED', secondary: '#EC4899', accent: '#F59E0B' },
  { name: 'Đỏ', primary: '#DC2626', secondary: '#EA580C', accent: '#F59E0B' },
  { name: 'Vàng', primary: '#CA8A04', secondary: '#65A30D', accent: '#0EA5E9' },
  { name: 'Hồng', primary: '#DB2777', secondary: '#7C3AED', accent: '#F59E0B' },
]

export default function WebsiteBuilderPage() {
  const router = useRouter()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = React.useState('')
  const [settings, setSettings] = React.useState<WebsiteSettings | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [formData, setFormData] = React.useState({
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
    fontFamily: 'Inter',
    headingFont: 'Playfair Display',
    layout: 'modern',
    metaTitle: '',
    metaDescription: '',
    customDomain: '',
    isPublished: false,
  })

  React.useEffect(() => {
    fetchProperties()
  }, [])

  React.useEffect(() => {
    if (selectedProperty) {
      fetchSettings()
    }
  }, [selectedProperty])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        setSelectedProperty(data.data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    }
  }

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/website/settings?propertyId=${selectedProperty}`)
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        setFormData({
          primaryColor: data.data.primaryColor || '#3B82F6',
          secondaryColor: data.data.secondaryColor || '#10B981',
          accentColor: data.data.accentColor || '#F59E0B',
          fontFamily: data.data.fontFamily || 'Inter',
          headingFont: data.data.headingFont || 'Playfair Display',
          layout: data.data.layout || 'modern',
          metaTitle: data.data.metaTitle || '',
          metaDescription: data.data.metaDescription || '',
          customDomain: data.data.customDomain || '',
          isPublished: data.data.isPublished || false,
        })
      } else {
        setSettings(null)
        setFormData({
          primaryColor: '#3B82F6',
          secondaryColor: '#10B981',
          accentColor: '#F59E0B',
          fontFamily: 'Inter',
          headingFont: 'Playfair Display',
          layout: 'modern',
          metaTitle: '',
          metaDescription: '',
          customDomain: '',
          isPublished: false,
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (publish = false) => {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/website/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty,
          settings: {
            ...formData,
            isPublished: publish ? true : formData.isPublished,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        setFormData((prev) => ({ ...prev, isPublished: data.data.isPublished }))
        setMessage({ 
          type: 'success', 
          text: publish ? 'Website đã được xuất bản!' : 'Lưu thay đổi thành công!' 
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Lỗi khi lưu' })
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
      setMessage({ type: 'error', text: 'Đã xảy ra lỗi' })
    } finally {
      setIsSaving(false)
    }
  }

  const applyPreset = (preset: typeof colorPresets[0]) => {
    setFormData({
      ...formData,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    })
  }

  const getPropertyUrl = () => {
    const property = properties.find((p) => p.id === selectedProperty)
    if (property) {
      return `https://${property.subdomain}.digistay.vn`
    }
    return ''
  }

  return (
    <div>
      <Header
        title="Website Builder"
        description="Tùy chỉnh website công khai cho cơ sở của bạn"
        actions={
          <div className="flex items-center gap-3">
            <Select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-64"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => window.open(getPropertyUrl(), '_blank')}>
              <Eye className="w-4 h-4 mr-2" />
              Xem website
            </Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Lưu
            </Button>
            <Button onClick={() => handleSave(true)} disabled={isSaving || formData.isPublished}>
              <Globe className="w-4 h-4 mr-2" />
              Xuất bản
            </Button>
          </div>
        }
      />

      <PageContainer>
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {formData.isPublished && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-800">Website đã được xuất bản</p>
                <p className="text-sm text-green-600">
                  URL: <a href={getPropertyUrl()} target="_blank" className="underline">{getPropertyUrl()}</a>
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.open(getPropertyUrl(), '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Mở website
            </Button>
          </div>
        )}

        <Tabs defaultValue="design" className="space-y-6">
          <TabsList>
            <TabsTrigger value="design">
              <Palette className="w-4 h-4 mr-2" />
              Thiết kế
            </TabsTrigger>
            <TabsTrigger value="content">
              <Type className="w-4 h-4 mr-2" />
              Nội dung
            </TabsTrigger>
            <TabsTrigger value="seo">
              <Globe className="w-4 h-4 mr-2" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="domain">
              <Link className="w-4 h-4 mr-2" />
              Domain
            </TabsTrigger>
          </TabsList>

          {/* Design Tab */}
          <TabsContent value="design">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Settings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Color Presets */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Bảng màu có sẵn</h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPreset(preset)}
                          className="p-3 rounded-lg border hover:border-primary transition-colors"
                          title={preset.name}
                        >
                          <div className="flex gap-1 mb-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }} />
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.secondary }} />
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.accent }} />
                          </div>
                          <p className="text-xs text-gray-600">{preset.name}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Colors */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Màu tùy chỉnh</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Màu chính</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="w-10 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Màu phụ</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="w-10 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Màu nhấn</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.accentColor}
                            onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                            className="w-10 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={formData.accentColor}
                            onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Font Settings */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Phông chữ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="Phông chữ nội dung"
                        value={formData.fontFamily}
                        onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                      >
                        {fontOptions.map((font) => (
                          <option key={font.value} value={font.value}>{font.label}</option>
                        ))}
                      </Select>
                      <Select
                        label="Phông chữ tiêu đề"
                        value={formData.headingFont}
                        onChange={(e) => setFormData({ ...formData, headingFont: e.target.value })}
                      >
                        {fontOptions.map((font) => (
                          <option key={font.value} value={font.value}>{font.label}</option>
                        ))}
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Layout */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Bố cục</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {layoutOptions.map((layout) => (
                        <button
                          key={layout.value}
                          onClick={() => setFormData({ ...formData, layout: layout.value })}
                          className={`p-4 rounded-lg border text-left transition-all ${
                            formData.layout === layout.value 
                              ? 'border-primary bg-primary-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <LayoutIcon className="w-6 h-6 mb-2 text-gray-600" />
                          <p className="font-medium text-sm">{layout.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Preview</h3>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="p-2">
                          <Smartphone className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="p-2">
                          <Monitor className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Mini Preview */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                      {/* Header */}
                      <div 
                        className="h-20 px-4 flex items-center"
                        style={{ backgroundColor: formData.primaryColor }}
                      >
                        <div className="w-8 h-8 bg-white/20 rounded" />
                        <div className="ml-3">
                          <div className="w-24 h-3 bg-white/40 rounded" />
                          <div className="w-16 h-2 bg-white/20 rounded mt-1" />
                        </div>
                      </div>
                      
                      {/* Hero */}
                      <div className="h-32 flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                          <div 
                            className="w-32 h-5 mx-auto rounded"
                            style={{ 
                              fontFamily: formData.headingFont,
                              backgroundColor: formData.primaryColor,
                              color: 'white'
                            }}
                          />
                          <div className="w-48 h-2 bg-gray-300 rounded mx-auto mt-2" />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 bg-gray-100 rounded" />
                          ))}
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-full" />
                        <div className="h-3 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                      
                      {/* Footer */}
                      <div 
                        className="h-12 px-4 flex items-center"
                        style={{ backgroundColor: formData.secondaryColor }}
                      >
                        <div className="w-20 h-2 bg-white/40 rounded" />
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center mt-3">
                      Preview trên điện thoại
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Nội dung Website</h3>
                <p className="text-gray-500 mb-4">
                  Quản lý nội dung hiển thị trên website công khai của bạn bao gồm giới thiệu, hình ảnh, và thông tin liên hệ.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Button variant="secondary" className="h-auto py-4 justify-start">
                    <Image className="w-5 h-5 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Quản lý Hình ảnh</p>
                      <p className="text-sm text-gray-500">Thư viện ảnh cơ sở</p>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto text-gray-400" />
                  </Button>
                  <Button variant="secondary" className="h-auto py-4 justify-start">
                    <LayoutIcon className="w-5 h-5 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Quản lý Trang</p>
                      <p className="text-sm text-gray-500">Nội dung trang giới thiệu</p>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto text-gray-400" />
                  </Button>
                </div>
                <p className="text-sm text-gray-400 mt-6">
                  Tính năng đang được phát triển. Các trang và nội dung sẽ sớm có.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Cài đặt SEO</h3>
                <p className="text-gray-500 mb-6">
                  Tối ưu website của bạn cho công cụ tìm kiếm
                </p>
                
                <div className="space-y-4">
                  <Input
                    label="Tiêu đề trang (Meta Title)"
                    value={formData.metaTitle}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    placeholder="Khách sạn ABC - Đặt phòng trực tuyến"
                    helperText={`${formData.metaTitle.length}/60 ký tự`}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mô tả trang (Meta Description)
                    </label>
                    <textarea
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      placeholder="Mô tả ngắn gọn về cơ sở của bạn..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.metaDescription.length}/160 ký tự</p>
                  </div>

                  {/* SEO Preview */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">Preview trên Google:</p>
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-blue-600 text-lg hover:underline cursor-pointer">
                        {formData.metaTitle || 'Tiêu đề website của bạn'}
                      </p>
                      <p className="text-green-700 text-sm">
                        {getPropertyUrl()}
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        {formData.metaDescription || 'Mô tả website sẽ hiển thị ở đây...'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Domain Tab */}
          <TabsContent value="domain">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Kết nối Domain</h3>
                
                <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">Website miễn phí</p>
                    <p className="text-sm text-blue-600 mt-1">
                      Website của bạn đã có sẵn tại:{' '}
                      <a href={getPropertyUrl()} target="_blank" className="underline">
                        {getPropertyUrl()}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Custom Domain (Tùy chọn)"
                    value={formData.customDomain}
                    onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                    placeholder="hotel.example.com"
                    helperText="Kết nối domain riêng của bạn với website"
                  />
                  
                  <Button variant="secondary">
                    Hướng dẫn kết nối domain
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  )
}
