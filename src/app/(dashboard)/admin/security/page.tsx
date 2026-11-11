'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  Lock,
  Unlock,
  Activity,
  CheckCircle2,
  Clock,
  KeyRound,
} from 'lucide-react'

interface BlacklistRecord {
  id: string
  ipAddress: string
  reason: string
  attemptCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CustomReservedSubdomain {
  id: string
  subdomain: string
  reason: string | null
  createdAt: string
}

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState<'blacklist' | 'subdomains' | 'monitoring'>('blacklist')
  const [isPending, startTransition] = useTransition()

  // Blacklist state
  const [blacklist, setBlacklist] = useState<BlacklistRecord[]>([])
  const [loadingBlacklist, setLoadingBlacklist] = useState(true)
  const [ipSearch, setIpSearch] = useState('')
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockIpInput, setBlockIpInput] = useState('')
  const [blockReasonInput, setBlockReasonInput] = useState('')
  const [blockDurationInput, setBlockDurationInput] = useState<'permanent' | '1h' | '24h' | '7d'>('permanent')

  // Subdomains state
  const [staticReserved, setStaticReserved] = useState<string[]>([])
  const [customReserved, setCustomReserved] = useState<CustomReservedSubdomain[]>([])
  const [loadingSubdomains, setLoadingSubdomains] = useState(true)
  const [subdomainSearch, setSubdomainSearch] = useState('')
  const [showAddSubdomainModal, setShowAddSubdomainModal] = useState(false)
  const [newSubdomain, setNewSubdomain] = useState('')
  const [newSubdomainReason, setNewSubdomainReason] = useState('')

  // Notifications
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function flashMessage(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // Load Blacklist
  async function fetchBlacklist() {
    setLoadingBlacklist(true)
    try {
      const res = await fetch('/api/admin/security/ip-blacklist')
      const json = await res.json()
      if (json.success) {
        setBlacklist(json.data)
      } else {
        flashMessage(json.error || 'Không thể tải danh sách IP', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi tải IP Blacklist', 'error')
    } finally {
      setLoadingBlacklist(false)
    }
  }

  // Load Subdomains
  async function fetchSubdomains() {
    setLoadingSubdomains(true)
    try {
      const res = await fetch('/api/admin/security/reserved-subdomains')
      const json = await res.json()
      if (json.success) {
        setStaticReserved(json.data.staticReserved || [])
        setCustomReserved(json.data.customReserved || [])
      } else {
        flashMessage(json.error || 'Không thể tải danh sách tên miền cấm', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi tải tên miền cấm', 'error')
    } finally {
      setLoadingSubdomains(false)
    }
  }

  useEffect(() => {
    fetchBlacklist()
    fetchSubdomains()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle Add IP to Blacklist
  async function handleBlockIp(e: React.FormEvent) {
    e.preventDefault()
    if (!blockIpInput.trim() || !blockReasonInput.trim()) {
      flashMessage('Vui lòng nhập IP và lý do chặn', 'error')
      return
    }

    let expiresAt: string | null = null
    const now = new Date()
    if (blockDurationInput === '1h') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    } else if (blockDurationInput === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    } else if (blockDurationInput === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/security/ip-blacklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ipAddress: blockIpInput.trim(),
            reason: blockReasonInput.trim(),
            expiresAt,
          }),
        })
        const json = await res.json()
        if (json.success) {
          flashMessage(`Đã chặn địa chỉ IP ${blockIpInput.trim()}`)
          setShowBlockModal(false)
          setBlockIpInput('')
          setBlockReasonInput('')
          setBlockDurationInput('permanent')
          fetchBlacklist()
        } else {
          flashMessage(json.error || 'Không thể chặn IP', 'error')
        }
      } catch {
        flashMessage('Lỗi kết nối khi thực hiện chặn IP', 'error')
      }
    })
  }

  // Handle Toggle IP Status
  async function handleToggleIp(id: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/admin/security/ip-blacklist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      const json = await res.json()
      if (json.success) {
        flashMessage(currentActive ? 'Đã tạm mở khóa IP' : 'Đã kích hoạt lại chặn IP')
        setBlacklist((prev) =>
          prev.map((row) => (row.id === id ? { ...row, isActive: !currentActive } : row))
        )
      } else {
        flashMessage(json.error || 'Không thể đổi trạng thái', 'error')
      }
    } catch {
      flashMessage('Lỗi khi cập nhật trạng thái IP', 'error')
    }
  }

  // Handle Unblock IP
  async function handleUnblockIp(id: string, ipAddress: string) {
    if (!confirm(`Bạn có chắc chắn muốn xóa IP ${ipAddress} khỏi danh sách chặn?`)) return
    try {
      const res = await fetch(`/api/admin/security/ip-blacklist/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        flashMessage(`Đã gỡ bỏ IP ${ipAddress}`)
        setBlacklist((prev) => prev.filter((r) => r.id !== id))
      } else {
        flashMessage(json.error || 'Không thể gỡ chặn', 'error')
      }
    } catch {
      flashMessage('Lỗi kết nối khi gỡ chặn', 'error')
    }
  }

  // Handle Add Custom Reserved Subdomain
  async function handleAddSubdomain(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubdomain.trim()) {
      flashMessage('Vui lòng nhập tên miền con', 'error')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/security/reserved-subdomains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: newSubdomain.trim(),
            reason: newSubdomainReason.trim() || undefined,
          }),
        })
        const json = await res.json()
        if (json.success) {
          flashMessage(`Đã bảo lưu tên miền con "${newSubdomain.trim()}"`)
          setShowAddSubdomainModal(false)
          setNewSubdomain('')
          setNewSubdomainReason('')
          fetchSubdomains()
        } else {
          flashMessage(json.error || 'Không thể thêm tên miền cấm', 'error')
        }
      } catch {
        flashMessage('Lỗi kết nối khi thêm tên miền cấm', 'error')
      }
    })
  }

  // Handle Delete Custom Reserved Subdomain
  async function handleDeleteSubdomain(id: string, subdomain: string) {
    if (!confirm(`Xác nhận xóa tên miền "${subdomain}" khỏi danh sách cấm?`)) return
    try {
      const res = await fetch(`/api/admin/security/reserved-subdomains/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        flashMessage(`Đã xóa tên miền "${subdomain}"`)
        setCustomReserved((prev) => prev.filter((s) => s.id !== id))
      } else {
        flashMessage(json.error || 'Không thể xóa tên miền cấm', 'error')
      }
    } catch {
      flashMessage('Lỗi khi xóa tên miền cấm', 'error')
    }
  }

  // Filtered lists
  const filteredBlacklist = blacklist.filter(
    (b) =>
      b.ipAddress.toLowerCase().includes(ipSearch.toLowerCase()) ||
      b.reason.toLowerCase().includes(ipSearch.toLowerCase())
  )

  const filteredStatic = staticReserved.filter((s) =>
    s.toLowerCase().includes(subdomainSearch.toLowerCase())
  )

  const filteredCustom = customReserved.filter(
    (s) =>
      s.subdomain.toLowerCase().includes(subdomainSearch.toLowerCase()) ||
      (s.reason && s.reason.toLowerCase().includes(subdomainSearch.toLowerCase()))
  )

  // Blacklist stats
  const totalBlocked = blacklist.length
  const activeBlocked = blacklist.filter((b) => b.isActive).length
  const totalViolations = blacklist.reduce((acc, cur) => acc + (cur.attemptCount || 1), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-fg sm:text-3xl flex items-center gap-2.5">
              <ShieldAlert className="w-7 h-7 text-rose-500" />
              Trung tâm Bảo mật & Tường lửa
            </h1>
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 border border-rose-500/20">
              Firewall & Guard
            </span>
          </div>
          <p className="text-sm text-muted mt-1.5">
            Quản trị IP Blacklist, chính sách tường lửa, bảo lưu tên miền con nhạy cảm và giám sát phòng thủ nền tảng
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'blacklist' && (
            <button
              onClick={() => setShowBlockModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
            >
              <Ban className="w-4 h-4" />
              Chặn địa chỉ IP
            </button>
          )}

          {activeTab === 'subdomains' && (
            <button
              onClick={() => setShowAddSubdomainModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Bảo lưu tên miền con
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'blacklist') fetchBlacklist()
              else if (activeTab === 'subdomains') fetchSubdomains()
            }}
            className="p-2 border border-line rounded-lg text-muted hover:text-fg hover:bg-fg/5 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto text-xs pb-3">
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`flex items-center gap-2 px-3.5 py-2 font-medium rounded-lg transition-all ${
            activeTab === 'blacklist'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20 shadow-xs'
              : 'text-muted hover:text-fg hover:bg-fg/5'
          }`}
        >
          <Ban className="w-4 h-4" />
          Tường lửa & IP Blacklist ({totalBlocked})
        </button>

        <button
          onClick={() => setActiveTab('subdomains')}
          className={`flex items-center gap-2 px-3.5 py-2 font-medium rounded-lg transition-all ${
            activeTab === 'subdomains'
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20 shadow-xs'
              : 'text-muted hover:text-fg hover:bg-fg/5'
          }`}
        >
          <Globe className="w-4 h-4" />
          Tên miền con cấm ({staticReserved.length + customReserved.length})
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-2 px-3.5 py-2 font-medium rounded-lg transition-all ${
            activeTab === 'monitoring'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 shadow-xs'
              : 'text-muted hover:text-fg hover:bg-fg/5'
          }`}
        >
          <Activity className="w-4 h-4" />
          Giám sát phòng thủ & Cảnh báo
        </button>
      </div>

      {/* TAB 1: IP BLACKLIST */}
      {activeTab === 'blacklist' && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-panel border border-line p-4 rounded-xl shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tổng IP trong danh sách
              </span>
              <div className="text-2xl font-bold text-fg mt-1">
                {totalBlocked}
              </div>
            </div>

            <div className="bg-panel border border-line p-4 rounded-xl shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Đang kích hoạt chặn
              </span>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {activeBlocked}
              </div>
            </div>

            <div className="bg-panel border border-line p-4 rounded-xl shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Lượt tấn công bị chặn
              </span>
              <div className="text-2xl font-bold text-fg mt-1">
                {totalViolations}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
            <input
              type="text"
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
              placeholder="Tìm theo địa chỉ IP hoặc lý do chặn..."
              className="w-full pl-9 pr-4 py-2 bg-panel border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-fg"
            />
          </div>

          {/* Blacklist Table */}
          <div className="bg-panel border border-line rounded-xl overflow-hidden shadow-xs">
            {loadingBlacklist ? (
              <div className="p-8 text-center text-sm text-muted">Đang tải danh sách IP...</div>
            ) : filteredBlacklist.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                {ipSearch ? 'Không tìm thấy địa chỉ IP nào phù hợp' : 'Chưa có địa chỉ IP nào bị chặn'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-fg/[0.02] text-xs font-semibold text-muted uppercase tracking-wider border-b border-line">
                    <tr>
                      <th className="px-6 py-3">Địa chỉ IP</th>
                      <th className="px-6 py-3">Lý do chặn</th>
                      <th className="px-6 py-3 text-center">Số lần vi phạm</th>
                      <th className="px-6 py-3">Thời hạn</th>
                      <th className="px-6 py-3">Trạng thái</th>
                      <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredBlacklist.map((item) => (
                      <tr key={item.id} className="hover:bg-fg/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-fg">
                          {item.ipAddress}
                        </td>
                        <td className="px-6 py-4 text-fg/80">
                          {item.reason}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {item.attemptCount} lần
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted text-xs">
                          {item.expiresAt ? (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(item.expiresAt).toLocaleString('vi-VN')}
                            </span>
                          ) : (
                            <span className="text-muted font-medium">Vĩnh viễn</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleIp(item.id, item.isActive)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                              item.isActive
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                : 'bg-fg/5 text-muted border border-line'
                            }`}
                          >
                            {item.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {item.isActive ? 'Đang chặn' : 'Đã tạm dừng'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleUnblockIp(item.id, item.ipAddress)}
                            className="text-muted hover:text-rose-600 p-1 rounded transition-colors"
                            title="Gỡ bỏ IP"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RESERVED SUBDOMAINS */}
      {activeTab === 'subdomains' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-panel border border-line p-4 rounded-xl shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tên miền con hệ thống cố định
              </span>
              <div className="text-2xl font-bold text-fg mt-1">
                {staticReserved.length}
              </div>
              <p className="text-xs text-muted mt-1">Các từ khóa lõi như admin, app, auth, api, mail...</p>
            </div>

            <div className="bg-panel border border-line p-4 rounded-xl shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                Tên miền con tùy chỉnh bổ sung
              </span>
              <div className="text-2xl font-bold text-indigo-500 mt-1">
                {customReserved.length}
              </div>
              <p className="text-xs text-muted mt-1">Các từ khóa nhạy cảm bổ sung do Super Admin cấu hình</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
            <input
              type="text"
              value={subdomainSearch}
              onChange={(e) => setSubdomainSearch(e.target.value)}
              placeholder="Tìm kiếm tên miền con trong danh sách cấm..."
              className="w-full pl-9 pr-4 py-2 bg-panel border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-fg"
            />
          </div>

          {/* Custom Subdomains Section */}
          <div className="bg-panel border border-line rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              Tên miền con tùy chỉnh ({filteredCustom.length})
            </h2>

            {loadingSubdomains ? (
              <div className="text-sm text-muted py-4">Đang tải...</div>
            ) : filteredCustom.length === 0 ? (
              <p className="text-sm text-muted py-2">
                Chưa có tên miền con tùy chỉnh nào. Bấm &quot;Bảo lưu tên miền con&quot; để thêm.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {filteredCustom.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-mono font-semibold text-fg">
                        {item.subdomain}.digistay.vn
                      </div>
                      {item.reason && (
                        <div className="text-xs text-muted mt-0.5">{item.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSubdomain(item.id, item.subdomain)}
                      className="text-muted hover:text-rose-600 p-1.5 rounded transition-colors"
                      title="Xóa tên miền cấm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Static Subdomains Section */}
          <div className="bg-panel border border-line rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Từ khóa cấm mặc định hệ sinh thái Digistay ({filteredStatic.length})
            </h2>
            <div className="flex flex-wrap gap-2 pt-2">
              {filteredStatic.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 bg-fg/5 text-fg rounded font-mono text-xs border border-line"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONITORING & AUDIT */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="bg-panel border border-line rounded-xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-semibold text-fg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Hàng rào an ninh & Tuân thủ bảo mật
              </h2>
              <p className="text-sm text-muted mt-1">
                Tổng quan trạng thái các lớp phòng thủ đang bảo vệ hệ thống Digistay Cloud
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-line bg-fg/[0.02] p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-fg">
                    HTTPS & TLS 1.3
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Mã hóa đường truyền end-to-end, chứng chỉ SSL tự động gia hạn với HSTS kích hoạt.
                  </p>
                </div>
              </div>

              <div className="border border-line bg-fg/[0.02] p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-fg">
                    Upstash Redis Rate Limiting
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Chống tấn công từ chối dịch vụ (DDoS) và ngăn chặn quét brute-force trên toàn bộ API.
                  </p>
                </div>
              </div>

              <div className="border border-line bg-fg/[0.02] p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-fg">
                    Bảo mật Mật khẩu (bcrypt 12 rounds)
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Mật khẩu người dùng được băm an toàn theo tiêu chuẩn OWASP, không lưu trữ văn bản thô.
                  </p>
                </div>
              </div>

              <div className="border border-line bg-fg/[0.02] p-4 rounded-lg flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-fg">
                    Xác thực 2 yếu tố (2FA TOTP RFC 6238)
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Hỗ trợ Google Authenticator / Authy cho toàn bộ đội ngũ quản trị viên cấp cao.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHẶN IP */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-panel rounded-xl max-w-md w-full p-6 shadow-2xl border border-line space-y-4">
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" />
              Chặn địa chỉ IP
            </h3>

            <form onSubmit={handleBlockIp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg mb-1">
                  Địa chỉ IPv4 hoặc IPv6 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 103.21.244.1"
                  value={blockIpInput}
                  onChange={(e) => setBlockIpInput(e.target.value)}
                  className="w-full px-3 py-2 bg-page border border-line rounded-lg text-sm font-mono text-fg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fg mb-1">
                  Lý do chặn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Spam đặt phòng ảo, Quét mật khẩu brute-force"
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  className="w-full px-3 py-2 bg-page border border-line rounded-lg text-sm text-fg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-fg mb-1">
                  Thời hạn chặn
                </label>
                <select
                  value={blockDurationInput}
                  onChange={(e) => setBlockDurationInput(e.target.value as any)}
                  className="w-full px-3 py-2 bg-page border border-line rounded-lg text-sm text-fg focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="permanent">Vĩnh viễn (cho đến khi gỡ thủ công)</option>
                  <option value="1h">1 Giờ</option>
                  <option value="24h">24 Giờ</option>
                  <option value="7d">7 Ngày</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 border border-line rounded-lg text-sm font-medium hover:bg-fg/5 text-muted hover:text-fg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Xác nhận chặn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM TÊN MIỀN CON CẤM */}
      {showAddSubdomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-panel rounded-xl max-w-md w-full p-6 shadow-2xl border border-line space-y-4">
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Bảo lưu tên miền con
            </h3>

            <form onSubmit={handleAddSubdomain} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg mb-1">
                  Tên miền con (Subdomain) *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: payment, vip, partner"
                    value={newSubdomain}
                    onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 bg-page border border-line rounded-l-lg text-sm font-mono text-fg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="px-3 py-2 bg-fg/10 text-xs font-mono rounded-r-lg border-y border-r border-line text-muted">
                    .digistay.vn
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg mb-1">
                  Lý do bảo lưu
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Giữ chỗ cho phân hệ đối tác thanh toán"
                  value={newSubdomainReason}
                  onChange={(e) => setNewSubdomainReason(e.target.value)}
                  className="w-full px-3 py-2 bg-page border border-line rounded-lg text-sm text-fg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubdomainModal(false)}
                  className="px-4 py-2 border border-line rounded-lg text-sm font-medium hover:bg-fg/5 text-muted hover:text-fg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Thêm vào danh sách cấm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

