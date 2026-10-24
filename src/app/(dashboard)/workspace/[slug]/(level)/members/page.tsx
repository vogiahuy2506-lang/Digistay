'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Header, PageContainer, TitleBlock } from '@/components/layout'
import { Card, CardContent, Button, Badge, Modal, ModalBody, ModalFooter, Input, Loading, Select } from '@/components/ui'
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
  const router = useRouter()
  const t = useTranslations('dash.workspace')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()
  const locale = useLocale()
  const { workspace, loading: wsLoading } = useWorkspace()
  const workspaceId = workspace?.id

  const [members, setMembers] = React.useState<Member[]>([])
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showInviteModal, setShowInviteModal] = React.useState(false)
  const [isInviting, setIsInviting] = React.useState(false)
  const [inviteForm, setInviteForm] = React.useState({
    email: '',
    role: 'USER',
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
        setError(data.error || tc('states.error'))
        return
      }

      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'USER' })
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

  // The invitation date in the page's language, Vietnam time.
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

  if (wsLoading) {
    return <Loading className="py-24" />
  }

  if (!workspaceId) {
    return (
      <div className="rounded-box border border-line bg-panel px-6 py-16 text-center">
        <Users className="w-6 h-6 text-muted mx-auto mb-4" />
        <p className="text-body text-fg mb-2">{t('noWorkspace.title')}</p>
        <p className="text-small text-muted mb-6">
          {t('members.noWorkspaceText')}
        </p>
        <Button onClick={() => router.push(routes.workspaces())}>
          {t('noWorkspace.goTo')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <TitleBlock
        title={tc('nav.members')}
        lead={t('members.description')}
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
        <div className="mt-9 space-y-10">
          {/* Members List */}
          <section>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="text-body font-semibold text-fg">{tc('nav.members')}</h2>
              <span className="text-small text-muted tabular-nums">{members.length}</span>
            </div>
            <ul className="border-b border-line">
              {members.length === 0 ? (
                <li className="py-10 text-center">
                  <Users className="w-5 h-5 text-muted mx-auto mb-3" />
                  <p className="text-body text-fg">{t('members.empty')}</p>
                  <Button size="sm" className="mt-4" onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    {t('members.inviteFirst')}
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
                            {member.user.name || t('members.noName')}
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
                                aria-label={tc('actions.more')}
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
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Pending Invitations */}
          {invitations.filter(i => i.status === 'PENDING').length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
                <h2 className="text-body font-semibold text-fg">{t('members.pending')}</h2>
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
                            {t('members.invitedBy', {
                              name: invitation.sender.name || invitation.sender.email,
                              date: invitedOn.format(new Date(invitation.createdAt)),
                            })}
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
      <Modal showHeader
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={t('members.invite')}
        description={t('members.modal.description')}
      >
        <form onSubmit={handleInvite} className="flex flex-col min-h-0">
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
    </>
  )
}
