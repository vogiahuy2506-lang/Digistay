'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Select } from '@/components/ui'
import { Plus, Users, Mail, MoreVertical, Shield, User, Trash2, UserPlus } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import { formatDate } from '@/lib/utils'

interface Member {
  id: string
  userId: string
  role: string
  joinedAt: string
  isOwner?: boolean
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  sender: {
    name: string | null
    email: string
  }
  recipient: {
    name: string | null
    email: string
  } | null
}

export default function MembersPage() {
  const router = useRouter()
  const { workspace } = useWorkspace()
  const workspaceId = workspace?.id

  const [members, setMembers] = React.useState<Member[]>([])
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showInviteModal, setShowInviteModal] = React.useState(false)
  const [isInviting, setIsInviting] = React.useState(false)
  const [inviteForm, setInviteForm] = React.useState({
    email: '',
    role: 'STAFF',
  })
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (workspaceId) {
      fetchData()
    }
  }, [workspaceId])

  const fetchData = async () => {
    if (!workspaceId) return

    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invitations`),
      ])

      const membersData = await membersRes.json()
      const invitationsData = await invitationsRes.json()

      if (membersData.success) {
        setMembers(membersData.data)
      }
      if (invitationsData.success) {
        setInvitations(invitationsData.data)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId) return

    setIsInviting(true)
    setError('')

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'STAFF' })
      fetchData()
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      })
      fetchData()
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này?')) return

    try {
      await fetch(`/api/workspaces/${workspaceId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })
      fetchData()
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  const getRoleBadge = (role: string, isOwner?: boolean) => {
    if (isOwner) return <Badge variant="warning">Chủ sở hữu</Badge>
    switch (role) {
      case 'ADMIN':
        return <Badge variant="danger">Quản trị viên</Badge>
      case 'MANAGER':
        return <Badge variant="primary">Quản lý</Badge>
      case 'RECEPTIONIST':
        return <Badge variant="secondary">Lễ tân</Badge>
      case 'USER':
        return <Badge variant="gray">Nhân viên</Badge>
      default:
        return <Badge variant="gray">{role}</Badge>
    }
  }

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Đang chờ</Badge>
      case 'ACCEPTED':
        return <Badge variant="success">Đã chấp nhận</Badge>
      case 'DECLINED':
        return <Badge variant="danger">Đã từ chối</Badge>
      case 'EXPIRED':
        return <Badge variant="gray">Hết hạn</Badge>
      default:
        return <Badge variant="gray">{status}</Badge>
    }
  }

  if (!workspaceId) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-fg mb-2">
              Vui lòng chọn Workspace
            </h3>
            <p className="text-muted mb-6">
              Bạn cần chọn một workspace để quản lý thành viên.
            </p>
            <Button onClick={() => router.push(routes.workspaces())}>
              Chuyển đến Workspace
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Thành viên"
        description="Quản lý thành viên và phân quyền trong workspace"
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Mời thành viên
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Members List */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-line">
                <h2 className="font-semibold text-fg">
                  Thành viên ({members.length})
                </h2>
              </div>
              
              {members.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-muted mb-4">Chưa có thành viên nào</p>
                  <Button onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Mời thành viên đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {members.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar 
                          src={member.user.image} 
                          name={member.user.name || member.user.email} 
                          size="md" 
                        />
                        <div>
                          <p className="font-medium text-fg">
                            {member.user.name || 'Chưa đặt tên'}
                          </p>
                          <p className="text-sm text-muted">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(member.role, member.isOwner)}
                        
                        {!member.isOwner && (
                          <Dropdown
                            trigger={
                              <button className="p-1 rounded hover:bg-fg/5">
                                <MoreVertical className="w-5 h-5 text-muted" />
                              </button>
                            }
                          >
                            <DropdownItem 
                              icon={<Shield className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'ADMIN')}
                            >
                              Thăng lên Quản trị viên
                            </DropdownItem>
                            <DropdownItem 
                              icon={<Shield className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'MANAGER')}
                            >
                              Thăng lên Quản lý
                            </DropdownItem>
                            <DropdownItem 
                              icon={<User className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'RECEPTIONIST')}
                            >
                              Đặt làm Lễ tân
                            </DropdownItem>
                            <DropdownItem 
                              icon={<User className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'USER')}
                            >
                              Đặt làm Nhân viên
                            </DropdownItem>
                            <DropdownDivider />
                            <DropdownItem 
                              icon={<Trash2 className="w-4 h-4" />}
                              danger
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              Xóa khỏi Workspace
                            </DropdownItem>
                          </Dropdown>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {invitations.filter(i => i.status === 'PENDING').length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-line">
                  <h2 className="font-semibold text-fg">
                    Lời mời đang chờ ({invitations.filter(i => i.status === 'PENDING').length})
                  </h2>
                </div>
                
                <div className="divide-y divide-line">
                  {invitations.filter(i => i.status === 'PENDING').map((invitation) => (
                    <div key={invitation.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-fg/5 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-muted" />
                        </div>
                        <div>
                          <p className="font-medium text-fg">{invitation.email}</p>
                          <p className="text-sm text-muted">
                            Mời bởi {invitation.sender.name || invitation.sender.email} •
                            {' '}{formatDate(invitation.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(invitation.role)}
                        {getInvitationStatusBadge(invitation.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Mời thành viên"
        description="Gửi lời mời qua email để tham gia workspace này"
      >
        <form onSubmit={handleInvite}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="nguoi-moi@example.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />

            <Select
              label="Vai trò"
              options={[
                { value: 'USER', label: 'Nhân viên' },
                { value: 'RECEPTIONIST', label: 'Lễ tân' },
                { value: 'MANAGER', label: 'Quản lý' },
                { value: 'ADMIN', label: 'Quản trị viên' },
              ]}
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              hint="Quản trị viên có thể quản lý cơ sở và mời thành viên khác"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteModal(false)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isInviting}>
              <Mail className="w-4 h-4 mr-2" />
              Gửi lời mời
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
