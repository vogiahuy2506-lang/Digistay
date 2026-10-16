'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Button, Modal, ModalFooter, Input, Textarea } from '@/components/ui'
import { Building2, Plus, Users, Crown, ArrowRight, MoreVertical, Pencil, Trash2, Check } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { routes } from '@/lib/utils/routes'

interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  ownerId: string
  owner: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count: {
    properties: number
    members: number
  }
  role?: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
}

const roleBadges: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'Chủ sở hữu', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  MANAGER: { label: 'Quản lý', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  RECEPTIONIST: { label: 'Lễ tân', color: 'bg-green-100 text-green-700 border-green-200' },
  USER: { label: 'Thành viên', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

export default function WorkspacesPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [formData, setFormData] = React.useState({ name: '', description: '' })
  const [error, setError] = React.useState('')

  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [selected, setSelected] = React.useState<Workspace | null>(null)

  React.useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const [wsRes, meRes] = await Promise.all([
        fetch('/api/workspaces'),
        fetch('/api/users/me'),
      ])
      const wsData = await wsRes.json()
      const meData = await meRes.json()
      if (wsData.success) setWorkspaces(wsData.data)
      if (meData.success) setCurrentUserId(meData.data.id)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }
      setIsCreateOpen(false)
      setFormData({ name: '', description: '' })
      await fetchWorkspaces()
      // Auto-navigate to the new workspace
      router.push(routes.workspace(data.data.slug))
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsCreating(false)
    }
  }

  const openEdit = (ws: Workspace) => {
    setSelected(ws)
    setFormData({ name: ws.name, description: ws.description || '' })
    setIsEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setIsUpdating(true)
    setError('')
    try {
      const res = await fetch(`/api/workspaces/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }
      setIsEditOpen(false)
      setSelected(null)
      fetchWorkspaces()
      toast.success('Cập nhật workspace thành công')
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá workspace này? Toàn bộ cơ sở và thành viên sẽ bị xoá.')) return
    try {
      await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
      fetchWorkspaces()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Digistay</p>
              <p className="text-[10px] text-gray-500 -mt-0.5">Chọn workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo workspace mới
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
            Chào mừng bạn quay lại 👋
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Chọn một workspace để bắt đầu quản lý cơ sở lưu trú, đặt phòng và website của bạn.
            Bạn có thể tạo mới hoặc chuyển sang workspace khác bất kỳ lúc nào.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="max-w-xl mx-auto">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-50 mx-auto mb-4 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Tạo workspace đầu tiên
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Workspace là không gian làm việc chứa toàn bộ cơ sở kinh doanh của bạn
                (khách sạn, homestay, nhà hàng...). Mỗi workspace có website và đội ngũ riêng.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Tạo workspace đầu tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Bạn có <strong className="text-gray-900">{workspaces.length}</strong> workspace
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {workspaces.map((ws) => {
                const role = roleBadges[ws.role || 'USER']
                const isOwner = ws.ownerId === currentUserId
                return (
                  <Link
                    key={ws.id}
                    href={routes.workspace(ws.slug)}
                    className="group relative overflow-hidden rounded-xl bg-white hover:shadow-xl hover:-translate-y-0.5 transition-all border-2 border-transparent hover:border-primary/20 block"
                  >
                    {/* Top gradient strip */}
                    <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shrink-0">
                            {ws.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{ws.name}</h3>
                            <p className="text-xs text-gray-500 truncate">/{ws.slug}</p>
                          </div>
                        </div>

                        {isOwner && (
                          <div
                            onClick={(e) => e.preventDefault()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                          >
                            <Dropdown
                              trigger={
                                <button className="p-1 rounded hover:bg-gray-100">
                                  <MoreVertical className="w-5 h-5 text-gray-400" />
                                </button>
                              }
                            >
                              <DropdownItem
                                icon={<Pencil className="w-4 h-4" />}
                                onClick={() => openEdit(ws)}
                              >
                                Chỉnh sửa
                              </DropdownItem>
                              <DropdownDivider />
                              <DropdownItem
                                icon={<Trash2 className="w-4 h-4" />}
                                danger
                                onClick={() => handleDelete(ws.id)}
                              >
                                Xoá workspace
                              </DropdownItem>
                            </Dropdown>
                          </div>
                        )}
                      </div>

                      {ws.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                          {ws.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4" />
                          <span>{ws._count.properties} cơ sở</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>{ws._count.members} thành viên</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${role.color}`}
                        >
                          {isOwner && <Crown className="w-3 h-3" />}
                          {role.label}
                        </span>
                        <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                          Vào workspace
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
                className="border-2 border-dashed border-gray-200 hover:border-primary hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center min-h-[260px] transition-colors group"
              >
                <div className="w-14 h-14 rounded-full bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center mb-3 transition-colors">
                  <Plus className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-primary">
                  Tạo workspace mới
                </p>
                <p className="text-xs text-gray-400 mt-1">Khách sạn, resort, nhà hàng...</p>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo workspace mới"
        description="Workspace là không gian chứa các cơ sở kinh doanh của bạn"
      >
        <form onSubmit={handleCreate}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Tên workspace"
              placeholder="VD: An Nam Hospitality"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />
            <Textarea
              label="Mô tả (tùy chọn)"
              placeholder="Mô tả ngắn về workspace của bạn"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isCreating}>
              <Check className="w-4 h-4 mr-2" />
              Tạo workspace
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Chỉnh sửa workspace"
      >
        <form onSubmit={handleEdit}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Tên workspace"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Textarea
              label="Mô tả (tùy chọn)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Lưu thay đổi
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
