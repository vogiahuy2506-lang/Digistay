'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Button, Modal, ModalFooter, Input, Textarea, Select } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import {
  Building2,
  Plus,
  Search,
  MapPin,
  BedDouble,
  ArrowRight,
  ChevronLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  Globe,
} from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { toast } from '@/components/ui/toast'

interface Property {
  id: string
  name: string
  type: string
  city: string
  address: string
  subdomain: string
  isActive: boolean
  coverImage: string | null
  images: { url: string; isPrimary: boolean }[]
  _count: { roomTypes: number; images: number }
}

const propertyTypeLabels: Record<string, { label: string; color: string }> = {
  HOTEL: { label: 'Khách sạn', color: 'bg-blue-100 text-blue-700' },
  HOMESTAY: { label: 'Homestay', color: 'bg-green-100 text-green-700' },
  RESORT: { label: 'Resort', color: 'bg-emerald-100 text-emerald-700' },
  RESTAURANT: { label: 'Nhà hàng', color: 'bg-orange-100 text-orange-700' },
  VILLA: { label: 'Villa', color: 'bg-purple-100 text-purple-700' },
  MOTEL: { label: 'Motel', color: 'bg-gray-100 text-gray-700' },
  OTHER: { label: 'Khác', color: 'bg-gray-100 text-gray-700' },
}

const propertyTypes = [
  { value: 'HOTEL', label: 'Khách sạn' },
  { value: 'HOMESTAY', label: 'Homestay' },
  { value: 'RESORT', label: 'Resort' },
  { value: 'RESTAURANT', label: 'Nhà hàng' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'MOTEL', label: 'Motel' },
  { value: 'OTHER', label: 'Khác' },
]

