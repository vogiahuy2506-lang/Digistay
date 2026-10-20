'use client'

/**
 * The system page for the people running Digistay (SUPER_ADMIN): health,
 * current problems, scheduled jobs and email queues
 * (src/lib/ops/system-status.ts). Plain markup on purpose: it should not
 * depend on the shared UI components while they are being redesigned.
 */
import * as React from 'react'
import Link from 'next/link'

interface Problem {
  key: string
  severity: 'critical' | 'warning'
  title: string
  lines: string[]
}
interface JobRow {
  job: string
  last: { status: string; startedAt: string; durationMs: number | null; error: string | null } | null
  lastSuccessAt: string | null
  failures24h: number
}
interface Status {
  checkedAt: string
  health: { version: string; schema: string; redis: string }
  problems: Problem[]
  alerts: { key: string; severity: string; title: string; firstSeenAt: string; lastSentAt: string | null; resolvedAt: string | null }[]
  alertRecipients: string[]
  jobs: JobRow[]
  queues: { outbox: Record<string, number>; invoiceEmails: Record<string, number> }
  recentRuns: { id: string; job: string; status: string; startedAt: string; durationMs: number | null; error: string | null }[]
}

const JOB_LABELS: Record<string, string> = {
  'payos-reconcile': 'Đối soát PayOS',
  'einvoice-jobs': 'Hoá đơn điện tử',
  'email-outbox': 'Hàng đợi email',
  'ops-alerts': 'Cảnh báo vận hành',
  backup: 'Backup database',
}
const QUEUE_LABELS: Record<string, string> = {
  PENDING: 'Chờ gửi',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi',
  FAILED: 'Lỗi',
  SKIPPED: 'Bỏ qua',
}

