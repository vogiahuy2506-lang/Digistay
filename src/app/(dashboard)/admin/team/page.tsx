'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  UserX,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Crown,
  Shield,
  Clock,
} from 'lucide-react'

interface AdminMember {
  id: string
  name: string | null
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN'
  avatar: string | null
  image: string | null
  hasTwoFactor: boolean
  twoFactorEnabledAt: string | null
  isDisabled: boolean
  disabledAt: string | null
  disabledReason: string | null
  createdAt: string
}

interface TeamStats {
  total: number
  superAdmins: number
  admins: number
  twoFactorRate: number
  twoFactorCount: number
  disabledCount: number
}

export default function AdminTeamPage() {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [stats, setStats] = useState<TeamStats>({
    total: 0,
    superAdmins: 0,
    admins: 0,
    twoFactorRate: 0,
    twoFactorCount: 0,
    disabledCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  // Notification toast
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN')

  const [reset2FaTarget, setReset2FaTarget] = useState<AdminMember | null>(null)
  const [reset2FaReason, setReset2FaReason] = useState('')

  const [roleChangeTarget, setRoleChangeTarget] = useState<AdminMember | null>(null)
  const [targetNewRole, setTargetNewRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN')

  function flashMessage(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function fetchTeam() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/team')
      const json = await res.json()
      if (json.success) {
        setMembers(json.data.members)
        setStats(json.data.stats)
      } else {
        flashMessage(json.error || 'Không thể tải danh sách nhân sự', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi tải danh sách quản trị viên', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle Add / Assign Admin
  async function handleAssignAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) {
      flashMessage('Vui lòng nhập địa chỉ email', 'error')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
        })
        const json = await res.json()
        if (json.success) {
          flashMessage(json.message)
          setShowAddModal(false)
          setNewEmail('')
          setNewRole('ADMIN')
          fetchTeam()
        } else {
          flashMessage(json.error || 'Không thể cấp quyền quản trị', 'error')
        }
      } catch {
        flashMessage('Lỗi kết nối khi phân quyền', 'error')
      }
    })
  }

  // Handle Role Change
  async function handleConfirmRoleChange() {
    if (!roleChangeTarget) return

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/team/${roleChangeTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CHANGE_ROLE', role: targetNewRole }),
        })
        const json = await res.json()
        if (json.success) {
          flashMessage(json.message)
          setRoleChangeTarget(null)
          fetchTeam()
        } else {
          flashMessage(json.error || 'Không thể đổi vai trò', 'error')
        }
      } catch {
        flashMessage('Lỗi kết nối khi đổi vai trò', 'error')
      }
    })
  }

  // Handle Toggle Disable
  async function handleToggleDisable(member: AdminMember) {
    const actionText = member.isDisabled ? 'mở khóa' : 'tạm khóa'
    if (!confirm(`Bạn có chắc chắn muốn ${actionText} quyền truy cập của ${member.email}?`)) return

    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_DISABLE',
          disabled: !member.isDisabled,
          reason: member.isDisabled ? undefined : 'Khóa tài khoản quản trị nội bộ',
        }),
      })
      const json = await res.json()
      if (json.success) {
        flashMessage(json.message)
        fetchTeam()
      } else {
        flashMessage(json.error || 'Không thể thay đổi trạng thái', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi cập nhật trạng thái', 'error')
    }
  }

  // Handle Revoke Admin Role
  async function handleRevokeRole(member: AdminMember) {
    if (
      !confirm(
        `XÁC NHẬN: Bạn có chắc chắn muốn thu hồi toàn bộ quyền quản trị của ${member.email}? Tài khoản sẽ trở về cấp USER thường.`
      )
    )
      return

    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        flashMessage(json.message)
        fetchTeam()
      } else {
        flashMessage(json.error || 'Không thể thu hồi quyền', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi thu hồi quyền', 'error')
    }
  }

  // Handle Reset 2FA
  async function handleConfirmReset2Fa(e: React.FormEvent) {
    e.preventDefault()
    if (!reset2FaTarget) return
    if (!reset2FaReason.trim()) {
      flashMessage('Vui lòng ghi rõ lý do reset 2FA', 'error')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/team/${reset2FaTarget.id}/reset-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reset2FaReason.trim() }),
        })
        const json = await res.json()
        if (json.success) {
          flashMessage(json.message)
          setReset2FaTarget(null)
          setReset2FaReason('')
          fetchTeam()
        } else {
          flashMessage(json.error || 'Không thể reset 2FA', 'error')
        }
      } catch {
        flashMessage('Lỗi khi reset 2FA', 'error')
      }
    })
  }

  const filteredMembers = members.filter(
    (m) =>
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.name && m.name.toLowerCase().includes(search.toLowerCase())) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {message && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all ${
            message.type === 'success'
              ? 'bg-emerald-600 text-white dark:bg-emerald-700'
              : 'bg-rose-600 text-white dark:bg-rose-700'
          }`}
        >
          {message.type === 'success' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Đội ngũ Quản trị Cấp cao & RBAC
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Quản trị nhân sự hệ thống, phân quyền Super Admin / Admin, giám sát bảo mật 2FA và quyền truy cập
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Phân quyền Admin mới
          </button>

          <button
            onClick={fetchTeam}
            className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Tổng Quản trị viên
            </span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {stats.total}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {stats.disabledCount > 0 ? `${stats.disabledCount} tài khoản đang bị khóa` : 'Tất cả đang hoạt động'}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Super Admin
            </span>
            <Crown className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {stats.superAdmins}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Toàn quyền kiểm soát nền tảng</div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Admin Vận hành
            </span>
            <Shield className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.admins}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Vận hành gói, khách hàng & đối tác</div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Tuân thủ bảo mật 2FA
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.twoFactorRate}%
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {stats.twoFactorCount}/{stats.total} nhân sự đã kích hoạt 2FA
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm quản trị viên theo tên, email hoặc vai trò..."
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
        />
      </div>

      {/* Team Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-500">Đang tải danh sách nhân sự...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            {search ? 'Không tìm thấy quản trị viên nào' : 'Chưa có dữ liệu quản trị viên'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3">Quản trị viên</th>
                  <th className="px-6 py-3">Vai trò RBAC</th>
                  <th className="px-6 py-3 text-center">Bảo mật 2FA</th>
                  <th className="px-6 py-3">Trạng thái</th>
                  <th className="px-6 py-3">Ngày gia nhập</th>
                  <th className="px-6 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-neutral-700 dark:text-neutral-300 overflow-hidden">
                          {member.avatar || member.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.avatar || member.image || ''}
                              alt={member.name || member.email}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (member.name || member.email)[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                            {member.name || 'Chưa đặt tên'}
                            {member.role === 'SUPER_ADMIN' && (
                              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {member.role === 'SUPER_ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                          <Crown className="w-3 h-3" />
                          SUPER ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <Shield className="w-3 h-3" />
                          ADMIN
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {member.hasTwoFactor ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã bật 2FA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Chưa kích hoạt
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {member.isDisabled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <Lock className="w-3.5 h-3.5" />
                          Đã bị khóa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hoạt động
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {new Date(member.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Change Role Button */}
                        <button
                          onClick={() => {
                            setRoleChangeTarget(member)
                            setTargetNewRole(member.role === 'SUPER_ADMIN' ? 'ADMIN' : 'SUPER_ADMIN')
                          }}
                          className="px-2.5 py-1 text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                          title="Đổi vai trò"
                        >
                          Đổi vai trò
                        </button>

                        {/* Reset 2FA */}
                        {member.hasTwoFactor && (
                          <button
                            onClick={() => {
                              setReset2FaTarget(member)
                              setReset2FaReason('')
                            }}
                            className="p-1.5 text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 rounded transition-colors"
                            title="Reset xác thực 2FA"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {/* Toggle Disable */}
                        <button
                          onClick={() => handleToggleDisable(member)}
                          className={`p-1.5 rounded transition-colors ${
                            member.isDisabled
                              ? 'text-rose-600 hover:text-emerald-600'
                              : 'text-neutral-500 hover:text-rose-600'
                          }`}
                          title={member.isDisabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                        >
                          {member.isDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>

                        {/* Revoke Role */}
                        <button
                          onClick={() => handleRevokeRole(member)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                          title="Thu hồi quyền quản trị"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PHÂN QUYỀN ADMIN MỚI */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Phân quyền Quản trị viên
            </h3>
            <p className="text-xs text-neutral-500">
              Nhập email của người dùng đã đăng ký tài khoản Digistay để nâng cấp lên quản trị viên nội bộ.
            </p>

            <form onSubmit={handleAssignAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Địa chỉ Email người dùng *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@digistay.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Vai trò quản trị *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="ADMIN">ADMIN (Quản trị vận hành, gói & đối tác)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Toàn quyền hệ thống & hạ tầng)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Xác nhận cấp quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET 2FA */}
      {reset2FaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              Đặt lại xác thực 2FA
            </h3>
            <p className="text-xs text-neutral-500">
              Bạn đang chuẩn bị tắt xác thực 2 bước cho <strong className="text-neutral-900 dark:text-neutral-100">{reset2FaTarget.email}</strong>. Hành động này sẽ được ghi vào nhật ký an ninh.
            </p>

            <form onSubmit={handleConfirmReset2Fa} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Lý do reset 2FA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nhân sự bị mất điện thoại, đã xác minh trực tiếp"
                  value={reset2FaReason}
                  onChange={(e) => setReset2FaReason(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReset2FaTarget(null)}
                  className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang xử lý...' : 'Xác nhận Reset 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ĐỔI VAI TRÒ */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              Thay đổi vai trò quản trị
            </h3>
            <p className="text-xs text-neutral-500">
              Chuyển đổi vai trò của <strong className="text-neutral-900 dark:text-neutral-100">{roleChangeTarget.email}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Chọn vai trò mới *
                </label>
                <select
                  value={targetNewRole}
                  onChange={(e) => setTargetNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleChangeTarget(null)}
                  className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmRoleChange}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

