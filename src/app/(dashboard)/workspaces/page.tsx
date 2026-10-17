'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Modal, ModalFooter, Input, Textarea } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { routes } from '@/lib/utils/routes'
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
  Bell,
  PlusCircle,
  LogOut,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Globe,
  Clock,
  Bed,
  TrendingUp,
  Hotel,
  Coins,
  Percent,
  MailCheck,
  CreditCard,
  UserCheck,
  RefreshCw,
  Activity,
  HelpCircle,
  PhoneCall,
  Sparkles,
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
  role?: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'USER'
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
  invitedBy: {
    id: string
    name: string | null
    email: string
    role?: string
  }
  message?: string
  createdAt: string
}

const roleBadges: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN: { label: 'Chủ sở hữu', color: 'bg-terracotta-600 text-white border-terracotta-500', icon: <Crown className="w-3 h-3 text-amber-300" /> },
  MANAGER: { label: 'Quản lý', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: <Sparkles className="w-3 h-3 text-amber-600" /> },
  RECEPTIONIST: { label: 'Lễ tân', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Users className="w-3 h-3 text-emerald-600" /> },
  USER: { label: 'Thành viên', color: 'bg-sand-100 text-slate-700 border-sand-200', icon: <Building2 className="w-3 h-3 text-slate-500" /> },
}

