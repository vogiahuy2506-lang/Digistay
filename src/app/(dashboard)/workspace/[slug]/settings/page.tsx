'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Textarea, Badge } from '@/components/ui'
import {
  Settings, Building2, Globe, Bell, Shield, Users,
  Mail, Clock, DollarSign, Save, ArrowLeft, Upload
} from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import Image from 'next/image'

interface WorkspaceSettings {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  domain: string | null
  settings: {
    currency?: string
    timezone?: string
    businessType?: string
    notifications?: {
      email?: boolean
      sms?: boolean
      bookingAlert?: boolean
    }
  }
  owner: {
    id: string
    name: string | null
    email: string
  }
  _count: {
    properties: number
    members: number
  }
}

const currencies = [
  { value: 'VND', label: 'VND (₫) - Đồng Việt Nam' },
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'EUR', label: 'EUR (€) - Euro' },
  { value: 'SGD', label: 'SGD ($) - Singapore Dollar' },
]

const timezones = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
]

const businessTypes = [
  { value: 'HOTEL', label: 'Khách sạn (Hotel)' },
  { value: 'RESORT', label: 'Resort / Khu nghỉ dưỡng' },
  { value: 'HOMESTAY', label: 'Homestay / Căn hộ dịch vụ' },
  { value: 'BOUTIQUE', label: 'Boutique Hotel' },
  { value: 'VILLA', label: 'Villa / Biệt thự' },
  { value: 'MOTEL', label: 'Motel' },
  { value: 'HOSTEL', label: 'Hostel / Backpacker' },
]

export default function WorkspaceSettingsPage() {
  const router = useRouter()
  const { workspace } = useWorkspace()
  const [settings, setSettings] = React.useState<WorkspaceSettings | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('general')

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    logo: null as string | null,
    domain: '',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    businessType: 'HOTEL',
  })

  React.useEffect(() => {
    if (workspace?.id) {
      fetchSettings()
    }
  }, [workspace?.id])

  const fetchSettings = async () => {
    if (!workspace?.id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`)
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        const ws = data.data
        setFormData({
          name: ws.name,
          description: ws.description || '',
          logo: ws.logo || null,
          domain: ws.domain || '',
          currency: ws.settings?.currency || 'VND',
          timezone: ws.settings?.timezone || 'Asia/Ho_Chi_Minh',
          businessType: ws.settings?.businessType || 'HOTEL',
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!workspace?.id) return
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // First update basic info
      const basicRes = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          logo: formData.logo,
          domain: formData.domain || null,
        }),
      })

      if (!basicRes.ok) {
        const basicData = await basicRes.json()
        throw new Error(basicData.error || 'Lỗi khi lưu')
      }

      // Then update settings
      const settingsRes = await fetch(`/api/workspaces/${workspace.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: formData.currency,
          timezone: formData.timezone,
          businessType: formData.businessType,
        }),
      })

      if (!settingsRes.ok) {
        const settingsData = await settingsRes.json()
        console.warn('Settings save partial failure:', settingsData.error)
      }

      setSuccess('Lưu cài đặt thành công!')
      fetchSettings()
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 2MB')
      return
    }

    // Read and convert to base64
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64,
            folder: 'digistay/logos',
            isThumbnail: true,
          }),
        })

        const data = await res.json()
        if (data.success) {
          setFormData(prev => ({ ...prev, logo: data.data.url }))
          setSuccess('Logo đã được tải lên!')
        } else {
          // Fallback: use base64 directly
          setFormData(prev => ({ ...prev, logo: base64 }))
        }
      } catch {
        // Fallback: use base64 directly
        setFormData(prev => ({ ...prev, logo: base64 }))
      }
    }
    reader.readAsDataURL(file)
  }

  if (!workspace) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Vui lòng chọn Workspace</p>
            <Button onClick={() => router.push(routes.workspaces())}>
              Chuyển đến Workspace
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
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
    <PageContainer>
      <button
        onClick={() => router.push(routes.workspace(workspace.slug))}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại workspace
      </button>

      <Header
        title="Cài đặt Workspace"
        description={`Quản lý cấu hình cho ${workspace.name}`}
      />

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'general'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Chung
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'notifications'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Thông báo
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'security'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Bảo mật
        </button>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Workspace
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {formData.logo ? (
                      <Image 
                        src={formData.logo} 
                        alt="Logo" 
                        width={80} 
                        height={80} 
                        className="object-contain"
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/png,image/svg+xml,image/jpeg"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Tải logo lên
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG, SVG, JPG (tối đa 2MB)</p>
                  </div>
                </div>
              </div>

              <Input
                label="Tên Workspace"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Khách sạn ABC"
                required
              />

              <Textarea
                label="Mô tả"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn về workspace..."
                rows={3}
              />

              <Input
                label="Tên miền tùy chỉnh"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="VD: khachsanabc.com"
                hint="Liên kết workspace với tên miền riêng"
              />
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Cài đặt khu vực</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Tiền tệ mặc định"
                  options={currencies}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />

                <Select
                  label="Múi giờ"
                  options={timezones}
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                />
              </div>

              <Select
                label="Loại hình kinh doanh"
                options={businessTypes}
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Lưu thay đổi
            </Button>
          </div>
        </div>
      )}

      {/* Notifications Settings */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Cài đặt thông báo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Chọn cách bạn nhận thông báo từ hệ thống
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Thông báo qua Email</p>
                    <p className="text-sm text-gray-500">Nhận email về booking mới và cập nhật</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Thông báo đẩy</p>
                    <p className="text-sm text-gray-500">Nhận thông báo trên trình duyệt</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Thông báo booking mới</p>
                    <p className="text-sm text-gray-500">Thông báo ngay khi có đặt phòng mới</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin bảo mật</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <p className="font-medium text-gray-900">Chủ sở hữu Workspace</p>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  {settings?.owner.name || 'Người dùng'} ({settings?.owner.email})
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <p className="font-medium text-gray-900">Thành viên</p>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  {settings?._count.members || 0} thành viên
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <p className="font-medium text-gray-900">Cơ sở</p>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  {settings?._count.properties || 0} cơ sở
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Vùng nguy hiểm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="font-medium text-red-700 mb-1">Xóa Workspace</p>
                <p className="text-sm text-red-600 mb-3">
                  Khi xóa workspace, toàn bộ dữ liệu bao gồm cơ sở, đặt phòng, và thành viên sẽ bị xóa vĩnh viễn.
                </p>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm('Bạn có chắc chắn muốn xóa workspace này? Hành động này không thể hoàn tác.')) {
                      // TODO: Implement workspace deletion
                      alert('Tính năng đang được phát triển')
                    }
                  }}
                >
                  Xóa Workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
