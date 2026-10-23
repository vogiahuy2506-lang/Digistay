'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Header, PageContainer, TitleBlock } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalFooter, Input, Loading, Select } from '@/components/ui'
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
  const { workspace, loading: wsLoading } = useWorkspace()
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

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspaceId) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Users className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg mb-2">Vui lòng chọn Workspace</p>
        <p className="text-small text-muted mb-6">
          Bạn cần chọn một workspace để quản lý thành viên.
        </p>
        <Button onClick={() => router.push(routes.workspaces())}>
          Chuyển đến Workspace
        </Button>
      </div>
    )
  }

  return (
    <>
      <TitleBlock
        title="Thành viên"
        lead="Quản lý thành viên và phân quyền trong workspace"
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
        <div className="mt-9 space-y-10">
          {/* Members List */}
          <section>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="text-body font-semibold text-fg">Thành viên</h2>
              <span className="text-small text-muted tabular-nums">{members.length}</span>
            </div>
            <ul className="border-b border-line">
              {members.length === 0 ? (
                <li className="py-10 text-center">
                  <Users className="w-5 h-5 text-muted mx-auto mb-3" />
                  <p className="text-body text-fg">Chưa có thành viên nào</p>
                  <Button size="sm" className="mt-4" onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Mời thành viên đầu tiên
                  </Button>
                </li>
              ) : (
                members.map((member) => (
                  <li key={member.id} className="border-t border-line first:border-t-0">
                    <div className="flex items-center gap-3 py-3.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar
                          src={member.user.image}
                          name={member.user.name || member.user.email}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-body font-medium text-fg truncate">
                            {member.user.name || 'Chưa đặt tên'}
                          </p>
                          <p className="text-small text-muted truncate">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getRoleBadge(member.role, member.isOwner)}

                        {!member.isOwner && (
                          <Dropdown
                            trigger={
                              <button
                                type="button"
                                aria-label="Tuỳ chỉnh thành viên"
                                className="w-8 h-8 rounded-ctl flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                              >
                                <MoreVertical className="w-4 h-4" aria-hidden="true" />
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
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Pending Invitations */}
          {invitations.filter(i => i.status === 'PENDING').length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
                <h2 className="text-body font-semibold text-fg">Lời mời đang chờ</h2>
                <span className="text-small text-muted tabular-nums">
                  {invitations.filter(i => i.status === 'PENDING').length}
                </span>
              </div>

              <ul className="border-b border-line">
                {invitations.filter(i => i.status === 'PENDING').map((invitation) => (
                  <li key={invitation.id} className="border-t border-line first:border-t-0">
                    <div className="flex items-center gap-3 py-3.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plain-soft text-muted">
                          <Mail className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-body font-medium text-fg truncate">{invitation.email}</p>
                          <p className="text-small text-muted truncate">
                            Mời bởi {invitation.sender.name || invitation.sender.email} •{' '}
                            {formatDate(invitation.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getRoleBadge(invitation.role)}
                        {getInvitationStatusBadge(invitation.status)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
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
    </>
  )
}