export default function WorkspacesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [currentUser, setCurrentUser] = React.useState<User | null>(null)
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filterTab, setFilterTab] = React.useState<'all' | 'owned' | 'invited' | 'archived'>('all')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
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
    <div className="min-h-full bg-[#faf8f5] text-slate-800 antialiased selection:bg-terracotta-100 selection:text-terracotta-900 relative overflow-x-hidden">
      {/* Ambient Glow Background */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Header */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-sand-200/90 sticky top-0 z-40 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Brand Identity */}
            <div className="flex items-center space-x-6">
              <Link href="/workspaces" className="flex items-center gap-3.5 group">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-terracotta-500 via-terracotta-600 to-terracotta-700 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-terracotta-500/25 tracking-wide ring-2 ring-white group-hover:scale-105 transition-transform duration-200">
                  D
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight text-slate-900 leading-none group-hover:text-terracotta-600 transition-colors">
                    DigiStay
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta-600 mt-1.5 flex items-center gap-1.5">
                    Boutique Hospitality OS
                    <span className="w-1 h-1 rounded-full bg-terracotta-400" />
                  </span>
                </div>
              </Link>
              <div className="hidden md:block h-6 w-px bg-sand-200" />
              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 bg-sand-100/80 px-3.5 py-1.5 rounded-full border border-sand-200/90">
                <Layers className="w-3.5 h-3.5 text-terracotta-600" />
                <span>Không gian làm việc</span>
                <span className="text-sand-400">/</span>
                <span className="text-slate-900 font-semibold flex items-center gap-1.5">
                  Workspace Hub
                  <span className="px-1.5 py-0.2 bg-terracotta-100 text-terracotta-700 text-[10px] font-bold rounded">
                    Portal
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Actions and User Menu */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Cloud Status */}
              <div className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200/80 text-emerald-700 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Cloud Active</span>
              </div>

              {/* Notification Bell */}
              <button
                aria-label="Thông báo hệ thống"
                className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-sand-100 rounded-xl transition border border-transparent hover:border-sand-200"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-terracotta-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  3
                </span>
              </button>

              {/* Create Workspace Button */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-terracotta-500 via-terracotta-600 to-terracotta-700 hover:from-terracotta-600 hover:to-terracotta-800 text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition shadow-sm shadow-terracotta-500/30 active:scale-[0.98] ring-1 ring-white/20"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Tạo workspace mới</span>
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded border border-white/30 text-white">
                  ⌘N
                </kbd>
              </button>

              <div className="h-6 w-px bg-sand-200 hidden md:block" />

              {/* User Menu */}
              <div className="flex items-center gap-3 pl-1">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl ring-2 ring-terracotta-200/90 bg-gradient-to-br from-sand-200 to-sand-300 overflow-hidden flex items-center justify-center font-bold text-xs text-slate-800 tracking-wider shadow-inner">
                    {getUserInitials(currentUser?.name || null)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser?.name || 'Người dùng'}
                  </span>
                  <span className="text-[10px] font-semibold text-terracotta-600 mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Super Admin / Owner
                  </span>
                </div>
                <button
                  onClick={async () => {
                    sessionStorage.setItem('justSignedOut', 'true')
                    await signOut({ callbackUrl: '/' })
                  }}
                  className="text-slate-400 hover:text-terracotta-600 p-1.5 rounded-lg hover:bg-sand-100 transition"
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
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 bg-terracotta-50/90 border border-terracotta-200/90 text-terracotta-700 text-xs font-bold rounded-full mb-3.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-terracotta-500 animate-pulse" />
            Hệ điều hành vận hành khách sạn &amp; chuỗi Boutique
            <span className="text-terracotta-400">•</span>
            <span className="text-slate-600 font-medium">Boutique OS v4.2</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-[42px] font-serif font-bold text-slate-900 tracking-tight flex items-center gap-3 leading-tight">
            Chào mừng bạn quay lại, {currentUser?.name?.split(' ').pop() || 'bạn'}{' '}
            <span className="inline-block transform origin-bottom-right hover:rotate-12 transition-transform duration-300">
              👋
            </span>
          </h1>
          <p className="mt-3 text-slate-600 text-base md:text-lg leading-relaxed">
            Quản trị tập trung danh mục khách sạn, chuỗi villa và hệ thống booking trực tiếp của bạn.
            Bạn có thể mở rộng cơ sở, kiểm tra công suất phòng hoặc chuyển đổi giữa các không gian quản trị.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mb-8 pb-5 border-b border-sand-200/90">
          {/* Category Segmented Pill Tabs */}
          <div className="flex items-center gap-1.5 bg-sand-100/90 p-1 rounded-xl border border-sand-200">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm border border-sand-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>Tất cả</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                filterTab === 'all' ? 'bg-terracotta-50 text-terracotta-600' : 'bg-sand-200 text-slate-700'
              }`}>
                {workspaces.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('owned')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'owned'
                  ? 'bg-white text-slate-900 shadow-sm border border-sand-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>Chuỗi sở hữu</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] ${
                filterTab === 'owned' ? 'bg-terracotta-50 text-terracotta-600 font-bold' : 'bg-sand-200 text-slate-700'
              }`}>
                {ownedCount}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('invited')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                filterTab === 'invited'
                  ? 'bg-white text-slate-900 shadow-sm border border-sand-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>Được mời quản lý</span>
              <span className={`px-1.5 py-0.2 rounded text-[11px] ${
                filterTab === 'invited' ? 'bg-terracotta-50 text-terracotta-600 font-bold' : 'bg-sand-200 text-slate-700'
              }`}>
                {invitedCount}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('archived')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                filterTab === 'archived'
                  ? 'bg-white text-slate-900 shadow-sm border border-sand-200/80'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'
              }`}
            >
              <span>Lưu trữ</span>
            </button>
          </div>

          {/* Quick Search & View Toggle */}
          <div className="w-full lg:w-auto flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-2 text-xs md:text-sm bg-white border border-sand-300 rounded-xl focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-500/20 outline-none placeholder:text-slate-400 shadow-sm transition"
                placeholder="Tìm nhanh workspace..."
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono bg-sand-100 text-slate-500 rounded border border-sand-200 pointer-events-none">
                ⌘K
              </kbd>
            </div>

            {/* Filter Button */}
            <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-sand-300 text-slate-700 hover:text-slate-900 rounded-xl hover:border-slate-400 transition text-xs font-semibold shadow-sm">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Bộ lọc</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-sand-100/90 p-1 rounded-xl border border-sand-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-terracotta-600 shadow-sm border border-sand-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng lưới (Grid)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list'
                    ? 'bg-white text-terracotta-600 shadow-sm border border-sand-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng danh sách (List)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {filteredWorkspaces.map((ws) => {
                const role = roleBadges[ws.role || 'USER']
                const isOwner = ws.ownerId === currentUser?.id
                const isBoutiquePro = isOwner && ws._count.properties >= 3

                return (
                  <article
                    key={ws.id}
                    className="group relative bg-white rounded-2xl border border-sand-200 shadow-card hover:shadow-card-hover hover:border-terracotta-400 transition-all duration-300 flex flex-col overflow-hidden"
                  >
                    {/* Card Banner */}
                    <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold backdrop-blur-md shadow-sm border ${
                          isOwner
                            ? 'bg-terracotta-600 text-white border-terracotta-500'
                            : 'bg-white/95 text-slate-700 border-white/40'
                        }`}>
                          {isOwner ? (
                            <>
                              <Crown className="w-3 h-3 text-amber-300" />
                              Chủ sở hữu
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3 text-amber-500" />
                              Thành viên
                            </>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50/95 backdrop-blur-md px-2.5 py-1 rounded-md border border-emerald-200/70 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          VietQR Active
                        </span>
                      </div>

                      {/* Monogram */}
                      <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
                        <div className={`w-12 h-12 rounded-xl ring-4 ring-white border shadow-md flex items-center justify-center font-serif font-bold text-xl ${
                          isBoutiquePro
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-sand-50 border-sand-200 text-terracotta-600'
                        }`}>
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-terracotta-600 transition-colors leading-snug">
                              {ws.name}
                            </h3>
                            <div className={`flex items-center gap-1.5 text-xs mt-1 font-mono ${
                              isOwner ? 'text-terracotta-700 font-medium' : 'text-slate-500'
                            }`}>
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                              <span>{isOwner ? `${ws.slug}.digistay.vn` : `/${ws.slug}`}</span>
                            </div>
                          </div>
                          {isOwner && (
                            <div className="relative z-10">
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  const menu = e.currentTarget.nextElementSibling as HTMLElement
                                  menu?.classList.toggle('hidden')
                                }}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-sand-100 transition"
                                aria-label="Tùy chọn"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="hidden absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-sand-200 py-1 min-w-[140px] z-20">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    openEdit(ws)
                                    e.currentTarget.closest('.hidden')?.classList.add('hidden')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-sand-50 flex items-center gap-2"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Chỉnh sửa
                                </button>
                                <div className="border-t border-sand-200 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleDelete(ws.id)
                                    e.currentTarget.closest('.hidden')?.classList.add('hidden')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Xoá workspace
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {ws.description && (
                          <p className="mt-3 text-xs md:text-sm text-slate-600 leading-relaxed line-clamp-2">
                            {ws.description}
                          </p>
                        )}

                        {/* Key Metrics Stats Grid */}
                        <div className={`grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl border ${
                          isBoutiquePro
                            ? 'bg-amber-50/40 border-amber-200/60'
                            : 'bg-sand-50/80 border-sand-200/80'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-sand-200 flex items-center justify-center text-slate-600 shrink-0">
                              <Hotel className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cơ sở</div>
                              <div className="text-xs font-bold text-slate-800">
                                {ws._count.properties} {ws._count.properties > 1 ? 'chi nhánh' : 'cơ sở'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-sand-200 flex items-center justify-center text-slate-600 shrink-0">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-semibold">Nhân sự</div>
                              <div className="text-xs font-bold text-slate-800">
                                {ws._count.members} thành viên
                              </div>
                            </div>
                          </div>
                          {isBoutiquePro && (
                            <>
                              <div className="flex items-center gap-2 pt-1 border-t border-amber-200/40">
                                <div className="w-7 h-7 rounded-lg bg-white border border-sand-200 flex items-center justify-center text-slate-600 shrink-0">
                                  <Coins className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Doanh thu T3</div>
                                  <div className="text-xs font-bold text-terracotta-700">--</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-amber-200/40">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                                  <Percent className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Lấp đầy</div>
                                  <div className="text-xs font-bold text-emerald-700">--</div>
                                </div>
                              </div>
                            </>
                          )}
                          {!isBoutiquePro && (
                            <>
                              <div className="flex items-center gap-2 pt-1 border-t border-sand-200/50">
                                <div className="w-7 h-7 rounded-lg bg-white border border-sand-200 flex items-center justify-center text-slate-600 shrink-0">
                                  <Bed className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Quy mô</div>
                                  <div className="text-xs font-bold text-slate-800">
                                    {ws._count.properties * 4} phòng
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-sand-200/50">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Lấp đầy</div>
                                  <div className="text-xs font-bold text-emerald-700">--</div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card Footer CTA */}
                      <div className="mt-5 pt-3.5 border-t border-sand-200/80 flex items-center justify-between">
                        {isBoutiquePro ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Đồng bộ OTA Live
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Hoạt động hôm nay
                          </span>
                        )}
                        <Link
                          href={routes.workspace(ws.slug)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-terracotta-600 hover:text-white bg-terracotta-50 hover:bg-terracotta-600 px-3 py-1.5 rounded-lg group-hover:translate-x-1 transition-all shadow-sm"
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
                className="group relative rounded-2xl border-2 border-dashed border-sand-300 hover:border-terracotta-500 bg-white/60 hover:bg-gradient-to-b hover:from-white hover:to-terracotta-50/40 backdrop-blur-sm transition-all duration-300 flex flex-col items-center justify-center p-8 text-center cursor-pointer min-h-[350px] shadow-sm hover:shadow-card-hover"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-terracotta-50 to-sand-100 group-hover:from-terracotta-500 group-hover:to-terracotta-600 border border-sand-300 group-hover:border-terracotta-600 text-terracotta-600 group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-glow group-hover:scale-110">
                  <Plus className="w-8 h-8 stroke-[2.2]" />
                </div>
                <h3 className="mt-6 font-bold text-lg text-slate-900 group-hover:text-terracotta-600 transition-colors">
                  Khởi tạo Workspace mới
                </h3>
                <p className="mt-2 text-xs md:text-sm text-slate-500 max-w-[260px] leading-relaxed">
                  Mở rộng chuỗi khách sạn, khu nghỉ dưỡng sinh thái, villa hoặc homestay mới với tên miền và cổng thanh toán riêng.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-terracotta-600 group-hover:text-white bg-white group-hover:bg-terracotta-600 px-4 py-2 rounded-xl border border-sand-300 group-hover:border-terracotta-600 shadow-sm transition-all">
                  <span>Bắt đầu thiết lập</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* Auxiliary Sections */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Pending Invitation Box */}
              <section className="lg:col-span-5 bg-white rounded-2xl border border-sand-200/90 p-6 shadow-card flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-terracotta-500" />
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-sand-200">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-terracotta-50 text-terracotta-600 flex items-center justify-center">
                        <MailCheck className="w-4 h-4" />
                      </div>
                      <span>Lời mời cộng tác mới</span>
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      {pendingInvitationsCount} chờ xử lý
                    </span>
                  </div>

                  {pendingInvitationsCount > 0 ? (
                    invitations.map((invitation) => (
                      <div key={invitation.id} className="mt-4 p-4 rounded-xl bg-sand-50/90 border border-sand-200/80 flex flex-col gap-3.5">
                        <div className="flex items-start gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-white border border-sand-300 font-serif font-bold text-lg text-slate-800 flex items-center justify-center shadow-sm shrink-0">
                            {invitation.workspace.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900">{invitation.workspace.name}</h5>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-terracotta-100 text-terracotta-700">Mới</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Vai trò đề xuất: <span className="font-bold text-slate-800">{invitation.role}</span>
                            </p>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Gửi từ: {invitation.invitedBy.name || invitation.invitedBy.email}</span>
                            </div>
                          </div>
                        </div>
                        {invitation.message && (
                          <div className="p-3 bg-white rounded-lg border border-sand-200 text-xs text-slate-600 italic leading-relaxed">
                            &quot;{invitation.message}&quot;
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="mt-4 p-4 rounded-xl bg-sand-50/90 border border-sand-200/80 text-center">
                      <div className="w-12 h-12 rounded-xl bg-white border border-sand-300 flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <MailCheck className="w-6 h-6 text-sand-400" />
                      </div>
                      <p className="text-sm text-slate-500">Không có lời mời cộng tác nào</p>
                    </div>
                  )}
                </div>

                {pendingInvitationsCount > 0 && (
                  <div className="mt-5 pt-3.5 flex items-center gap-3">
                    <button
                      onClick={() => handleAcceptInvitation(invitations[0].id)}
                      className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-terracotta-500 to-terracotta-600 hover:from-terracotta-600 hover:to-terracotta-700 rounded-xl transition shadow-sm shadow-terracotta-500/20 text-center flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Chấp nhận lời mời
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitations[0].id)}
                      className="py-2.5 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 bg-sand-100 hover:bg-sand-200 rounded-xl transition text-center border border-sand-200"
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </section>

              {/* System Quick Insights & Recent Activity */}
              <section className="lg:col-span-7 bg-white rounded-2xl border border-sand-200/90 p-6 shadow-card">
                <div className="flex items-center justify-between pb-4 border-b border-sand-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Hoạt động thời gian thực (Live Stream)</h4>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-sand-100 px-2.5 py-1 rounded-full border border-sand-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đồng bộ tự động
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {/* Activity Item 1 */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl hover:bg-sand-50 transition border border-sand-100 hover:border-sand-200 group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          Đặt phòng trực tiếp thành công (#BK-8902)
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-700">{workspaces[0]?.name || 'Workspace'}</span> • Phòng Deluxe King • <span className="font-bold text-emerald-700">4.250.000 đ</span> qua VietQR
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap pl-2">8 phút trước</span>
                  </div>
                  {/* Activity Item 2 */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl hover:bg-sand-50 transition border border-sand-100 hover:border-sand-200 group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-terracotta-50 text-terracotta-600 border border-terracotta-200 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-terracotta-700 transition-colors">
                          Cập nhật phân quyền nhân sự ca sáng
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-700">{workspaces[1]?.name || 'Workspace'}</span> • Cấp quyền Lễ tân tiếp đón cho nhân viên: <span className="font-medium text-slate-800">Tran Thu Hang</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap pl-2">2 giờ trước</span>
                  </div>
                  {/* Activity Item 3 */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl hover:bg-sand-50 transition border border-sand-100 hover:border-sand-200 group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                          Đồng bộ giá phòng 2 chiều OTA Booking.com
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-700">{workspaces[0]?.name || 'Workspace'}</span> • Đã cập nhật bảng giá cuối tuần (All 38 Inventory Units)
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap pl-2">4 giờ trước</span>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-sand-200 bg-white/90 backdrop-blur-md py-6 text-xs text-slate-500 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-slate-700">Hệ thống máy chủ DigiStay Cloud:</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              99.98% Hoạt động ổn định
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a className="hover:text-terracotta-600 transition flex items-center gap-1.5 font-medium" href="#help">
              <HelpCircle className="w-3.5 h-3.5" />
              Trung tâm hỗ trợ
            </a>
            <a className="hover:text-terracotta-600 transition flex items-center gap-1.5 font-medium" href="#hotline">
              <PhoneCall className="w-3.5 h-3.5" />
              Hotline 24/7: 1900 8922
            </a>
            <span className="text-slate-400">© 2026 DigiStay Boutique OS. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sand-200/90 flex items-center justify-between bg-gradient-to-r from-sand-50/90 via-white to-sand-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 text-white flex items-center justify-center shadow-md shadow-terracotta-500/25 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Tạo không gian làm việc mới 
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-terracotta-50 text-terracotta-600 border border-terracotta-200">Boutique OS</span>
              </h3>
              <p className="text-xs text-slate-500">Thiết lập môi trường vận hành riêng biệt cho cơ sở hoặc chuỗi lưu trú của bạn</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateOpen(false)}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sand-100 flex items-center justify-center transition border border-transparent hover:border-sand-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-left max-h-[calc(92vh-220px)]">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Workspace Name & Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Tên Workspace / Thương hiệu <span className="text-terracotta-600">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Hiển thị trên booking &amp; hóa đơn</span>
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-sand-300 rounded-xl focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-500/20 outline-none text-slate-900 shadow-sm font-medium"
              placeholder="VD: An Nam Boutique Hotel, Hoi An Retreat..."
              required
              autoFocus
            />
            <div className="flex items-center justify-between text-xs text-slate-500 bg-sand-50 p-2.5 rounded-xl border border-sand-200/80">
              <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-slate-600 truncate">
                <span className="text-slate-400">slug:</span>
                <span className="text-terracotta-600 font-semibold">
                  {formData.slug ? `digistay.vn/${formData.slug}` : 'Nhập tên để tạo slug...'}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const newSlug = prompt('Nhập slug tùy chỉnh:', formData.slug)
                  if (newSlug) handleSlugChange(newSlug)
                }}
                className="text-[11px] font-semibold text-terracotta-600 hover:text-terracotta-700 underline shrink-0 ml-2"
              >
                Tùy chỉnh slug
              </button>
            </div>
          </div>

          {/* Business Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Mô hình kinh doanh lưu trú <span className="text-terracotta-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'boutique_hotel' ? 'border-terracotta-500 bg-terracotta-50/40' : 'border-sand-200 bg-white hover:border-sand-300'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="boutique_hotel"
                  checked={formData.businessType === 'boutique_hotel'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-terracotta-100 text-terracotta-600 flex items-center justify-center font-bold text-xs">🏨</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'boutique_hotel' ? 'border-terracotta-600' : 'border-sand-300'}`}>
                    {formData.businessType === 'boutique_hotel' && <span className="w-1.5 h-1.5 rounded-full bg-terracotta-600"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Boutique Hotel</span>
                <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">Khách sạn phố, mini hotel phong cách</span>
              </label>

              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'resort' ? 'border-terracotta-500 bg-terracotta-50/40' : 'border-sand-200 bg-white hover:border-sand-300'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="resort"
                  checked={formData.businessType === 'resort'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-sand-100 text-slate-600 flex items-center justify-center font-bold text-xs">🏡</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'resort' ? 'border-terracotta-600' : 'border-sand-300'}`}>
                    {formData.businessType === 'resort' && <span className="w-1.5 h-1.5 rounded-full bg-terracotta-600"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Resort &amp; Biệt thự</span>
                <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">Khu nghỉ dưỡng, villa ven biển/núi</span>
              </label>

              <label className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer shadow-sm transition ${formData.businessType === 'homestay' ? 'border-terracotta-500 bg-terracotta-50/40' : 'border-sand-200 bg-white hover:border-sand-300'}`}>
                <input
                  type="radio"
                  name="business_type"
                  value="homestay"
                  checked={formData.businessType === 'homestay'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-lg bg-sand-100 text-slate-600 flex items-center justify-center font-bold text-xs">🛏️</span>
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.businessType === 'homestay' ? 'border-terracotta-600' : 'border-sand-300'}`}>
                    {formData.businessType === 'homestay' && <span className="w-1.5 h-1.5 rounded-full bg-terracotta-600"></span>}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900">Chuỗi Homestay</span>
                <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">Căn hộ dịch vụ, phòng chia sẻ</span>
              </label>
            </div>
          </div>

          {/* Brand Identity */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">Nhận diện thương hiệu</label>
            <div className="flex items-center gap-4 p-3 bg-sand-50/70 rounded-xl border border-sand-200">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-terracotta-100 to-terracotta-200 border-2 border-terracotta-300 flex items-center justify-center text-terracotta-700 font-serif font-bold text-2xl shadow-inner shrink-0">
                {formData.name ? formData.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
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
                    }}
                  />
                  <label
                    htmlFor="logo-upload"
                    className="px-3 py-1.5 text-xs font-bold bg-white text-slate-800 border border-sand-300 rounded-lg hover:border-terracotta-400 hover:text-terracotta-600 shadow-sm transition cursor-pointer"
                  >
                    Tải logo lên
                  </label>
                  <span className="text-[11px] text-slate-400">hoặc tự sinh monogram</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1.5">Hỗ trợ PNG, SVG, JPG (Khuyến nghị 512x512px, tối đa 2MB)</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">Mô tả ngắn gọn &amp; Ghi chú vận hành</label>
              <span className="text-[11px] text-slate-400 font-mono">{formData.description.length}/250</span>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value.slice(0, 250) }))}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-sand-300 rounded-xl focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-500/20 outline-none text-slate-800 placeholder:text-slate-400 shadow-sm transition"
              placeholder="Mô tả định vị khách sạn, phong cách dịch vụ hoặc ghi chú cho nội bộ..."
              rows={2}
            />
          </div>

          {/* Currency & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">Tiền tệ mặc định</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-sand-300 rounded-xl focus:border-terracotta-500 outline-none text-slate-800 shadow-sm"
              >
                <option value="VND">VND (₫) - Đồng Việt Nam</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">Múi giờ vận hành</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-sand-300 rounded-xl focus:border-terracotta-500 outline-none text-slate-800 shadow-sm"
              >
                <option value="GMT+07:00">GMT+07:00 (Hà Nội, TP.HCM)</option>
                <option value="GMT+08:00">GMT+08:00 (Singapore, Bali)</option>
                <option value="GMT+09:00">GMT+09:00 (Tokyo, Seoul)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-sand-50/90 border-t border-sand-200/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Bảo mật đa tenant cô lập chuẩn ISO 27001</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-sand-100 rounded-xl border border-sand-300 transition shadow-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !formData.name}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-terracotta-500 via-terracotta-600 to-terracotta-700 hover:from-terracotta-600 hover:to-terracotta-800 rounded-xl shadow-md shadow-terracotta-500/25 active:scale-[0.98] transition disabled:opacity-50"
            >
              {isCreating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-sand-100 hover:bg-sand-200 rounded-xl transition"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white px-4 py-2 rounded-xl font-semibold shadow-sm shadow-terracotta-500/30 hover:shadow-lg transition disabled:opacity-50"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
