'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { 
  Monitor, Smartphone, Eye, Save, Globe, Palette, Type, Image, 
  Plus, Trash2, GripVertical, Settings, Layout, Sun, Moon, Search, ArrowRight,
  Check, X, ChevronRight
} from 'lucide-react'

interface WebsiteSettings {
  id: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  headingFont: string
  layout: string
  metaTitle: string
  metaDescription: string
  isPublished: boolean
  customDomain: string
  sslEnabled: boolean
}

interface Block {
  id: string
  type: string
  name: string
  isEnabled: boolean
  sortOrder: number
  config: any
}

const blockTypes = [
  { type: 'HERO', name: 'Banner chính', icon: Layout, description: 'Banner đầu trang với hình ảnh và tìm kiếm' },
  { type: 'ROOMS', name: 'Danh sách phòng', icon: Layout, description: 'Hiển thị các hạng phòng có sẵn' },
  { type: 'AMENITIES', name: 'Tiện ích', icon: Check, description: 'Danh sách tiện ích của cơ sở' },
  { type: 'ABOUT', name: 'Giới thiệu', icon: Type, description: 'Thông tin giới thiệu cơ sở' },
  { type: 'GALLERY', name: 'Thư viện ảnh', icon: Image, description: 'Bộ sưu tập hình ảnh' },
  { type: 'REVIEWS', name: 'Đánh giá', icon: Star, description: 'Hiển thị đánh giá khách hàng' },
  { type: 'MAP', name: 'Bản đồ', icon: Globe, description: 'Vị trí trên Google Maps' },
  { type: 'CONTACT', name: 'Liên hệ', icon: Settings, description: 'Thông tin liên hệ' },
  { type: 'CTA', name: 'Call to Action', icon: ArrowRight, description: 'Nút kêu gọi hành động' },
]

function Star(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  )
}

