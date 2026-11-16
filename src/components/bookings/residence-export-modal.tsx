'use client'

import * as React from 'react'
import { Calendar, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-card border border-border/70 bg-muted/20 p-3">
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
            <Badge variant="plain">
              Tổng: <strong className="ml-1">{guests.length}</strong>
            </Badge>
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3 mr-1 inline" aria-hidden="true" />
              Đủ giấy tờ: <strong className="ml-1">{countHasId}</strong>
            </Badge>
            {countMissingId > 0 && (
              <Badge variant="warn">
                <AlertCircle className="w-3 h-3 mr-1 inline" aria-hidden="true" />
                Thiếu CCCD: <strong className="ml-1">{countMissingId}</strong>
              </Badge>
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
          <div className="text-center py-10 border border-dashed border-border rounded-card">
            <p className="text-muted text-small">
              Không có khách lưu trú nào trong ngày {labels.date(selectedDate)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[380px] rounded-card border border-border/80">
            <Table>
              <TableHeader className="sticky top-0 bg-bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>CCCD / Hộ chiếu</TableHead>
                  <TableHead>Quốc tịch</TableHead>
                  <TableHead>Ngày sinh</TableHead>
                  <TableHead>Giới tính</TableHead>
                  <TableHead>Thời gian lưu trú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((g, index) => {
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
    </Modal>
  )
}
