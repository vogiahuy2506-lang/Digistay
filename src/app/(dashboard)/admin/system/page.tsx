'use client'

import * as React from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  HelpCircle,
  Mail,
  Play,
  PlayCircle,
  Radio,
  Receipt,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react'
import { Button, toast } from '@/components/ui'
import { formatVnd } from '@/lib/bookings/display'

interface HardwareMetrics {
  disk: { totalGb: number; usedGb: number; freeGb: number; percent: number }
  memory: { totalMb: number; usedMb: number; freeMb: number; percent: number }
  cpu: { cores: number; model: string; loadAvg: number[] }
  uptimeSeconds: number
  nodeVersion: string
}

interface DatabaseMetrics {
  size: string
  activeConnections: number
}

interface JobRow {
  job: string
  last: { status: string; startedAt: string; durationMs: number | null; error: string | null; summary?: any } | null
  lastSuccessAt: string | null
  failures24h: number
}

interface Problem {
  key: string
  severity: 'critical' | 'warning'
  title: string
  lines: string[]
}

interface SystemData {
  checkedAt: string
  hardware?: HardwareMetrics
  database?: DatabaseMetrics
  health: { version: string; schema: string; redis: string }
  payos?: { configured: boolean; webhookUrl: string }
  problems: Problem[]
  alerts: { key: string; severity: string; title: string; firstSeenAt: string; lastSentAt: string | null; resolvedAt: string | null }[]
  jobs: JobRow[]
  queues: { outbox: Record<string, number>; invoiceEmails: Record<string, number> }
  planInvoices: any[]
}

const JOB_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  'payos-reconcile': {
    title: 'Đối soát Cổng PayOS',
    desc: 'Kiểm tra tiền về tài khoản ngân hàng và khớp đơn thanh toán gói',
  },
  'subscription-jobs': {
    title: 'Xử lý Chu kỳ Gói & Ân hạn',
    desc: 'Cảnh báo gia hạn, kích hoạt downgrade và khóa tài nguyên vượt hạn mức',
  },
  'einvoice-jobs': {
    title: 'Xuất HĐĐT Mắt Bão',
    desc: 'Phát hành và ký số hóa đơn GTGT điện tử khi khách mua gói',
  },
  'email-outbox': {
    title: 'Hàng đợi Email Outbox',
    desc: 'Gửi email xác nhận đặt phòng, OTP và thông báo hệ thống',
  },
  'ops-alerts': {
    title: 'Giám sát & Cảnh báo Devops',
    desc: 'Quét các sự cố bất thường về webhook, thanh toán và gửi cảnh báo',
  },
  'purge-deleted': {
    title: 'Dọn dẹp Dữ liệu Thùng rác',
    desc: 'Xóa vĩnh viễn dữ liệu soft-delete đã lưu quá 30 ngày',
  },
  backup: {
    title: 'Sao lưu Cơ sở Dữ liệu',
    desc: 'Sao lưu tự động PostgreSQL lên storage an toàn',
  },
  'abandoned-cart': {
    title: 'Nhắc Giỏ hàng Bỏ quên',
    desc: 'Gửi email tiếp thị lại cho khách thoát trang đặt phòng',
  },
  'post-stay-survey': {
    title: 'Khảo sát sau Lưu trú',
    desc: 'Gửi email đánh giá trải nghiệm cho khách đã trả phòng',
  },
}