export default function WorkspaceHomePage() {
  const router = useRouter()
  const { workspace, loading: wsLoading } = useWorkspace()

  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'HOTEL',
    address: '',
    city: '',
    district: '',
    phone: '',
    email: '',
    subdomain: '',
    description: '',
  })

  const resetCreateForm = () =>
    setCreateForm({
      name: '',
      type: 'HOTEL',
      address: '',
      city: '',
      district: '',
      phone: '',
      email: '',
      subdomain: '',
      description: '',
    })

  useEffect(() => {
    if (!workspace?.id) return
    setLoading(true)
    fetch(`/api/properties?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setProperties(data.data || [])
      })
      .finally(() => setLoading(false))
  }, [workspace?.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace) return
    setIsCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          ...createForm,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || 'Đã xảy ra lỗi')
        return
      }
      setIsCreateOpen(false)
      resetCreateForm()
      // Refresh list
      const list = await fetch(`/api/properties?workspaceId=${workspace.id}`).then((r) => r.json())
      if (list?.success) setProperties(list.data || [])
      toast.success('Tạo cơ sở thành công')
    } catch {
      setCreateError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá cơ sở này?')) return
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' })
      setProperties((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleStatus = async (p: Property) => {
    try {
      await fetch(`/api/properties/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      })
      setProperties((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x))
      )
    } catch (err) {
      console.error(err)
    }
  }

  if (wsLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Không tìm thấy Workspace</h3>
            <p className="text-gray-500 mb-6">
              Workspace này không tồn tại hoặc bạn không có quyền truy cập.
            </p>
            <Button onClick={() => router.push(routes.workspaces())}>
              Về danh sách Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filtered = properties.filter((p) => {
    const matchQ =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.city.toLowerCase().includes(query.toLowerCase())
    const matchT = filterType === 'ALL' || p.type === filterType
    return matchQ && matchT
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">Digistay</p>
              <p className="text-[10px] text-gray-500 -mt-0.5">Chọn cơ sở</p>
            </div>
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(routes.workspaces())}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Đổi workspace
            </Button>
            <div className="hidden md:flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-900">{workspace.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo cơ sở mới
            </Button>
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Chọn cơ sở trong {workspace.name}
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Click vào cơ sở để vào trang quản lý phòng, đặt phòng, lịch phòng, báo cáo và website.
            Mỗi cơ sở có 1 website công khai riêng qua subdomain.
          </p>
        </div>

        {properties.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc thành phố..."
                className="pl-9"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="ALL">Tất cả loại hình</option>
              {Object.entries(propertyTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Empty state */}
        {properties.length === 0 ? (
          <Card className="max-w-xl mx-auto">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-50 mx-auto mb-4 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Chưa có cơ sở nào trong {workspace.name}
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Tạo cơ sở kinh doanh đầu tiên (khách sạn, homestay, nhà hàng...) để bắt đầu
                quản lý phòng, đặt phòng và website.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Tạo cơ sở đầu tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                <strong className="text-gray-900">{filtered.length}</strong> / {properties.length} cơ sở
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p) => {
                const primary = p.images?.find((i) => i.isPrimary)
                const typeMeta = propertyTypeLabels[p.type] || propertyTypeLabels.OTHER
                const href = routes.property(workspace.slug, p.id)
                return (
                  <Link
                    key={p.id}
                    href={href}
                    className="group relative overflow-hidden rounded-xl bg-white hover:shadow-xl hover:-translate-y-0.5 transition-all border-2 border-transparent hover:border-primary/30 block"
                  >
                    {/* Top gradient strip */}
                    <div className="h-2 bg-gradient-to-r from-emerald-400 via-cyan-500 to-blue-500" />

                    {/* Image */}
                    <div className="relative h-40 bg-gradient-to-br from-blue-50 to-purple-50">
                      {primary ? (
                        <img
                          src={primary.url}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeMeta.color}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            p.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.isActive ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>

                      <div
                        onClick={(e) => e.preventDefault()}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Dropdown
                          trigger={
                            <button
                              className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                          }
                        >
                          <DropdownItem
                            icon={<Pencil className="w-4 h-4" />}
                            onClick={() => router.push(href)}
                          >
                            Chỉnh sửa
                          </DropdownItem>
                          <DropdownItem
                            icon={p.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            onClick={() => handleToggleStatus(p)}
                          >
                            {p.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                          </DropdownItem>
                          <DropdownItem
                            icon={<Globe className="w-4 h-4" />}
                            onClick={() => window.open(routes.publicSite(p.subdomain), '_blank')}
                          >
                            Mở website
                          </DropdownItem>
                          <DropdownDivider />
                          <DropdownItem
                            icon={<Trash2 className="w-4 h-4" />}
                            danger
                            onClick={() => handleDelete(p.id)}
                          >
                            Xoá cơ sở
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate flex-1">{p.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {p.address}, {p.city}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100">
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5" />
                          {p._count?.roomTypes || 0} hạng phòng
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="font-mono text-[10px] text-gray-400 truncate">
                          {p.subdomain}.digistay.vn
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(routes.publicSite(p.subdomain), '_blank')
                          }}
                          role="link"
                          className="text-xs text-gray-500 hover:text-primary flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </span>
                        <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                          Vào quản lý
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}

              {/* Add new tile */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center min-h-[300px] transition-colors group"
              >
                <div className="w-14 h-14 rounded-full bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center mb-3 transition-colors">
                  <Plus className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-primary">
                  Tạo cơ sở mới
                </p>
                <p className="text-xs text-gray-400 mt-1">Khách sạn, homestay, resort...</p>
              </button>
            </div>

            {filtered.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Không tìm thấy cơ sở nào phù hợp với bộ lọc
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Create Property Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          resetCreateForm()
        }}
        title="Tạo cơ sở mới"
        description={`Thêm cơ sở kinh doanh vào ${workspace.name}`}
        size="lg"
      >
        <form onSubmit={handleCreate}>
          {createError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {createError}
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tên cơ sở"
                placeholder="VD: Khách sạn ABC"
                value={createForm.name}
                onChange={(e) => {
                  setCreateForm({ ...createForm, name: e.target.value })
                  if (!createForm.subdomain) {
                    const sub = e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                    setCreateForm((p) => ({ ...p, subdomain: sub }))
                  }
                }}
                required
                autoFocus
              />
              <Select
                label="Loại hình"
                options={propertyTypes}
                value={createForm.type}
                onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                required
              />
            </div>

            <Input
              label="Subdomain"
              placeholder="ten-khach-san"
              value={createForm.subdomain}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                })
              }
              hint={`Link: ${createForm.subdomain || 'ten-khach-san'}.digistay.vn`}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Địa chỉ"
                placeholder="VD: 123 Đường ABC"
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                required
              />
              <Input
                label="Thành phố/Tỉnh"
                placeholder="VD: Hà Nội"
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Quận/Huyện (tùy chọn)"
                placeholder="VD: Quận Ba Đình"
                value={createForm.district}
                onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
              />
              <Input
                label="Số điện thoại (tùy chọn)"
                placeholder="VD: 024 1234 5678"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>

            <Input
              label="Email (tùy chọn)"
              type="email"
              placeholder="VD: info@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />

            <Textarea
              label="Mô tả (tùy chọn)"
              placeholder="Giới thiệu ngắn về cơ sở của bạn"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={3}
            />
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                resetCreateForm()
              }}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isCreating}>
              <Check className="w-4 h-4 mr-2" />
              Tạo cơ sở
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