export default function WebsiteBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params.id as string

  const [settings, setSettings] = React.useState<WebsiteSettings | null>(null)
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop')
  const [activeTab, setActiveTab] = React.useState('blocks')

  React.useEffect(() => {
    fetchWebsiteData()
  }, [propertyId])

  const fetchWebsiteData = async () => {
    try {
      // Fetch blocks
      const blocksResponse = await fetch(`/api/website/blocks?propertyId=${propertyId}`)
      const blocksData = await blocksResponse.json()
      
      // Fetch settings
      const settingsResponse = await fetch(`/api/website/settings?propertyId=${propertyId}`)
      const settingsData = await settingsResponse.json()

      if (blocksData.success) {
        setBlocks(blocksData.data)
      }
      if (settingsData.success) {
        setSettings(settingsData.data)
      }
    } catch (err) {
      console.error('Failed to fetch website data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save blocks
      await fetch('/api/website/blocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, blocks }),
      })

      // Save settings
      if (settings) {
        await fetch('/api/website/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, settings }),
        })
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const addBlock = (type: string, name: string) => {
    const newBlock: Block = {
      id: `block-${Date.now()}`,
      type,
      name,
      isEnabled: true,
      sortOrder: blocks.length,
      config: {},
    }
    setBlocks([...blocks, newBlock])
  }

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId))
  }

  const toggleBlock = (blockId: string) => {
    setBlocks(blocks.map(b => 
      b.id === blockId ? { ...b, isEnabled: !b.isEnabled } : b
    ))
  }

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= blocks.length) return
    
    const temp = newBlocks[index]
    newBlocks[index] = newBlocks[targetIndex]
    newBlocks[targetIndex] = temp
    
    newBlocks.forEach((b, i) => b.sortOrder = i)
    setBlocks(newBlocks)
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/properties/${propertyId}`)}>
            Quay lại
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Website Builder</h1>
            <p className="text-sm text-gray-500">Tùy chỉnh giao diện website</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`p-2 rounded ${previewMode === 'desktop' ? 'bg-gray-100' : ''}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`p-2 rounded ${previewMode === 'mobile' ? 'bg-gray-100' : ''}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <Button variant="outline" onClick={() => window.open(`/preview/${propertyId}`, '_blank')}>
            <Eye className="w-4 h-4 mr-2" />
            Xem trước
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="blocks">Blocks</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="settings">Cài đặt</TabsTrigger>
            </TabsList>

            {/* Blocks Tab */}
            <TabsContent value="blocks" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Các khối giao diện</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {blockTypes.map((block) => {
                    const isAdded = blocks.some(b => b.type === block.type)
                    return (
                      <div 
                        key={block.type}
                        className={`p-3 rounded-lg border ${isAdded ? 'border-primary bg-primary-50' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <block.icon className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-sm">{block.name}</span>
                          </div>
                          {!isAdded ? (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => addBlock(block.type, block.name)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Badge variant="success">Đã thêm</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Current Blocks */}
              {blocks.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Thứ tự hiển thị</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {blocks.map((block, index) => (
                      <div 
                        key={block.id}
                        className={`p-3 rounded-lg border ${block.isEnabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                            <span className="font-medium text-sm">{block.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveBlock(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                              <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
                            </button>
                            <button
                              onClick={() => moveBlock(index, 'down')}
                              disabled={index === blocks.length - 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                              <ChevronRight className="w-4 h-4 rotate-[90deg]" />
                            </button>
                            <button
                              onClick={() => toggleBlock(block.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              {block.isEnabled ? <Eye className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => removeBlock(block.id)}
                              className="p-1 hover:bg-red-50 rounded text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Màu sắc
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Màu chính</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.primaryColor || '#3B82F6'}
                        onChange={(e) => setSettings({ ...settings!, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.primaryColor || '#3B82F6'}
                        onChange={(e) => setSettings({ ...settings!, primaryColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Màu phụ</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.secondaryColor || '#10B981'}
                        onChange={(e) => setSettings({ ...settings!, secondaryColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.secondaryColor || '#10B981'}
                        onChange={(e) => setSettings({ ...settings!, secondaryColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Màu nhấn</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings?.accentColor || '#F59E0B'}
                        onChange={(e) => setSettings({ ...settings!, accentColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={settings?.accentColor || '#F59E0B'}
                        onChange={(e) => setSettings({ ...settings!, accentColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Phông chữ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Phông chữ chính</label>
                    <select
                      value={settings?.fontFamily || 'Inter'}
                      onChange={(e) => setSettings({ ...settings!, fontFamily: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="Inter">Inter - Hiện đại</option>
                      <option value="Roboto">Roboto - Phổ biến</option>
                      <option value="Open Sans">Open Sans - Dễ đọc</option>
                      <option value="Lato">Lato - Thanh lịch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Phông chữ tiêu đề</label>
                    <select
                      value={settings?.headingFont || 'Playfair Display'}
                      onChange={(e) => setSettings({ ...settings!, headingFont: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="Playfair Display">Playfair Display - Sang trọng</option>
                      <option value="Merriweather">Merriweather - Truyền thống</option>
                      <option value="Poppins">Poppins - Trẻ trung</option>
                      <option value="Montserrat">Montserrat - Năng động</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SEO & Meta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Tiêu đề trang (Meta Title)"
                    value={settings?.metaTitle || ''}
                    onChange={(e) => setSettings({ ...settings!, metaTitle: e.target.value })}
                    placeholder="VD: Khách sạn ABC - Đặt phòng online"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700">Mô tả trang</label>
                    <textarea
                      value={settings?.metaDescription || ''}
                      onChange={(e) => setSettings({ ...settings!, metaDescription: e.target.value })}
                      placeholder="Mô tả ngắn về cơ sở của bạn..."
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Tên miền</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Tên miền tùy chỉnh"
                    value={settings?.customDomain || ''}
                    onChange={(e) => setSettings({ ...settings!, customDomain: e.target.value })}
                    placeholder="VD: khachsanabc.vn"
                  />
                  <p className="text-sm text-gray-500">
                    Sau khi thêm tên miền, hãy trỏ bản ghi CNAME về máy chủ của Digistay
                  </p>
                  {settings?.sslEnabled && (
                    <Badge variant="success" className="flex items-center gap-1 w-fit">
                      <Check className="w-4 h-4" />
                      SSL đã kích hoạt
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Xuất bản</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {settings?.isPublished ? 'Đã xuất bản' : 'Chưa xuất bản'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {settings?.isPublished 
                          ? 'Website đang hoạt động công khai' 
                          : 'Website chỉ hiển thị khi bạn xuất bản'}
                      </p>
                    </div>
                    <Button onClick={() => setSettings({ ...settings!, isPublished: !settings?.isPublished })}>
                      {settings?.isPublished ? 'Gỡ xuất bản' : 'Xuất bản ngay'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className={`bg-gray-100 border-b p-4 ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}`}>
              <div className="bg-white rounded-lg overflow-hidden shadow-lg">
                {/* Simulated browser header */}
                <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-500">
                    yourwebsite.com
                  </div>
                </div>
                
                {/* Website Preview Content */}
                <div className={`p-8 ${previewMode === 'mobile' ? 'text-sm' : ''}`}>
                  {blocks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Layout className="w-12 h-12 mx-auto mb-4" />
                      <p>Chưa có khối nào được thêm</p>
                      <p className="text-sm">Thêm các khối từ panel bên trái để xem trước</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {blocks.filter(b => b.isEnabled).map((block) => (
                        <div key={block.id} className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                          <Layout className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="font-medium text-gray-600">{block.name}</p>
                          <p className="text-sm text-gray-400">Preview của khối {block.type}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
