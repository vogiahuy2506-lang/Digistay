'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Modal, ModalFooter, Input, Textarea } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { routes } from '@/lib/utils/routes'
import { roleLabels, type WorkspaceRole } from '@/components/layout/nav'
import {
  Building2,
  Plus,
  Users,
  Crown,
  ArrowRight,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
  Layers,
  PlusCircle,
  LogOut,
  Search,
  Clock,
  Hotel,
  MailCheck,
} from 'lucide-react'

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
  members?: { userId: string; role: WorkspaceRole }[]
}

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface Invitation {
  id: string
  token: string
  workspaceId: string
  workspace: {
    id: string
    name: string
    slug: string
  }
  role: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  // /api/users/me/invitations includes the sender as `sender`.
  sender: {
    id: string
    name: string | null
    email: string
  }
  message?: string
  createdAt: string
}

/** Invitation roles come from the API as plain strings. */
const roleLabel = (role: string) =>
  Object.prototype.hasOwnProperty.call(roleLabels, role) ? roleLabels[role as WorkspaceRole] : role

export default function WorkspacesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [currentUser, setCurrentUser] = React.useState<User | null>(null)
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filterTab, setFilterTab] = React.useState<'all' | 'owned' | 'invited'>('all')
  const [searchQuery, setSearchQuery] = React.useState('')

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [formData, setFormData] = React.useState({ 
    name: '', 
    description: '',
    slug: '',
    businessType: 'boutique_hotel',
    currency: 'VND',
    timezone: 'GMT+07:00',
    logo: null as string | null,
  })
  const [error, setError] = React.useState('')

  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [selected, setSelected] = React.useState<Workspace | null>(null)

  // Check URL params for prefill data
  React.useEffect(() => {
    const createWorkspace = searchParams.get('createWorkspace') === 'true'
    const hotelName = searchParams.get('hotelName')
    const scale = searchParams.get('scale')
    
    if (createWorkspace) {
      // Auto-open create modal
      setIsCreateOpen(true)
      
      // Prefill name if provided
      if (hotelName) {
        setFormData(prev => ({
          ...prev,
          name: hotelName,
          slug: generateSlug(hotelName)
        }))
      }
      
      // Map scale to businessType
      if (scale) {
        if (scale === '1-5') {
          setFormData(prev => ({ ...prev, businessType: 'homestay' }))
        } else if (scale === '20+') {
          setFormData(prev => ({ ...prev, businessType: 'resort' }))
        } else {
          setFormData(prev => ({ ...prev, businessType: 'boutique_hotel' }))
        }
      }
    }
  }, [searchParams])

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  // Handle name change and auto-generate slug
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name)
    }))
  }

  // Handle custom slug
  const handleSlugChange = (slug: string) => {
    setFormData(prev => ({
      ...prev,
      slug: generateSlug(slug)
    }))
  }

  React.useEffect(() => {
    fetchWorkspaces()
    fetchInvitations()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const [wsRes, meRes] = await Promise.all([
        fetch('/api/workspaces'),
        fetch('/api/users/me'),
      ])

      if (wsRes.status === 401 || meRes.status === 401) {
        router.push('/login')
        return
      }

      const wsData = await wsRes.json()
      const meData = await meRes.json()
      if (wsData.success) setWorkspaces(wsData.data)
      if (meData.success) setCurrentUser(meData.data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/users/me/invitations')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setInvitations(data.data.filter((inv: Invitation) => inv.status === 'PENDING'))
        }
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err)
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId)
      if (!invitation) return

      // Use the token-based endpoint so the same code path works for
      // both the public /invitations/[token] page and this dashboard
      // banner.
      const res = await fetch(`/api/invitations/${invitation.token}/accept`, {
        method: 'POST',
      })

      if (res.ok) {
        toast.success('Đã chấp nhận lời mời!')
        await fetchInvitations()
        await fetchWorkspaces()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Không thể chấp nhận lời mời')
      }
    } catch (err) {
      console.error(err)
      toast.error('Đã xảy ra lỗi')
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId)
      if (!invitation) return

      const res = await fetch(`/api/invitations/${invitation.token}/decline`, {
        method: 'POST',
      })

      if (res.ok) {
        toast.success('Đã từ chối lời mời')
        await fetchInvitations()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Không thể từ chối lời mời')
      }
    } catch (err) {
      console.error(err)
      toast.error('Đã xảy ra lỗi')
    }
  }

  const handleCreate = async () => {
    if (!formData.name) return
    setIsCreating(true)
    setError('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          slug: formData.slug || undefined,
          businessType: formData.businessType,
          currency: formData.currency,
          timezone: formData.timezone,
          logo: formData.logo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }
      setIsCreateOpen(false)
      setFormData({ 
        name: '', 
        description: '',
        slug: '',
        businessType: 'boutique_hotel',
        currency: 'VND',
        timezone: 'GMT+07:00',
        logo: null,
      })
      await fetchWorkspaces()
      router.push(routes.workspace(data.data.slug))
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsCreating(false)
    }
  }

  const openEdit = (ws: Workspace) => {
    setSelected(ws)
    setFormData({
      name: ws.name,
      description: ws.description || '',
      slug: ws.slug,
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      logo: ws.logo ?? null,
      businessType: 'HOTEL',
    })
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

  const filteredWorkspaces = React.useMemo(() => {
    let filtered = workspaces

    if (filterTab === 'owned') {
      filtered = filtered.filter((ws) => ws.ownerId === currentUser?.id)
    } else if (filterTab === 'invited') {
      filtered = filtered.filter((ws) => ws.ownerId !== currentUser?.id)
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (ws) =>
          ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ws.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [workspaces, filterTab, searchQuery, currentUser])

  const ownedCount = workspaces.filter((ws) => ws.ownerId === currentUser?.id).length
  const invitedCount = workspaces.filter((ws) => ws.ownerId !== currentUser?.id).length
  const pendingInvitationsCount = invitations.length

  // Get user initials for avatar
  const getUserInitials = (name: string | null) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return name.charAt(0).toUpperCase()
  }

  return (
    <div className="min-h-full bg-page text-fg antialiased selection:bg-acc-soft selection:text-acc relative overflow-x-hidden">
      {/* Ambient Glow Background */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Header */}
      <header className="bg-panel/85 backdrop-blur-xl border-b border-line/90 sticky top-0 z-40 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Brand Identity */}
            <div className="flex items-center space-x-6">
              <Link href="/workspaces" className="flex items-center gap-3.5 group">
                <div className="w-11 h-11 rounded-xl bg-acc text-on-ink flex items-center justify-center font-bold text-2xl shadow-md tracking-wide ring-2 ring-panel group-hover:scale-105 transition-transform duration-200">
                  D
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight text-fg leading-none group-hover:text-acc transition-colors">
                    DigiStay
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-acc mt-1.5 flex items-center gap-1.5">
                    Boutique Hospitality OS
                    <span className="w-1 h-1 rounded-full bg-ink" />
                  </span>
                </div>
              </Link>
              <div className="hidden md:block h-6 w-px bg-fg/10" />
              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted bg-fg/5 px-3.5 py-1.5 rounded-full border border-line/90">
                <Layers className="w-3.5 h-3.5 text-acc" />
                <span>Không gian làm việc</span>
                <span className="text-muted">/</span>
                <span className="text-fg font-semibold flex items-center gap-1.5">
                  Workspace Hub
                  <span className="px-1.5 py-0.2 bg-acc-soft text-acc text-[10px] font-bold rounded">
                    Portal
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Actions and User Menu */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Create Workspace Button */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-on-ink px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition shadow-sm active:scale-[0.98] "
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Tạo workspace mới</span>
              </button>

              <div className="h-6 w-px bg-fg/10 hidden md:block" />

              {/* User Menu */}
              <div className="flex items-center gap-3 pl-1">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl ring-2 ring-acc/30 bg-fg/10 overflow-hidden flex items-center justify-center font-bold text-xs text-fg tracking-wider shadow-inner">
                    {getUserInitials(currentUser?.name || null)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ok rounded-full ring-2 ring-panel" />
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-fg leading-tight">
                    {currentUser?.name || 'Người dùng'}
                  </span>
                  {currentUser?.email && (
                    <span className="text-[10px] text-muted mt-0.5 truncate max-w-[180px]">{currentUser.email}</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    sessionStorage.setItem('justSignedOut', 'true')
                    await signOut({ callbackUrl: '/' })
                  }}
                  className="text-muted hover:text-acc p-1.5 rounded-lg hover:bg-fg/5 transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 z-10">
        {/* Hero / Welcome Section */}
        <div className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 bg-acc-soft/90 border border-acc/30 text-acc text-xs font-bold rounded-full mb-3.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-ink animate-pulse" />
            Hệ điều hành vận hành khách sạn &amp; chuỗi Boutique
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-[42px] font-serif font-bold text-fg tracking-tight flex items-center gap-3 leading-tight">
            Chào mừng bạn quay lại, {currentUser?.name?.split(' ').pop() || 'bạn'}{' '}
            <span className="inline-block transform origin-bottom-right hover:rotate-12 transition-transform duration-300">
              👋
            </span>
          </h1>
          <p className="mt-3 text-muted text-base md:text-lg leading-relaxed">
            Quản trị tập trung danh mục khách sạn, chuỗi villa và hệ thống booking trực tiếp của bạn.
            Bạn có thể mở rộng cơ sở, kiểm tra công suất phòng hoặc chuyển đổi giữa các không gian quản trị.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mb-8 pb-5 border-b border-line/90">
          {/* Category Segmented Pill Tabs */}
          <div className="flex items-center gap-1.5 bg-fg/5 p-1 rounded-xl border border-line">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'all'
                  ? 'bg-panel text-fg shadow-sm border border-line/80'
                  : 'text-muted hover:text-fg hover:bg-panel/60'
              }`}
            >
              <span>Tất cả</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                filterTab === 'all' ? 'bg-acc-soft text-acc' : 'bg-fg/10 text-fg'
              }`}>
                {workspaces.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('owned')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'owned'
                  ? 'bg-panel text-fg shadow-sm border border-line/80'
                  : 'text-muted hover:text-fg hover:bg-panel/60'
              }`}
            >
              <span>Chuỗi sở hữu</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] ${
                filterTab === 'owned' ? 'bg-acc-soft text-acc font-bold' : 'bg-fg/10 text-fg'
              }`}>
                {ownedCount}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('invited')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'invited'
                  ? 'bg-panel text-fg shadow-sm border border-line/80'
                  : 'text-muted hover:text-fg hover:bg-panel/60'
              }`}
            >
              <span>Được mời quản lý</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] ${
                filterTab === 'invited' ? 'bg-acc-soft text-acc font-bold' : 'bg-fg/10 text-fg'
              }`}>
                {invitedCount}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="w-full lg:w-auto flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-panel border border-line rounded-xl focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 outline-none placeholder:text-muted shadow-sm transition"
                placeholder="Tìm nhanh workspace..."
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {filteredWorkspaces.map((ws) => {
                const isOwner = ws.ownerId === currentUser?.id
                const memberRole = ws.members?.find((m) => m.userId === currentUser?.id)?.role

                return (
                  <article
                    key={ws.id}
                    className="group relative bg-panel rounded-2xl border border-line shadow-card hover:shadow-card-hover hover:border-acc transition-all duration-300 flex flex-col overflow-hidden"
                  >
                    {/* Card Banner: always dark (badges on it are drawn for a dark ground). */}
                    <div className="relative h-28 w-full bg-ink dark:bg-raised overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold backdrop-blur-md shadow-sm border ${
                          isOwner
                            ? 'bg-ink text-on-ink border-acc'
                            : 'bg-panel/95 text-fg border-panel/40'
                        }`}>
                          {isOwner ? (
                            <>
                              <Crown className="w-3 h-3 text-warn-soft" />
                              Chủ sở hữu
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3 text-warn" />
                              {memberRole ? roleLabels[memberRole] : 'Thành viên'}
                            </>
                          )}
                        </span>
                      </div>

                      {/* Monogram */}
                      <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
                        <div className="w-12 h-12 rounded-xl ring-4 ring-panel border shadow-md flex items-center justify-center font-serif font-bold text-xl bg-panel border-line text-acc">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-lg text-fg group-hover:text-acc transition-colors leading-snug">
                            {ws.name}
                          </h3>
                          {isOwner && (
                            <div className="relative z-10">
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  const menu = e.currentTarget.nextElementSibling as HTMLElement
                                  menu?.classList.toggle('hidden')
                                }}
                                className="text-muted hover:text-fg p-1.5 rounded-lg hover:bg-fg/5 transition"
                                aria-label="Tùy chọn"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="hidden absolute right-0 top-full mt-1 bg-panel rounded-xl shadow-lg border border-line py-1 min-w-[140px] z-20">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    openEdit(ws)
                                    e.currentTarget.closest('.hidden')?.classList.add('hidden')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-fg hover:bg-fg/[0.03] flex items-center gap-2"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Chỉnh sửa
                                </button>
                                <div className="border-t border-line my-1" />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleDelete(ws.id)
                                    e.currentTarget.closest('.hidden')?.classList.add('hidden')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-err hover:bg-err-soft flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Xoá workspace
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {ws.description && (
                          <p className="mt-3 text-xs md:text-sm text-muted leading-relaxed line-clamp-2">
                            {ws.description}
                          </p>
                        )}

                        {/* Key Metrics Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl border bg-fg/[0.03] border-line/80">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-panel border border-line flex items-center justify-center text-muted shrink-0">
                              <Hotel className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-[10px] text-muted uppercase font-semibold">Cơ sở</div>
                              <div className="text-xs font-bold text-fg">
                                {ws._count.properties} {ws._count.properties > 1 ? 'chi nhánh' : 'cơ sở'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-panel border border-line flex items-center justify-center text-muted shrink-0">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-[10px] text-muted uppercase font-semibold">Nhân sự</div>
                              <div className="text-xs font-bold text-fg">
                                {ws._count.members} thành viên
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer CTA */}
                      <div className="mt-5 pt-3.5 border-t border-line/80 flex items-center justify-end">
                        <Link
                          href={routes.workspace(ws.slug)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-acc hover:text-on-ink bg-acc-soft hover:bg-ink px-3 py-1.5 rounded-lg group-hover:translate-x-1 transition-all shadow-sm"
                        >
                          <span>Vào workspace</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}

              {/* Create New Workspace Card */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="group relative rounded-2xl border-2 border-dashed border-line hover:border-acc bg-panel/60 hover:bg-acc-soft/40 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center p-8 text-center cursor-pointer min-h-[350px] shadow-sm hover:shadow-card-hover"
              >
                <div className="w-16 h-16 rounded-2xl bg-acc-soft group-hover:bg-ink border border-line group-hover:border-acc text-acc group-hover:text-on-ink flex items-center justify-center transition-all duration-300 shadow-sm group-hover:scale-110">
                  <Plus className="w-8 h-8 stroke-[2.2]" />
                </div>
                <h3 className="mt-6 font-bold text-lg text-fg group-hover:text-acc transition-colors">
                  Khởi tạo Workspace mới
                </h3>
                <p className="mt-2 text-xs md:text-sm text-muted max-w-[260px] leading-relaxed">
                  Mở rộng chuỗi khách sạn, khu nghỉ dưỡng sinh thái, villa hoặc homestay mới.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-acc group-hover:text-on-ink bg-panel group-hover:bg-ink px-4 py-2 rounded-xl border border-line group-hover:border-acc shadow-sm transition-all">
                  <span>Bắt đầu thiết lập</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* Pending invitations */}
            <section className="mt-12 bg-panel rounded-2xl border border-line/90 p-6 shadow-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-acc" />
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <h4 className="font-bold text-sm text-fg flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-acc-soft text-acc flex items-center justify-center">
                    <MailCheck className="w-4 h-4" />
                  </div>
                  <span>Lời mời cộng tác mới</span>
                </h4>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warn-soft text-warn border border-warn/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn animate-ping" />
                  {pendingInvitationsCount} chờ xử lý
                </span>
              </div>

              {pendingInvitationsCount > 0 ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="p-4 rounded-xl bg-fg/[0.03] border border-line/80 flex flex-col gap-3.5">
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-panel border border-line font-serif font-bold text-lg text-fg flex items-center justify-center shadow-sm shrink-0">
                          {invitation.workspace.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs sm:text-sm font-bold text-fg truncate">{invitation.workspace.name}</h5>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-acc-soft text-acc shrink-0">Mới</span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            Vai trò đề xuất: <span className="font-bold text-fg">{roleLabel(invitation.role)}</span>
                          </p>
                          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1 min-w-0">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="truncate">Gửi từ: {invitation.sender?.name || invitation.sender?.email}</span>
                          </div>
                        </div>
                      </div>
                      {invitation.message && (
                        <div className="p-3 bg-panel rounded-lg border border-line text-xs text-muted italic leading-relaxed">
                          &quot;{invitation.message}&quot;
                        </div>
                      )}
                      <div className="mt-auto flex items-center gap-3">
                        <button
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="flex-1 py-2.5 px-4 text-xs font-bold text-on-ink bg-ink hover:bg-ink/90 rounded-xl transition shadow-sm text-center flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Chấp nhận lời mời
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          className="py-2.5 px-4 text-xs font-bold text-muted hover:text-fg bg-fg/5 hover:bg-fg/10 rounded-xl transition text-center border border-line"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-xl bg-fg/[0.03] border border-line/80 text-center">
                  <div className="w-12 h-12 rounded-xl bg-panel border border-line flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <MailCheck className="w-6 h-6 text-muted" />
                  </div>
                  <p className="text-sm text-muted">Không có lời mời cộng tác nào</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-panel/90 backdrop-blur-md py-6 text-xs text-muted z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left">© 2026 Digistay</div>
      </footer>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-line/90 flex items-center justify-between bg-fg/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-acc text-on-ink flex items-center justify-center shadow-md shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-fg flex items-center gap-2">
                Tạo không gian làm việc mới 
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-acc-soft text-acc border border-acc/30">Boutique OS</span>
              </h3>
              <p className="text-xs text-muted">Thiết lập môi trường vận hành riêng biệt cho cơ sở hoặc chuỗi lưu trú của bạn</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateOpen(false)}
            className="w-8 h-8 rounded-lg text-muted hover:text-fg hover:bg-fg/5 flex items-center justify-center transition border border-transparent hover:border-line"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-left max-h-[calc(92vh-220px)]">
          {error && (
            <div className="p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
              {error}
            </div>
          )}

          {/* Workspace Name & Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-fg uppercase tracking-wide">
                Tên Workspace / Thương hiệu <span className="text-acc">*</span>
              </label>
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-panel border border-line rounded-xl focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 outline-none text-fg shadow-sm font-medium"
              placeholder="VD: An Nam Boutique Hotel, Hoi An Retreat..."
              required
              autoFocus
            />
            <div className="flex items-center justify-between text-xs text-muted bg-fg/[0.03] p-2.5 rounded-xl border border-line/80">
              <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-muted truncate">
                <span className="text-muted">slug:</span>
                <span className="text-acc font-semibold">
                  {formData.slug || 'Nhập tên để tạo slug...'}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const newSlug = prompt('Nhập slug tùy chỉnh:', formData.slug)
                  if (newSlug) handleSlugChange(newSlug)
                }}
                className="text-[11px] font-semibold text-acc hover:text-acc underline shrink-0 ml-2"
              >
                Tùy chỉnh slug
              </button>
            </div>
          </div>

          {/* Business Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-fg uppercase tracking-wide">
              Mô hình kinh doanh lưu trú <span className="text-acc">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'boutique_hotel' ? 'border-acc bg-acc-soft/40' : 'border-line bg-panel hover:border-line'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="boutique_hotel"
                  checked={formData.businessType === 'boutique_hotel'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-acc-soft text-acc flex items-center justify-center font-bold text-xs">🏨</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'boutique_hotel' ? 'border-acc' : 'border-line'}`}>
                    {formData.businessType === 'boutique_hotel' && <span className="w-1.5 h-1.5 rounded-full bg-ink"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-fg">Boutique Hotel</span>
                <span className="text-[11px] text-muted mt-0.5 leading-snug">Khách sạn phố, mini hotel phong cách</span>
              </label>

              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'resort' ? 'border-acc bg-acc-soft/40' : 'border-line bg-panel hover:border-line'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="resort"
                  checked={formData.businessType === 'resort'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-fg/5 text-muted flex items-center justify-center font-bold text-xs">🏡</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'resort' ? 'border-acc' : 'border-line'}`}>
                    {formData.businessType === 'resort' && <span className="w-1.5 h-1.5 rounded-full bg-ink"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-fg">Resort &amp; Biệt thự</span>
                <span className="text-[11px] text-muted mt-0.5 leading-snug">Khu nghỉ dưỡng, villa ven biển/núi</span>
              </label>

              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'homestay' ? 'border-acc bg-acc-soft/40' : 'border-line bg-panel hover:border-line'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="homestay"
                  checked={formData.businessType === 'homestay'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-fg/5 text-muted flex items-center justify-center font-bold text-xs">🛏️</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'homestay' ? 'border-acc' : 'border-line'}`}>
                    {formData.businessType === 'homestay' && <span className="w-1.5 h-1.5 rounded-full bg-ink"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-fg">Chuỗi Homestay</span>
                <span className="text-[11px] text-muted mt-0.5 leading-snug">Căn hộ dịch vụ, phòng chia sẻ</span>
              </label>
            </div>
          </div>

          {/* Brand Identity */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-fg uppercase tracking-wide">Nhận diện thương hiệu</label>
            <div className="flex items-center gap-4 p-3 bg-fg/[0.03] rounded-xl border border-line">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-acc-soft border-2 border-acc flex items-center justify-center shadow-inner shrink-0">
                {formData.logo ? (
                  <img
                    src={formData.logo}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-acc font-serif font-bold text-2xl">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : 'A'}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { if (el) (window as any).__logoInputRef = el }}
                    type="file"
                    id="logo-upload"
                    accept="image/png,image/svg+xml,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Kích thước file không được vượt quá 2MB')
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          setFormData(prev => ({ ...prev, logo: ev.target?.result as string }))
                        }
                        reader.readAsDataURL(file)
                      }
                      // Reset input so same file can be selected again
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('logo-upload') as HTMLInputElement
                      if (input) input.click()
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-panel text-fg border border-line rounded-lg hover:border-acc hover:text-acc shadow-sm transition cursor-pointer"
                  >
                    Tải logo lên
                  </button>
                  {formData.logo && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo: null }))}
                      className="px-3 py-1.5 text-xs font-bold bg-err-soft text-err border border-err/30 rounded-lg hover:bg-err-soft hover:border-err/30 shadow-sm transition"
                    >
                      Xóa logo
                    </button>
                  )}
                  <span className="text-[11px] text-muted">{formData.logo ? 'Đã tải lên ✓' : 'hoặc tự sinh monogram'}</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted mt-1.5">Hỗ trợ PNG, SVG, JPG (Khuyến nghị 512x512px, tối đa 2MB)</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-fg uppercase tracking-wide">Mô tả ngắn gọn &amp; Ghi chú vận hành</label>
              <span className="text-[11px] text-muted font-mono">{formData.description.length}/250</span>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value.slice(0, 250) }))}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-panel border border-line rounded-xl focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 outline-none text-fg placeholder:text-muted shadow-sm transition"
              placeholder="Mô tả định vị khách sạn, phong cách dịch vụ hoặc ghi chú cho nội bộ..."
              rows={2}
            />
          </div>

          {/* Currency & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-fg uppercase tracking-wide">Tiền tệ mặc định</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-semibold bg-panel border border-line rounded-xl focus-visible:border-acc outline-none text-fg shadow-sm"
              >
                <option value="VND">VND (₫) - Đồng Việt Nam</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-fg uppercase tracking-wide">Múi giờ vận hành</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-semibold bg-panel border border-line rounded-xl focus-visible:border-acc outline-none text-fg shadow-sm"
              >
                <option value="GMT+07:00">GMT+07:00 (Hà Nội, TP.HCM)</option>
                <option value="GMT+08:00">GMT+08:00 (Singapore, Bali)</option>
                <option value="GMT+09:00">GMT+09:00 (Tokyo, Seoul)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-fg/[0.03] border-t border-line/90 flex flex-col sm:flex-row items-center justify-end gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-muted hover:text-fg bg-panel hover:bg-fg/5 rounded-xl border border-line transition shadow-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !formData.name}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-bold text-on-ink bg-ink hover:bg-ink/90 rounded-xl shadow-md active:scale-[0.98] transition disabled:opacity-50"
            >
              {isCreating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-ink" />
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Tạo Workspace &amp; Thiết lập cơ sở</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Chỉnh sửa workspace">
        <form onSubmit={handleEdit}>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-err-soft border border-err/30 text-err text-sm">
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
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-fg bg-fg/5 hover:bg-fg/10 rounded-xl transition"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-on-ink px-4 py-2 rounded-xl font-semibold shadow-sm hover:shadow-lg transition disabled:opacity-50"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-ink" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Lưu thay đổi
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Ambient Glow Styles */}
      <style>{`
        .ambient-glow-1 {
          position: absolute;
          top: -120px;
          right: -80px;
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(217, 83, 56, 0.07) 0%, rgba(245, 230, 222, 0.04) 50%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .ambient-glow-2 {
          position: absolute;
          top: 360px;
          left: -150px;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(200, 150, 120, 0.06) 0%, rgba(250, 245, 240, 0) 70%);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>
    </div>
  )
}
