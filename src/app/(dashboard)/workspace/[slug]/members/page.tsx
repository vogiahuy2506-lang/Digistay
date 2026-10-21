'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, Input, Select } from '@/components/ui'
import { Plus, Users, Mail, MoreVertical, Shield, User, Trash2, UserPlus } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { routes } from '@/lib/utils/routes'
import { useDashLabels } from '@/lib/i18n/dash'

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
  const t = useTranslations('dash.workspace')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const locale = useLocale()
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
        setError(data.error || t('errors.generic'))
        return
      }

      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'STAFF' })
      fetchData()
    } catch (err) {
      setError(tc('states.error'))
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
    if (!confirm(t('members.confirmRemove'))) return

    try {
      await fetch(`/api/workspaces/${workspaceId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })
      fetchData()
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  // The invitation date, as formatDate (src/lib/utils) wrote it, in the page's language.
  const invitedOn = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const getRoleBadge = (role: string, isOwner?: boolean) => {
    if (isOwner) return <Badge variant="warning">{t('members.owner')}</Badge>
    switch (role) {
      case 'ADMIN':
        return <Badge variant="danger">{t('members.roleAdmin')}</Badge>
      case 'MANAGER':
        return <Badge variant="primary">{labels.role(role)}</Badge>
      case 'RECEPTIONIST':
        return <Badge variant="secondary">{labels.role(role)}</Badge>
      case 'USER':
        return <Badge variant="gray">{labels.role(role)}</Badge>
      default:
        return <Badge variant="gray">{role}</Badge>
    }
  }

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">{t('members.invitationStatus.PENDING')}</Badge>
      case 'ACCEPTED':
        return <Badge variant="success">{t('members.invitationStatus.ACCEPTED')}</Badge>
      case 'DECLINED':
        return <Badge variant="danger">{t('members.invitationStatus.DECLINED')}</Badge>
      case 'EXPIRED':
        return <Badge variant="gray">{t('members.invitationStatus.EXPIRED')}</Badge>
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
              {t('noWorkspace.title')}
            </h3>
            <p className="text-muted mb-6">
              {t('members.noWorkspaceText')}
            </p>
            <Button onClick={() => router.push(routes.workspaces())}>
              {t('noWorkspace.goTo')}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={tc('nav.members')}
        description={t('members.description')}
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            {t('members.invite')}
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
                  {t('members.listTitle', { count: members.length })}
                </h2>
              </div>
              
              {members.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-muted mb-4">{t('members.empty')}</p>
                  <Button onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('members.inviteFirst')}
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
                            {member.user.name || t('members.noName')}
                          </p>
                          <p className="text-sm text-muted">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(member.role, member.isOwner)}
                        
                        {!member.isOwner && (
                          <Dropdown
                            trigger={
                              <button aria-label={tc('actions.more')} className="p-1 rounded hover:bg-fg/5">
                                <MoreVertical className="w-5 h-5 text-muted" />
                              </button>
                            }
                          >
                            <DropdownItem 
                              icon={<Shield className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'ADMIN')}
                            >
                              {t('members.makeAdmin')}
                            </DropdownItem>
                            <DropdownItem 
                              icon={<Shield className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'MANAGER')}
                            >
                              {t('members.makeManager')}
                            </DropdownItem>
                            <DropdownItem 
                              icon={<User className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'RECEPTIONIST')}
                            >
                              {t('members.makeReceptionist')}
                            </DropdownItem>
                            <DropdownItem 
                              icon={<User className="w-4 h-4" />}
                              onClick={() => handleUpdateRole(member.id, 'USER')}
                            >
                              {t('members.makeUser')}
                            </DropdownItem>
                            <DropdownDivider />
                            <DropdownItem 
                              icon={<Trash2 className="w-4 h-4" />}
                              danger
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              {t('members.remove')}
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
                    {t('members.pendingTitle', { count: invitations.filter(i => i.status === 'PENDING').length })}
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
                            {t('members.invitedBy', {
                              name: invitation.sender.name || invitation.sender.email,
                              date: invitedOn.format(new Date(invitation.createdAt)),
                            })}
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
        title={t('members.invite')}
        description={t('members.modal.description')}
      >
        <form className="flex flex-col min-h-0" onSubmit={handleInvite}>
          <ModalBody>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder={t('members.modal.emailPlaceholder')}
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />

            <Select
              label={t('members.modal.role')}
              options={[
                { value: 'USER', label: labels.role('USER') },
                { value: 'RECEPTIONIST', label: labels.role('RECEPTIONIST') },
                { value: 'MANAGER', label: labels.role('MANAGER') },
                { value: 'ADMIN', label: t('members.roleAdmin') },
              ]}
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              hint={t('members.modal.roleHint')}
            />
          </div>

          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteModal(false)}
            >
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" isLoading={isInviting}>
              <Mail className="w-4 h-4 mr-2" />
              {t('members.modal.send')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </PageContainer>
  )
}
