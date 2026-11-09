'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Header, PageContainer } from '@/components/layout'
import { useCan } from '@/components/layout/workspace-context'
import { Badge, Button, ExportDropdown, Input, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { exportToCsv, exportToExcel } from '@/lib/export/export-data'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import {
  Users,
  Download,
  Search,
  Sparkles,
  Mail,
  Phone,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Gift,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'

interface Lead {
  id: string
  propertyId: string
  email: string
  phone: string | null
  name: string | null
  source: 'EXIT_POPUP' | 'CONTACT_FORM' | 'OTHER'
  notes: string | null
  metadata: {
    couponCode?: string
    page?: string
    [key: string]: unknown
  } | null
  createdAt: string
}

interface Summary {
  total: number
  exitPopupCount: number
  contactFormCount: number
}

interface EditForm {
  name: string
  phone: string
  notes: string
}

export default function LeadsPage() {
  const t = useTranslations('dash.leads')
  const tc = useTranslations('dash.common')
  const { id: propertyId } = useParams<{ slug: string; id: string }>()
  const canEdit = useCan('property_edit')

  const [leads, setLeads] = React.useState<Lead[] | null>(null)
  const [summary, setSummary] = React.useState<Summary>({ total: 0, exitPopupCount: 0, contactFormCount: 0 })
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [source, setSource] = React.useState<'all' | 'EXIT_POPUP' | 'CONTACT_FORM' | 'OTHER'>('all')
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 })

  // Edit / Note modal
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null)
  const [editForm, setEditForm] = React.useState<EditForm>({ name: '', phone: '', notes: '' })
  const [saving, setSaving] = React.useState(false)

  // Delete confirm modal
  const [deletingLead, setDeletingLead] = React.useState<Lead | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = React.useCallback(async () => {
    if (!propertyId) return
    try {
      setLoadFailed(false)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (source !== 'all') params.set('source', source)

      const res = await fetch(`/api/properties/${propertyId}/leads?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setLeads(data.data)
        if (data.pagination) setPagination(data.pagination)
        if (data.summary) setSummary(data.summary)
      } else {
        setLoadFailed(true)
        toast.error(apiError(data.error) ?? t('loadFailed'))
      }
    } catch {
      setLoadFailed(true)
      toast.error(t('loadFailed'))
    }
  }, [propertyId, page, debouncedQuery, source, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const sourceLabels: Record<string, string> = {
    EXIT_POPUP: 'Popup giữ chân',
    CONTACT_FORM: 'Form liên hệ',
    OTHER: 'Khác',
  }

  const fetchAllLeadsForExport = async (): Promise<Lead[]> => {
    if (!propertyId) return []
    try {
      const params = new URLSearchParams()
      params.set('export', 'json')
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (source !== 'all') params.set('source', source)

      const url = `/api/properties/${propertyId}/leads?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.data)) {
        return data.data
      }
    } catch (e) {
      console.error(e)
    }
    return leads ?? []
  }

  const handleExportCsv = async () => {
    if (!propertyId) return
    const rows = await fetchAllLeadsForExport()
    if (!rows.length) return
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const headers = ['Thời gian', 'Email', 'Họ tên', 'Số điện thoại', 'Nguồn', 'Mã ưu đãi', 'Trang chuyển hướng', 'Ghi chú']
    const data = rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown> | null) ?? {}
      const couponCode = meta.couponCode ? String(meta.couponCode) : ''
      const page = meta.page ? String(meta.page) : ''
      const d = new Date(r.createdAt)
      const dateStr = Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN')
      return [
        dateStr,
        r.email,
        r.name ?? '—',
        r.phone ?? '—',
        sourceLabels[r.source] ?? r.source,
        couponCode || '—',
        page || '—',
        r.notes ?? '',
      ]
    })
    exportToCsv(`leads-${propertyId}-${today}.csv`, headers, data)
  }

  const handleExportExcel = async () => {
    if (!propertyId) return
    const rows = await fetchAllLeadsForExport()
    if (!rows.length) return
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const headers = ['Thời gian', 'Email', 'Họ tên', 'Số điện thoại', 'Nguồn', 'Mã ưu đãi', 'Trang chuyển hướng', 'Ghi chú']
    const data = rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown> | null) ?? {}
      const couponCode = meta.couponCode ? String(meta.couponCode) : ''
      const page = meta.page ? String(meta.page) : ''
      const d = new Date(r.createdAt)
      const dateStr = Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN')
      return [
        dateStr,
        r.email,
        r.name ?? '—',
        r.phone ?? '—',
        sourceLabels[r.source] ?? r.source,
        couponCode || '—',
        page || '—',
        r.notes ?? '',
      ]
    })
    exportToExcel(
      `leads-${propertyId}-${today}.xls`,
      'DANH SÁCH KHÁCH HÀNG TIỀM NĂNG (LEADS)',
      headers,
      data,
      [
        { label: 'Tổng số leads', value: rows.length },
        { label: 'Từ Popup giữ chân', value: rows.filter((r) => r.source === 'EXIT_POPUP').length },
        { label: 'Từ Form liên hệ', value: rows.filter((r) => r.source === 'CONTACT_FORM').length },
        { label: 'Ngày xuất file', value: new Date().toLocaleDateString('vi-VN') },
      ]
    )
  }

  const openEdit = (lead: Lead) => {
    setEditingLead(lead)
    setEditForm({
      name: lead.name ?? '',
      phone: lead.phone ?? '',
      notes: lead.notes ?? '',
    })
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propertyId || !editingLead || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/leads/${editingLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim() || null,
          phone: editForm.phone.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success(t('modal.saved'))
        setEditingLead(null)
        await load()
      } else {
        toast.error(apiError(data.error) ?? t('modal.saveFailed'))
      }
    } catch {
      toast.error(t('modal.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!propertyId || !deletingLead || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/leads/${deletingLead.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success(t('deleted'))
        setDeletingLead(null)
        await load()
      } else {
        toast.error(apiError(data.error) ?? t('deleteFailed'))
      }
    } catch {
      toast.error(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!propertyId) {
    return (
      <PageContainer>
        <div className="py-16 text-center">
          <p className="text-muted">{t('noProperty')}</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Header
          title={t('title')}
          description={t('description')}
          actions={
            leads && leads.length > 0 ? (
              <ExportDropdown
                onExportExcel={handleExportExcel}
                onExportCsv={handleExportCsv}
              />
            ) : undefined
          }
        />

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-line bg-panel flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-acc-soft text-acc flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t('stats.total')}</p>
              <p className="text-2xl font-bold text-fg mt-0.5">{summary.total}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-line bg-panel flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t('stats.exitPopup')}</p>
              <p className="text-2xl font-bold text-fg mt-0.5">{summary.exitPopupCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-line bg-panel flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{t('stats.contactForm')}</p>
              <p className="text-2xl font-bold text-fg mt-0.5">{summary.contactFormCount}</p>
            </div>
          </div>
        </div>

        {/* Content Box */}
        <section className="rounded-2xl border border-line bg-panel p-4 sm:p-6 shadow-xs">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
              <input
                type="search"
                aria-label={t('search')}
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-base sm:text-sm bg-panel text-fg border border-line rounded-lg focus:outline-none focus:border-muted w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('columns.source')}>
              {(['all', 'EXIT_POPUP', 'CONTACT_FORM', 'OTHER'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={source === s}
                  onClick={() => {
                    setSource(s)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    source === s ? 'bg-acc text-on-acc' : 'bg-fg/5 text-muted hover:bg-fg/10'
                  }`}
                >
                  {s === 'all' ? t('all') : t(`sources.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {leads === null ? (
            loadFailed ? (
              <div className="px-6 py-12 text-center">
                <p className="text-body text-fg mb-4">{t('loadError')}</p>
                <Button variant="secondary" onClick={load}>
                  {tc('actions.retry')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-fg/5 animate-pulse" />
                ))}
              </div>
            )
          ) : leads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
              <FileSpreadsheet className="w-8 h-8 text-muted mx-auto mb-4" aria-hidden="true" />
              <p className="text-body font-medium text-fg">{t('empty')}</p>
              <p className="mx-auto mt-2 max-w-xl text-small text-muted">{t('emptyHint')}</p>
            </div>
          ) : (
            <>
              {/* Desktop & Mobile Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-3">{t('columns.contact')}</th>
                      <th className="py-3 px-3">{t('columns.source')}</th>
                      <th className="py-3 px-3">{t('columns.offer')}</th>
                      <th className="py-3 px-3">{t('columns.notes')}</th>
                      <th className="py-3 px-3">{t('columns.createdAt')}</th>
                      <th className="py-3 px-3 text-right">{t('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {leads.map((lead) => {
                      const meta = lead.metadata ?? {}
                      const couponCode = meta.couponCode ? String(meta.couponCode) : null
                      const pageRef = meta.page ? String(meta.page) : null

                      return (
                        <tr key={lead.id} className="hover:bg-fg/[0.02] transition-colors">
                          {/* Contact Info */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-fg">{lead.email}</span>
                              {(lead.name || lead.phone) && (
                                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                                  {lead.name && <span>{lead.name}</span>}
                                  {lead.name && lead.phone && <span>·</span>}
                                  {lead.phone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {lead.phone}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Source */}
                          <td className="py-3 px-3">
                            {lead.source === 'EXIT_POPUP' ? (
                              <Badge variant="success">
                                <Sparkles className="w-3 h-3 mr-1 inline" />
                                {t('sources.EXIT_POPUP')}
                              </Badge>
                            ) : lead.source === 'CONTACT_FORM' ? (
                              <Badge variant="info">
                                <Mail className="w-3 h-3 mr-1 inline" />
                                {t('sources.CONTACT_FORM')}
                              </Badge>
                            ) : (
                              <Badge variant="gray">{t('sources.OTHER')}</Badge>
                            )}
                          </td>

                          {/* Offer / Referrer */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-0.5">
                              {couponCode ? (
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-acc bg-acc-soft/50 px-2 py-0.5 rounded-md w-fit">
                                  <Gift className="w-3 h-3" />
                                  {couponCode}
                                </span>
                              ) : (
                                <span className="text-muted text-xs">—</span>
                              )}
                              {pageRef && (
                                <span className="text-[11px] text-muted truncate max-w-[180px]" title={pageRef}>
                                  {pageRef.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-3">
                            {lead.notes ? (
                              <p className="text-xs text-fg/90 line-clamp-2 max-w-[200px]" title={lead.notes}>
                                {lead.notes}
                              </p>
                            ) : (
                              <span className="text-xs text-muted/60">{t('noNotes')}</span>
                            )}
                          </td>

                          {/* CreatedAt */}
                          <td className="py-3 px-3 text-xs text-muted whitespace-nowrap">
                            {formatDateTime(lead.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(lead)}
                                aria-label={t('modal.title')}
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted hover:text-fg" />
                              </Button>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeletingLead(lead)}
                                  aria-label={tc('actions.delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-err hover:opacity-80" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-line pt-4 mt-4">
                  <p className="text-small text-muted">
                    {t('pagination.page', {
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                      total: pagination.total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t('pagination.prev')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t('pagination.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Edit / Detail Modal */}
        {editingLead && (
          <Modal isOpen={true} onClose={() => setEditingLead(null)}>
            <form onSubmit={saveEdit}>
              <ModalBody>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-fg">{t('modal.title')}</h3>
                    <p className="text-xs text-muted mt-0.5">{t('modal.subtitle')}</p>
                  </div>

                  {/* Readonly Lead Meta Card */}
                  <div className="p-3.5 rounded-xl bg-fg/[0.03] border border-line text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted">{t('modal.email')}:</span>
                      <span className="font-semibold text-fg">{editingLead.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('modal.source')}:</span>
                      <span className="font-medium text-fg">{t(`sources.${editingLead.source}`)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('modal.createdAt')}:</span>
                      <span className="text-fg">{formatDateTime(editingLead.createdAt)}</span>
                    </div>
                    {editingLead.metadata?.couponCode && (
                      <div className="flex justify-between">
                        <span className="text-muted">{t('modal.coupon')}:</span>
                        <span className="font-mono font-bold text-acc">{String(editingLead.metadata.couponCode)}</span>
                      </div>
                    )}
                    {editingLead.metadata?.page && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted">{t('modal.page')}:</span>
                        <span className="text-fg truncate max-w-[200px]" title={String(editingLead.metadata.page)}>
                          {String(editingLead.metadata.page)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Editable contact fields */}
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">{t('modal.name')}</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder={t('modal.namePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">{t('modal.phone')}</label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder={t('modal.phonePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">{t('modal.notes')}</label>
                    <textarea
                      rows={3}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder={t('modal.notesPlaceholder')}
                      className="w-full px-3 py-2 text-sm bg-panel text-fg border border-line rounded-lg focus:outline-none focus:border-muted"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button type="button" variant="secondary" onClick={() => setEditingLead(null)}>
                  {tc('actions.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? t('modal.saving') : t('modal.save')}
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        {deletingLead && (
          <Modal isOpen={true} onClose={() => setDeletingLead(null)}>
            <ModalBody>
              <div className="py-2">
                <div className="w-10 h-10 rounded-full bg-err-soft text-err flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-fg">
                  {t('deleteConfirm', { email: deletingLead.email })}
                </h3>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setDeletingLead(null)}>
                {tc('actions.cancel')}
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? tc('actions.deleting') : tc('actions.delete')}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </PageContainer>
  )
}
