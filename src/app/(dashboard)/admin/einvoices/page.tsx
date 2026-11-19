'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Search,
  Send,
  Building,
  User,
  ShoppingBag,
} from 'lucide-react'
import {
  Badge,
  Button,
  Input,
  Loading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from '@/components/ui'
import { Header, PageContainer } from '@/components/layout'
import { formatVnd } from '@/lib/bookings/display'
import { cn } from '@/lib/utils'

interface EinvoiceRow {
  id: string
  lookupCode: string
  einvoiceNumber: string | null
  invoiceCode: string | null
  series: string | null
  templateCode: string | null
  status: 'PENDING' | 'ISSUING' | 'ISSUED' | 'FAILED'
  buyerType: 'none' | 'personal' | 'company'
  buyerName: string | null
  idNumber: string | null
  companyName: string | null
  taxCode: string | null
  address: string | null
  email: string | null
  amount: number
  vatCode: number
  attempts: number
  error: string | null
  cqtStatus: number | null
  cqtNote: string | null
  emailStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | null
  emailAttempts: number
  emailError: string | null
  emailedAt: string | null
  issuedAt: string | null
  createdAt: string
  workspace: { id: string; name: string; slug: string }
  payment: {
    id: string
    orderCode: string
    plan: string
    billing: string
    amount: number
    status: string
    paidAt: string | null
    createdAt: string
  }
}

interface ListResponse {
  einvoices: EinvoiceRow[]
  total: number
  page: number
  limit: number
  totalPages: number
  counts: Record<string, number>
}

export default function AdminEinvoicesPage() {
  const t = useTranslations('dash.admin.einvoices')
  const [tab, setTab] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [data, setData] = React.useState<ListResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionId, setActionId] = React.useState<string | null>(null)

  const statusTabs = [
    { id: 'all', label: t('tabAll') },
    { id: 'issued', label: t('tabIssued') },
    { id: 'pending', label: t('tabPending') },
    { id: 'failed', label: t('tabFailed') },
  ] as const

  const fetchEinvoices = React.useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({
        status: tab,
        page: String(page),
        limit: '20',
      })
      if (search.trim()) q.set('q', search.trim())
      if (dateFrom) q.set('dateFrom', dateFrom)
      if (dateTo) q.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/einvoices?${q}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        toast.error(json.error || t('loadError'))
      }
    } catch {
      toast.error(t('networkError'))
    } finally {
      setLoading(false)
    }
  }, [tab, page, search, dateFrom, dateTo, t])

  React.useEffect(() => {
    fetchEinvoices()
  }, [fetchEinvoices])

  const handleRetry = async (invoice: EinvoiceRow) => {
    setActionId(invoice.id)
    try {
      const res = await fetch(`/api/admin/plan-invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(t('retrySuccess', { code: invoice.lookupCode }))
        fetchEinvoices()
      } else {
        toast.error(json.error || t('retryError'))
      }
    } catch {
      toast.error(t('networkError'))
    } finally {
      setActionId(null)
    }
  }

  const handleResendEmail = async (invoice: EinvoiceRow) => {
    setActionId(invoice.id)
    try {
      const res = await fetch(`/api/admin/plan-invoices/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(t('resendSuccess', { email: invoice.email || '' }))
        fetchEinvoices()
      } else {
        toast.error(json.error || t('resendError'))
      }
    } catch {
      toast.error(t('networkError'))
    } finally {
      setActionId(null)
    }
  }

  const handleDownloadPdf = (invoice: EinvoiceRow) => {
    window.open(`/api/admin/plan-invoices/${invoice.id}/pdf`, '_blank')
  }

  const formatBuyerSummary = (inv: EinvoiceRow) => {
    if (inv.buyerType === 'company') {
      return (
        <div>
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <Building className="w-3.5 h-3.5 text-acc shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[220px]" title={inv.companyName || ''}>
              {inv.companyName || t('buyerCompany')}
            </span>
          </div>
          <div className="text-xs text-muted font-mono">MST: {inv.taxCode || '—'}</div>
        </div>
      )
    }
    if (inv.buyerType === 'personal') {
      return (
        <div>
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <User className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[220px]" title={inv.buyerName || ''}>
              {inv.buyerName || t('buyerPersonal')}
            </span>
          </div>
          <div className="text-xs text-muted font-mono">CCCD: {inv.idNumber || '—'}</div>
        </div>
      )
    }
    return (
      <span className="text-xs text-muted italic">
        {t('buyerAnonymous')}
      </span>
    )
  }

  const renderStatusBadge = (status: EinvoiceRow['status']) => {
    switch (status) {
      case 'ISSUED':
        return <Badge variant="success">{t('statusIssued')}</Badge>
      case 'PENDING':
        return <Badge variant="warn">{t('statusPending')}</Badge>
      case 'ISSUING':
        return <Badge variant="plain">{t('statusIssuing')}</Badge>
      case 'FAILED':
        return <Badge variant="err">{t('statusFailed')}</Badge>
      default:
        return <Badge variant="plain">{status}</Badge>
    }
  }

  const renderEmailBadge = (status: EinvoiceRow['emailStatus']) => {
    if (!status) return <span className="text-xs text-muted">—</span>
    switch (status) {
      case 'SENT':
        return <Badge variant="success" className="text-[11px]">{t('emailSent')}</Badge>
      case 'PENDING':
      case 'SENDING':
        return <Badge variant="warn" className="text-[11px]">{t('emailPending')}</Badge>
      case 'FAILED':
        return <Badge variant="err" className="text-[11px]">{t('emailFailed')}</Badge>
      case 'SKIPPED':
        return <Badge variant="plain" className="text-[11px]">{t('emailSkipped')}</Badge>
      default:
        return <span className="text-xs text-muted">{status}</span>
    }
  }

  return (
    <PageContainer className="max-w-[1600px] space-y-6">
      <Header
        eyebrow={t('subtitle')}
        title={t('title')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEinvoices()}
              isLoading={loading}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('tabAll')}
            </Button>
          </div>
        }
      />

      {/* Tabs Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={(val) => { setTab(val); setPage(1); }}>
          <TabsList variant="underline">
            {statusTabs.map((st) => (
              <TabsTrigger key={st.id} value={st.id}>
                {st.label}
                {data?.counts && st.id in data.counts && (
                  <span className="ml-1.5 text-xs text-muted tabular-nums">
                    {data.counts[st.id]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search & Dates */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              className="pl-9 h-9 w-[240px] sm:w-[280px] text-small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchEinvoices(); }}
            />
          </div>
          <Input
            type="date"
            className="h-9 w-auto text-small"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            title={t('filterDateFrom')}
          />
          <span className="text-muted text-xs">→</span>
          <Input
            type="date"
            className="h-9 w-auto text-small"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            title={t('filterDateTo')}
          />
        </div>
      </div>

      {/* Main Table */}
      {loading && !data ? (
        <div className="py-20 flex justify-center">
          <Loading size="lg" />
        </div>
      ) : !data || data.einvoices.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-card bg-bg-card/40">
          <FileSpreadsheet className="w-10 h-10 text-muted mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-body font-semibold text-fg">{t('empty')}</h3>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-border/80 bg-bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInvoice')}</TableHead>
                  <TableHead>{t('colBuyer')}</TableHead>
                  <TableHead>{t('colAmount')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colCqt')}</TableHead>
                  <TableHead>{t('colEmail')}</TableHead>
                  <TableHead>{t('colCreated')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.einvoices.map((inv) => {
                  const isBusy = actionId === inv.id
                  return (
                    <TableRow key={inv.id}>
                      {/* Lookup & Invoice Number */}
                      <TableCell>
                        <div className="font-mono font-semibold text-fg text-small">
                          {inv.einvoiceNumber ? (
                            <span>Số: {inv.einvoiceNumber}</span>
                          ) : (
                            <span className="text-muted italic">Chưa cấp số</span>
                          )}
                        </div>
                        <div className="text-xs text-muted font-mono flex items-center gap-1.5 mt-0.5">
                          <span>Mã: {inv.lookupCode}</span>
                          {inv.series && (
                            <span className="px-1 py-0.5 rounded bg-muted/30 text-[10px]">
                              {inv.series}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Order & Plan */}
                      <TableCell>
                        <div className="font-medium text-fg flex items-center gap-1">
                          <ShoppingBag className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                          <span>Gói {inv.payment?.plan || '—'}</span>
                        </div>
                        <div className="text-xs text-muted font-mono">
                          Đơn: #{inv.payment?.orderCode || '—'} ({inv.payment?.billing === 'YEAR' ? '12 tháng' : '1 tháng'})
                        </div>
                      </TableCell>

                      {/* Buyer Info */}
                      <TableCell>
                        {formatBuyerSummary(inv)}
                        <div className="text-xs text-muted mt-0.5">
                          Workspace: <strong>{inv.workspace?.name}</strong>
                          {inv.email && <span className="ml-1 text-muted">· {inv.email}</span>}
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell>
                        <div className="font-semibold tabular-nums text-fg">
                          {formatVnd(inv.amount)}
                        </div>
                        <div className="text-xs text-muted">
                          KCT (Không chịu thuế)
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="space-y-1">
                          {renderStatusBadge(inv.status)}
                          {inv.error && (
                            <p className="text-[11px] text-err line-clamp-1 max-w-[180px]" title={inv.error}>
                              {inv.error}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Email Status */}
                      <TableCell>
                        <div className="space-y-1">
                          {renderEmailBadge(inv.emailStatus)}
                          {inv.email && inv.emailStatus === 'SENT' && inv.emailedAt && (
                            <p className="text-[10px] text-muted tabular-nums">
                              {new Date(inv.emailedAt).toLocaleDateString('vi-VN')}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-small tabular-nums text-muted whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Retry button for FAILED or stuck PENDING */}
                          {(inv.status === 'FAILED' || inv.status === 'PENDING') && (
                            <Button
                              variant="outline"
                              size="sm"
                              isLoading={isBusy}
                              onClick={() => handleRetry(inv)}
                              title={t('retry')}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              {t('retry')}
                            </Button>
                          )}

                          {/* Resend Email for ISSUED */}
                          {inv.status === 'ISSUED' && inv.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={isBusy}
                              onClick={() => handleResendEmail(inv)}
                              title={t('resendEmail')}
                            >
                              <Mail className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              {t('resendEmail')}
                            </Button>
                          )}

                          {/* Download PDF for ISSUED */}
                          {inv.status === 'ISSUED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPdf(inv)}
                              title={t('downloadPdf')}
                            >
                              <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              PDF
                            </Button>
                          )}

                          {/* External Lookup Link */}
                          <a
                            href={`https://portal.matbao.in`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-ctl text-muted hover:text-fg hover:bg-fg/5 transition-colors"
                            title="Portal Mat Bao"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-small text-muted py-2">
              <div>
                {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} / {data.total}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr;
                </Button>
                <span className="px-3 text-xs font-mono">
                  {data.page} / {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