export default function AdminSystemPage() {
  const [data, setData] = React.useState<SystemData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [triggeringJob, setTriggeringJob] = React.useState<string | null>(null)
  const [confirmingPayos, setConfirmingPayos] = React.useState(false)

  const loadData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setData(json.data)
      } else {
        setError(json?.error || 'Không tải được thông tin hệ thống')
      }
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30_000)
    return () => clearInterval(timer)
  }, [loadData])

  // Trigger internal cronjob
  const handleTriggerJob = async (jobName: string) => {
    setTriggeringJob(jobName)
    try {
      const res = await fetch('/api/admin/system/trigger-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobName }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Không thể kích hoạt tiến trình ${jobName}`)
        return
      }

      toast.success(`Đã kích hoạt thành công tiến trình: ${JOB_DESCRIPTIONS[jobName]?.title || jobName}`)
      await loadData()
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setTriggeringJob(null)
    }
  }

  // Confirm PayOS Webhook
  const handleConfirmPayosWebhook = async () => {
    setConfirmingPayos(true)
    try {
      const res = await fetch('/api/admin/system/confirm-webhook', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        toast.success(`Đã xác nhận webhook với PayOS thành công! (${json.data?.accountName || 'OK'})`)
      } else {
        toast.error(json?.error || 'Không xác nhận được webhook với PayOS')
      }
    } catch {
      toast.error('Lỗi kết nối khi xác nhận webhook')
    } finally {
      setConfirmingPayos(false)
    }
  }

  const formatUptime = (sec: number) => {
    const days = Math.floor(sec / 86400)
    const hours = Math.floor((sec % 86400) / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    if (days > 0) return `${days} ngày ${hours} giờ`
    if (hours > 0) return `${hours} giờ ${mins} phút`
    return `${mins} phút`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              Hạ tầng Kỹ thuật & Tiến trình Hệ thống
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
              Live Health 2.0
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Giám sát tài nguyên máy chủ VPS, trạng thái bộ nhớ Redis, cơ sở dữ liệu PostgreSQL và điều khiển thủ công các tiến trình định kỳ (Cronjobs).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadData()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới ngay
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-acc" />
          <p className="text-xs">Đang kiểm tra tình trạng máy chủ và hạ tầng...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 flex items-center justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadData()}>Thử lại</Button>
        </div>
      ) : data ? (
        <>
          {/* 2. Critical Problems & Devops Alerts */}
          {data.problems.length > 0 && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Cảnh báo sự cố đang diễn ra ({data.problems.length})</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.problems.map((prob) => (
                  <div key={prob.key} className="rounded-xl border border-rose-500/20 bg-panel p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-fg">{prob.title}</span>
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 uppercase">
                        {prob.severity}
                      </span>
                    </div>
                    {prob.lines.map((l, idx) => (
                      <p key={idx} className="text-muted leading-relaxed">{l}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Server Hardware & Infrastructure Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Disk Usage */}
            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold">Ổ đĩa VPS (Disk)</span>
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-fg">{data.hardware?.disk.percent ?? 0}%</span>
                  <span className="text-xs text-muted">
                    {data.hardware?.disk.usedGb} / {data.hardware?.disk.totalGb} GB
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-fg/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (data.hardware?.disk.percent ?? 0) > 85 ? 'bg-rose-500' : (data.hardware?.disk.percent ?? 0) > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, data.hardware?.disk.percent ?? 0)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted">Còn trống {data.hardware?.disk.freeGb ?? 0} GB lưu trữ</p>
            </div>

            {/* RAM Memory */}
            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold">Bộ nhớ RAM</span>
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-fg">{data.hardware?.memory.percent ?? 0}%</span>
                  <span className="text-xs text-muted">
                    {((data.hardware?.memory.usedMb ?? 0) / 1024).toFixed(1)} / {((data.hardware?.memory.totalMb ?? 0) / 1024).toFixed(1)} GB
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-fg/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (data.hardware?.memory.percent ?? 0) > 85 ? 'bg-rose-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${Math.min(100, data.hardware?.memory.percent ?? 0)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted">{data.hardware?.cpu.cores} Cores CPU • {data.hardware?.cpu.model.slice(0, 24)}</p>
            </div>

            {/* Database & Pool */}
            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold">PostgreSQL Database</span>
                <Database className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-fg">{data.database?.size ?? 'N/A'}</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đang kết nối
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60">
                <span>Migration Schema:</span>
                <strong className={data.health.schema === 'ok' ? 'text-emerald-600' : 'text-amber-500'}>
                  {data.health.schema.toUpperCase()}
                </strong>
              </div>
            </div>

            {/* Redis & App Uptime */}
            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-semibold">Redis Cache & Uptime</span>
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-fg">
                    {data.health.redis === 'ok' ? 'Khỏe mạnh' : 'Mất kết nối'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    data.health.redis === 'ok' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {data.health.redis}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60">
                <span>Thời gian Uptime:</span>
                <strong className="text-fg">{formatUptime(data.hardware?.uptimeSeconds ?? 0)}</strong>
              </div>
            </div>
          </div>

          {/* 4. PayOS Platform Webhook Config */}
          <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-acc" />
                <h3 className="text-sm font-bold text-fg">Cổng thanh toán mua gói PayOS Nền tảng</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  data.payos?.configured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {data.payos?.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}
                </span>
              </div>
              <p className="text-xs text-muted">
                Webhook tiếp nhận tiền nạp tự động: <code className="bg-fg/5 px-2 py-0.5 rounded font-mono text-[11px] text-fg">{data.payos?.webhookUrl || 'Chưa thiết lập'}</code>
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleConfirmPayosWebhook}
              disabled={confirmingPayos || !data.payos?.configured}
              className="gap-1.5 text-xs whitespace-nowrap"
            >
              {confirmingPayos ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
              Xác nhận Webhook với PayOS
            </Button>
          </div>

          {/* 5. Scheduled Jobs (Cronjobs) Interactive Control Panel */}
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-fg">Trung tâm Điều khiển Tiến trình Tự động (Cronjobs)</h2>
                <p className="text-xs text-muted">Bấm &quot;Chạy ngay&quot; để kích hoạt thủ công bất kỳ tác vụ nào khi cần kiểm tra hoặc bảo trì.</p>
              </div>
            </div>

            <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
              {data.jobs.map((job) => {
                const meta = JOB_DESCRIPTIONS[job.job] || { title: job.job, desc: 'Tiến trình hệ thống' }
                const isRunning = triggeringJob === job.job
                const lastStatus = job.last?.status

                return (
                  <div key={job.job} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-page hover:bg-fg/[0.01] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-fg">{meta.title}</span>
                        <code className="text-[11px] text-muted font-mono bg-fg/5 px-1.5 py-0.5 rounded">{job.job}</code>
                        {job.failures24h > 0 && (
                          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            {job.failures24h} lỗi / 24h
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted">{meta.desc}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Last Run Info */}
                      <div className="text-right text-[11px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                            lastStatus === 'SUCCESS' ? 'bg-emerald-500' : lastStatus === 'FAILURE' ? 'bg-rose-500' : 'bg-muted'
                          }`} />
                          <span className="font-medium text-fg">{lastStatus || 'Chưa chạy'}</span>
                          {job.last?.durationMs != null && (
                            <span className="text-muted">({job.last.durationMs}ms)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted">
                          {job.lastSuccessAt ? `Thành công: ${new Date(job.lastSuccessAt).toLocaleTimeString('vi-VN')}` : '—'}
                        </p>
                      </div>

                      {/* Run Now Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerJob(job.job)}
                        disabled={isRunning}
                        className="gap-1.5 text-xs border-acc/30 hover:bg-acc/10 text-acc"
                      >
                        {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                        Chạy ngay
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 6. Email Queue Status */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-acc" />
                <h3 className="text-sm font-bold text-fg">Hàng đợi Email Outbox</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Chờ gửi</p>
                  <p className="mt-1 font-bold text-amber-500">{data.queues.outbox.PENDING ?? 0}</p>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Đang gửi</p>
                  <p className="mt-1 font-bold text-sky-500">{data.queues.outbox.SENDING ?? 0}</p>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Đã gửi</p>
                  <p className="mt-1 font-bold text-emerald-500">{data.queues.outbox.SENT ?? 0}</p>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Thất bại</p>
                  <p className="mt-1 font-bold text-rose-500">{data.queues.outbox.FAILED ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-acc" />
                <h3 className="text-sm font-bold text-fg">Hàng đợi Gửi Hóa đơn GTGT</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Chờ gửi</p>
                  <p className="mt-1 font-bold text-amber-500">{data.queues.invoiceEmails.PENDING ?? 0}</p>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Đã gửi</p>
                  <p className="mt-1 font-bold text-emerald-500">{data.queues.invoiceEmails.SENT ?? 0}</p>
                </div>
                <div className="rounded-xl border border-line p-2.5">
                  <p className="text-[10px] text-muted">Lỗi gửi</p>
                  <p className="mt-1 font-bold text-rose-500">{data.queues.invoiceEmails.FAILED ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
