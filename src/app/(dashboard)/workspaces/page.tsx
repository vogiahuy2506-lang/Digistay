'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Textarea } from '@/components/ui'
import { Plus, Building2, Users, MoreVertical, Pencil, Trash2, ExternalLink, Crown } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { toast } from '@/components/ui/toast'

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
}

export default function WorkspacesPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<Workspace | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
  })
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces')
      const data = await response.json()
      if (data.success) {
        setWorkspaces(data.data)
      }
      // Get current user ID
      const meRes = await fetch('/api/users/me')
      const meData = await meRes.json()
      if (meData.success) {
        setCurrentUserId(meData.data.id)
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspace) return

    setIsUpdating(true)
    setError('')

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setIsEditModalOpen(false)
      setSelectedWorkspace(null)
      setFormData({ name: '', description: '' })
      fetchWorkspaces()
      toast.success('Cập nhật workspace thành công')
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsUpdating(false)
    }
  }

  const openEditModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setFormData({
      name: workspace.name,
      description: workspace.description || '',
    })
    setIsEditModalOpen(true)
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setIsCreateModalOpen(false)
      setFormData({ name: '', description: '' })
      fetchWorkspaces()
      router.push(`/dashboard?workspace=${data.data.id}`)
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteWorkspace = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa workspace này?')) return

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchWorkspaces()
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err)
    }
  }

  return (
    <PageContainer>
      <Header
        title="Không gian làm việc"
        description="Quản lý các workspace của bạn"
        actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tạo Workspace mới
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : workspaces.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Chưa có Workspace nào
            </h3>
            <p className="text-gray-500 mb-6">
              Tạo workspace đầu tiên để bắt đầu quản lý cơ sở kinh doanh của bạn.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo Workspace đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center font-semibold text-xl">
                      {workspace.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
                      <p className="text-sm text-gray-500">{workspace.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {workspace.ownerId === currentUserId && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Chủ sở hữu
                      </Badge>
                    )}
                    <Dropdown
                      trigger={
                        <button className="p-1 rounded hover:bg-gray-100">
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                      }
                    >
                      <DropdownItem 
                        icon={<Pencil className="w-4 h-4" />}
                        onClick={() => openEditModal(workspace)}
                      >
                        Chỉnh sửa
                      </DropdownItem>
                      <DropdownItem icon={<ExternalLink className="w-4 h-4" />}>
                        Mở trang chủ
                      </DropdownItem>
                      <DropdownDivider />
                      {workspace.ownerId === currentUserId && (
                        <DropdownItem 
                          icon={<Trash2 className="w-4 h-4" />} 
                          danger
                          onClick={() => handleDeleteWorkspace(workspace.id)}
                        >
                          Xóa
                        </DropdownItem>
                      )}
                    </Dropdown>
                  </div>
                </div>

                {workspace.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {workspace.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <span>{workspace._count.properties} cơ sở</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{workspace._count.members} thành viên</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push(`/dashboard?workspace=${workspace.id}`)}
                >
                  Xem chi tiết
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Workspace mới"
        description="Workspace là không gian làm việc để quản lý cơ sở kinh doanh của bạn"
      >
        <form onSubmit={handleCreateWorkspace}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Tên Workspace"
              placeholder="VD: Công ty ABC"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
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
              onClick={() => setIsCreateModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Tạo Workspace
            </Button>
          </ModalFooter>
        </form>
      </Modal>
      {/* Edit Workspace Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Chỉnh sửa Workspace"
        description="Cập nhật thông tin workspace của bạn"
      >
        <form onSubmit={handleEditWorkspace}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Tên Workspace"
              placeholder="VD: Công ty ABC"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
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
              onClick={() => setIsEditModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isUpdating}>
              Lưu thay đổi
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
