'use client'

import * as React from 'react'
import { Calendar, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GuestIdentityModal } from './guest-identity-modal'
import {
  Badge,
  Button,
  Input,
  Loading,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@/components/ui'
import { exportToCsv, exportToExcel } from '@/lib/export/export-data'
import { useDashLabels } from '@/lib/i18n/dash'

interface ResidentGuest {
  bookingId: string
  bookingCode: string
  guestName: string
  idType: string
  idNumber: string
  nationality: string
  birthDate: string | null
  gender: string | null
  address: string | null
  phone: string
  roomNumber: string
  roomTypeName: string
  checkInDate: string
  checkOutDate: string
  actualCheckIn: string | null
  status: string
  isPrimary: boolean
}

export function ResidenceExportModal({
  propertyId,
  isOpen,
  onClose,
}: {
  propertyId: string
  isOpen: boolean
  onClose: () => void
}) {
  const t = useTranslations('dash.bookings')
  const tc = useTranslations('dash.common')
  const labels = useDashLabels()

  const todayStr = React.useMemo(() => {
    return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
  }, [])

  const [selectedDate, setSelectedDate] = React.useState(todayStr)
  const [loading, setLoading] = React.useState(false)
  const [guests, setGuests] = React.useState<ResidentGuest[]>([])
  const [error, setError] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'missing' | 'ready'>('all')
  const [editingGuest, setEditingGuest] = React.useState<{
    bookingId: string
    bookingCode: string
    guestName: string
  } | null>(null)

  const loadData = React.useCallback(async (date: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/residence-report?date=${date}`)
      const json = await res.json()
      if (json.success) {
        setGuests(json.data || [])
      } else {
        setError(json.error || 'Không tải được danh sách lưu trú')
      }
    } catch {
      setError('Lỗi kết nối khi tải danh sách')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  React.useEffect(() => {
    if (isOpen) {
      loadData(selectedDate)
    }
  }, [isOpen, selectedDate, loadData])

  const formatGender = (gender: string | null) => {
    if (!gender) return '—'
    if (gender === 'MALE') return 'Nam'
    if (gender === 'FEMALE') return 'Nữ'
    return 'Khác'
  }

  const formatIdType = (type: string | null) => {
    if (type === 'PASSPORT') return 'Hộ chiếu'
    if (type === 'OTHER') return 'Khác'
    return 'CCCD'
  }

  const countMissingId = guests.filter((g) => !g.idNumber?.trim()).length
  const countHasId = guests.length - countMissingId

  const visibleGuests = React.useMemo(() => {
    if (filterStatus === 'missing') return guests.filter((g) => !g.idNumber?.trim())
    if (filterStatus === 'ready') return guests.filter((g) => !!g.idNumber?.trim())
    return guests
  }, [guests, filterStatus])

  const buildExportRows = () => {
    return guests.map((g, idx) => [
      idx + 1,
      g.guestName,
      formatIdType(g.idType),
      g.idNumber || '',
      g.nationality || 'Việt Nam',
      g.birthDate ? new Date(g.birthDate).toLocaleDateString('vi-VN') : '',
      formatGender(g.gender),
      g.address || '',
      g.phone || '',
      g.roomNumber || '',
      labels.date(g.checkInDate),
      labels.date(g.checkOutDate),
      g.bookingCode,
      g.isPrimary ? 'Khách chính' : 'Người ở cùng',
    ])
  }

  const exportHeaders = [
    'STT',
    'Họ và tên',
    'Loại giấy tờ',
    'Số CCCD/Hộ chiếu',
    'Quốc tịch',
    'Ngày sinh',
    'Giới tính',
    'Địa chỉ thường trú',
    'Số điện thoại',
    'Số phòng',
    'Ngày đến',
    'Ngày đi dự kiến',
    'Mã đặt phòng',
    'Ghi chú',
  ]

  const handleExportCsv = () => {
    if (guests.length === 0) {
      toast.warning('Không có khách lưu trú trong ngày được chọn')
      return
    }
    const rows = buildExportRows()
    exportToCsv(`khai-bao-luu-tru-${selectedDate}`, exportHeaders, rows)
    toast.success('Đã xuất file CSV khai báo lưu trú')
  }

  const handleExportExcel = () => {
    if (guests.length === 0) {
      toast.warning('Không có khách lưu trú trong ngày được chọn')
      return
    }
    const rows = buildExportRows()
    const summary = [
      { label: 'Ngày khai báo', value: selectedDate },
      { label: 'Tổng số khách lưu trú', value: guests.length },
      { label: 'Đã có CCCD/Hộ chiếu', value: countHasId },
      { label: 'Chưa có thông tin giấy tờ', value: countMissingId },
    ]
    exportToExcel(
      `khai-bao-luu-tru-${selectedDate}`,
      `DANH SÁCH KHÁCH LƯU TRÚ NGÀY ${selectedDate}`,
      exportHeaders,
      rows,
      summary
    )
    toast.success('Đã xuất file Excel khai báo lưu trú')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-acc" aria-hidden="true" />
          <span className="font-semibold">{t('list.exportResidence')}</span>
        </div>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-small text-muted">
          {t('list.exportResidenceDesc')}
        </p>

        {/* Date Filter & Status Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-line bg-raised p-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <label htmlFor="residence-date" className="text-small font-medium text-fg whitespace-nowrap">
              Ngày lưu trú:
            </label>
            <Input
              id="residence-date"
              type="date"
              className="w-auto h-9 text-small"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                filterStatus === 'all'
                  ? 'bg-ink text-on-ink border-transparent'
                  : 'bg-panel border-line text-muted hover:text-fg'
              }`}
            >
              Tổng: <strong className="ml-0.5">{guests.length}</strong>
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'ready' ? 'all' : 'ready')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border inline-flex items-center transition-colors ${
                filterStatus === 'ready'
                  ? 'bg-ok text-white border-transparent'
                  : 'bg-ok-soft/60 border-ok/30 text-ok hover:bg-ok-soft'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />
              Đủ giấy tờ: <strong className="ml-1">{countHasId}</strong>
            </button>
            {countMissingId > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'missing' ? 'all' : 'missing')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border inline-flex items-center transition-colors ${
                  filterStatus === 'missing'
                    ? 'bg-warn text-white border-transparent'
                    : 'bg-warn-soft/80 border-warn/40 text-warn hover:bg-warn-soft'
                }`}
              >
                <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                Thiếu CCCD: <strong className="ml-1">{countMissingId}</strong>
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-small text-err">{error}</p>}

        {/* Table Preview */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loading size="lg" />
          </div>
        ) : guests.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-line rounded-xl">
            <p className="text-muted text-small">
              Không có khách lưu trú nào trong ngày {labels.date(selectedDate)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[380px] rounded-xl border border-line">
            <Table>
              <TableHeader className="sticky top-0 bg-panel z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>CCCD / Hộ chiếu</TableHead>
                  <TableHead>Quốc tịch</TableHead>
                  <TableHead>Ngày sinh</TableHead>
                  <TableHead>Giới tính</TableHead>
                  <TableHead>Thời gian lưu trú</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleGuests.map((g, index) => {
                  const hasId = !!g.idNumber?.trim()
                  return (
                    <TableRow key={`${g.bookingId}-${index}`}>
                      <TableCell className="text-muted tabular-nums font-mono text-xs">{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-fg">{g.guestName}</div>
                        <div className="text-xs text-muted font-mono">{g.bookingCode}</div>
                      </TableCell>
                      <TableCell className="font-semibold text-fg">
                        {g.roomNumber}
                      </TableCell>
                      <TableCell>
                        {hasId ? (
                          <div className="font-mono text-small text-fg">
                            {g.idNumber}
                            <span className="ml-1.5 text-xs text-muted">({formatIdType(g.idType)})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-warn font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" aria-hidden="true" /> Chưa nhập
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-small">{g.nationality || 'Việt Nam'}</TableCell>
                      <TableCell className="text-small tabular-nums">
                        {g.birthDate ? new Date(g.birthDate).toLocaleDateString('vi-VN') : '—'}
                      </TableCell>
                      <TableCell className="text-small">{formatGender(g.gender)}</TableCell>
                      <TableCell className="text-small tabular-nums text-muted">
                        {labels.dayMonth(g.checkInDate)} → {labels.dayMonth(g.checkOutDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={hasId ? 'ghost' : 'outline'}
                          onClick={() =>
                            setEditingGuest({
                              bookingId: g.bookingId,
                              bookingCode: g.bookingCode,
                              guestName: g.guestName,
                            })
                          }
                          className={hasId ? 'h-7 px-2 text-xs' : 'h-7 px-2.5 text-xs border-warn/50 text-warn hover:bg-warn-soft'}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          {hasId ? 'Sửa' : 'Nhập ngay'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col sm:flex-row justify-between gap-2">
        <Button variant="ghost" onClick={onClose}>
          {tc('actions.cancel')}
        </Button>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            disabled={guests.length === 0 || loading}
            onClick={handleExportCsv}
            className="flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Xuất CSV
          </Button>
          <Button
            disabled={guests.length === 0 || loading}
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Xuất Excel (Khai báo)
          </Button>
        </div>
      </ModalFooter>

      <GuestIdentityModal
        bookingId={editingGuest?.bookingId ?? null}
        bookingCode={editingGuest?.bookingCode}
        guestName={editingGuest?.guestName}
        isOpen={Boolean(editingGuest)}
        onClose={() => setEditingGuest(null)}
        onSaved={() => void loadData(selectedDate)}
      />
    </Modal>
  )
}
