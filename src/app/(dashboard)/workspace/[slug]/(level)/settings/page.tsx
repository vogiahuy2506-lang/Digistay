'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TitleBlock } from '@/components/layout'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Loading, Select, Textarea, Badge } from '@/components/ui'
import {
  Settings, Building2, Globe, Bell, Shield, Users,
  Mail, Clock, DollarSign, Save, ArrowLeft, Upload
} from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { cn } from '@/lib/utils'
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
  const { workspace, loading: wsLoading } = useWorkspace()
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

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspace) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Settings className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg mb-2">Vui lòng chọn Workspace</p>
        <p className="text-small text-muted mb-6">
          Bạn cần chọn một workspace để xem cài đặt.
        </p>
        <Button onClick={() => router.push(routes.workspaces())}>
          Chuyển đến Workspace
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return <Loading className="py-24" />
  }

  return (
    <>
      <TitleBlock
        title="Thông tin cơ sở"
        lead={`Cấu hình chung của ${workspace.name}: tên, logo, tiền tệ và múi giờ vận hành.`}
        actions={
          <Link
            href={routes.members(workspace.slug)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctl border border-ink h-9 sm:h-8 px-3',
              'text-small font-medium text-fg hover:bg-panel transition-colors duration-160',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-acc'
            )}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            Thành viên
          </Link>
        }
      />

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-ok-soft border border-ok/30 text-ok text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-fg/5 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'general'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Chung
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'notifications'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Thông báo
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'security'
              ? 'bg-panel text-acc shadow-sm'
              : 'text-muted hover:text-fg'
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
                <label className="block text-sm font-medium text-fg mb-2">
                  Logo Workspace
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-line flex items-center justify-center overflow-hidden bg-fg/[0.03]">
                    {formData.logo ? (
                      <Image 
                        src={formData.logo} 
                        alt="Logo" 
                        width={80} 
                        height={80} 
                        className="object-contain"
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted" />
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
                      className="inline-flex items-center gap-2 px-4 py-2 bg-panel border border-line rounded-lg text-sm font-medium text-fg hover:bg-fg/[0.03] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Tải logo lên
                    </label>
                    <p className="text-xs text-muted mt-1">PNG, SVG, JPG (tối đa 2MB)</p>
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
            <p className="text-sm text-muted mb-4">
              Chọn cách bạn nhận thông báo từ hệ thống
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">Thông báo qua Email</p>
                    <p className="text-sm text-muted">Nhận email về booking mới và cập nhật</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">Thông báo đẩy</p>
                    <p className="text-sm text-muted">Nhận thông báo trên trình duyệt</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-muted" />
                  <div>
                    <p className="font-medium text-fg">Thông báo booking mới</p>
                    <p className="text-sm text-muted">Thông báo ngay khi có đặt phòng mới</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
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
              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">Chủ sở hữu Workspace</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {settings?.owner.name || 'Người dùng'} ({settings?.owner.email})
                </p>
              </div>

              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">Thành viên</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {settings?._count.members || 0} thành viên
                </p>
              </div>

              <div className="p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-acc" />
                  <p className="font-medium text-fg">Cơ sở</p>
                </div>
                <p className="text-sm text-muted ml-8">
                  {settings?._count.properties || 0} cơ sở
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-err/30">
            <CardHeader>
              <CardTitle className="text-err">Vùng nguy hiểm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-err-soft rounded-lg border border-err/30">
                <p className="font-medium text-err mb-1">Xóa Workspace</p>
                <p className="text-sm text-err mb-3">
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
    </>
  )
}