const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso)) : '—'
const duration = (ms: number | null) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const tones = {
    ok: 'bg-green-50 text-green-700 border-green-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    bad: 'bg-red-50 text-red-700 border-red-200',
    muted: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

const statusTone = (s: string) => (s === 'SUCCESS' ? 'ok' : s === 'FAILURE' ? 'bad' : s === 'RUNNING' ? 'warn' : 'muted')

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export default function SystemPage() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading')

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system', { cache: 'no-store' })
      if (res.status === 404 || res.status === 401 || res.status === 403) return setState('forbidden')
      const data = await res.json()
      if (!data.success) return setState('error')
      setStatus(data.data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  React.useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  if (state === 'forbidden') {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Không tìm thấy trang</h1>
        <Link href="/workspaces" className="mt-4 inline-block text-sm text-primary underline">
          Về danh sách workspace
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hệ thống</h1>
          <p className="text-sm text-gray-500">
            {status ? `Kiểm lúc ${time(status.checkedAt)} · tự làm mới mỗi phút` : 'Đang tải…'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Làm mới
        </button>
      </header>

      {state === 'error' && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Không tải được tình trạng hệ thống.</p>}

      {status && (
        <>
          <Section title="Tình trạng">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-gray-500">Phiên bản</p>
                <p className="font-mono text-gray-900">{status.health.version.slice(0, 12)}</p>
              </div>
              <div>
                <p className="text-gray-500">Database (migration)</p>
                <Pill tone={status.health.schema === 'ok' ? 'ok' : status.health.schema === 'unknown' ? 'muted' : 'bad'}>
                  {status.health.schema === 'ok' ? 'Đủ' : status.health.schema === 'unknown' ? 'Không rõ' : `Thiếu ${status.health.schema.replace('missing ', '')}`}
                </Pill>
              </div>
              <div>
                <p className="text-gray-500">Redis</p>
                <Pill tone={status.health.redis === 'ok' ? 'ok' : 'warn'}>{status.health.redis === 'ok' ? 'Hoạt động' : 'Không kết nối'}</Pill>
              </div>
              <div>
                <p className="text-gray-500">Email cảnh báo gửi tới</p>
                <p className="text-gray-900">{status.alertRecipients.length ? status.alertRecipients.join(', ') : <span className="text-red-600">chưa có ai (đặt ALERT_EMAILS)</span>}</p>
              </div>
            </div>
          </Section>

          <Section title="Vấn đề hiện tại" aside={<Pill tone={status.problems.length ? 'bad' : 'ok'}>{status.problems.length || 'Không có'}</Pill>}>
            {status.problems.length === 0 ? (
              <p className="text-sm text-gray-500">Không có vấn đề nào theo các luật cảnh báo.</p>
            ) : (
              <ul className="space-y-3">
                {status.problems.map((p) => (
                  <li key={p.key} className={`rounded-lg border p-3 ${p.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className="text-sm font-semibold text-gray-900">
                      <Pill tone={p.severity === 'critical' ? 'bad' : 'warn'}>{p.severity === 'critical' ? 'Nghiêm trọng' : 'Cảnh báo'}</Pill> {p.title}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
                      {p.lines.map((line, i) => (
                        <li key={i} className="break-words">{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Job định kỳ">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Lần gần nhất</th>
                    <th className="py-2 pr-4">Kết quả</th>
                    <th className="py-2 pr-4">Thời gian chạy</th>
                    <th className="py-2 pr-4">Thành công gần nhất</th>
                    <th className="py-2 pr-4">Lỗi 24 giờ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {status.jobs.map((j) => (
                    <tr key={j.job}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{JOB_LABELS[j.job] ?? j.job}</td>
                      <td className="py-2 pr-4 tabular-nums">{time(j.last?.startedAt ?? null)}</td>
                      <td className="py-2 pr-4">
                        {j.last ? <Pill tone={statusTone(j.last.status)}>{j.last.status}</Pill> : <Pill tone="bad">Chưa chạy lần nào</Pill>}
                        {j.last?.error && <p className="mt-1 max-w-xs break-words text-xs text-red-600">{j.last.error}</p>}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{duration(j.last?.durationMs ?? null)}</td>
                      <td className="py-2 pr-4 tabular-nums">{time(j.lastSuccessAt)}</td>
                      <td className="py-2 pr-4 tabular-nums">{j.failures24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ['Email đặt phòng và lời mời', status.queues.outbox],
                ['Email hoá đơn', status.queues.invoiceEmails],
              ] as const
            ).map(([title, counts]) => (
              <Section key={title} title={title}>
                {Object.keys(counts).length === 0 ? (
                  <p className="text-sm text-gray-500">Chưa có email nào.</p>
                ) : (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {Object.entries(counts).map(([s, n]) => (
                      <div key={s}>
                        <p className="text-gray-500">{QUEUE_LABELS[s] ?? s}</p>
                        <p className={`text-lg font-semibold tabular-nums ${s === 'FAILED' ? 'text-red-600' : 'text-gray-900'}`}>{n}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            ))}
          </div>

          <Section title="Lần chạy gần đây">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {status.recentRuns.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-4 tabular-nums text-gray-600">{time(r.startedAt)}</td>
                      <td className="py-1.5 pr-4">{JOB_LABELS[r.job] ?? r.job}</td>
                      <td className="py-1.5 pr-4"><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
                      <td className="py-1.5 pr-4 tabular-nums">{duration(r.durationMs)}</td>
                      <td className="py-1.5 pr-4 break-words text-xs text-red-600">{r.error}</td>
                    </tr>
                  ))}
                  {status.recentRuns.length === 0 && (
                    <tr>
                      <td className="py-2 text-gray-500">Chưa có job nào chạy. Timer digistay-reconcile đã cài chưa?</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Cảnh báo đã gửi">
            {status.alerts.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có cảnh báo nào.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {status.alerts.map((a) => (
                  <li key={a.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <Pill tone={a.resolvedAt ? 'ok' : a.severity === 'critical' ? 'bad' : 'warn'}>{a.resolvedAt ? 'Đã hết' : 'Đang có'}</Pill>
                    <span className="min-w-0 flex-1 text-gray-900">{a.title}</span>
                    <span className="text-xs text-gray-500">
                      từ {time(a.firstSeenAt)} · gửi gần nhất {time(a.lastSentAt)}
                      {a.resolvedAt && ` · hết lúc ${time(a.resolvedAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
