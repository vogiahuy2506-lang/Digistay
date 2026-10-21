'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { Save, ShieldCheck, Clock, Baby, Dog, Cigarette, FileText } from 'lucide-react'

interface Policy {
  id: string
  propertyId: string
  checkInTime: string
  checkOutTime: string
  cancellationHours: number | null
  cancellationPolicy: string | null
  childrenAllowed: boolean
  minChildAge: number
  petsAllowed: boolean
  smokingAllowed: boolean
  additionalRules: string | null
  onlineDepositPercent: number
  /** read-only: the deposit needs a connected PayOS account */
  payosConnected?: boolean
}

export default function PoliciesPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [policy, setPolicy] = React.useState<Policy | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (propertyId) {
      fetchPolicy()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const fetchPolicy = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/properties/${propertyId}/policy`)
      const data = await res.json()
      if (data.success) {
        setPolicy(data.data)
      } else {
        toast.error(data.error || 'Không thể tải chính sách')
        setError(data.error || 'Không thể tải chính sách')
      }
    } catch (err) {
      console.error('Fetch policy error:', err)
      setError('Đã xảy ra lỗi khi tải chính sách')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!policy) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInTime: policy.checkInTime,
          checkOutTime: policy.checkOutTime,
          cancellationHours: policy.cancellationHours,
          cancellationPolicy: policy.cancellationPolicy,
          childrenAllowed: policy.childrenAllowed,
          minChildAge: policy.minChildAge,
          petsAllowed: policy.petsAllowed,
          smokingAllowed: policy.smokingAllowed,
          additionalRules: policy.additionalRules,
          onlineDepositPercent: policy.onlineDepositPercent,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Không thể lưu chính sách')
        return
      }
      toast.success('Đã lưu chính sách')
      setPolicy({ ...data.data, payosConnected: policy.payosConnected })
    } catch (err) {
      console.error('Save policy error:', err)
      toast.error('Đã xảy ra lỗi khi lưu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const update = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    setPolicy((p) => (p ? { ...p, [key]: value } : p))
  }

  if (!propertyId) {
    return (
      <PageContainer>
        <Header title="Chính sách" description="Chính sách check-in, hủy phòng và quy định" />
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">Không xác định được cơ sở.</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Chính sách"
        description="Giờ check-in/out, hủy phòng và các quy định của cơ sở"
        actions={
          <Button onClick={handleSave} isLoading={isSubmitting} disabled={!policy}>
            <Save className="w-4 h-4 mr-2" />
            Lưu thay đổi
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-err mb-4">{error}</p>
            <Button onClick={fetchPolicy}>Thử lại</Button>
          </CardContent>
        </Card>
      ) : policy ? (
        <div className="space-y-6">
          {/* Check-in / Check-out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Giờ check-in / check-out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Giờ check-in
                  </label>
                  <Input
                    type="time"
                    value={policy.checkInTime}
                    onChange={(e) => update('checkInTime', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">
                    Khách có thể nhận phòng từ giờ này
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Giờ check-out
                  </label>
                  <Input
                    type="time"
                    value={policy.checkOutTime}
                    onChange={(e) => update('checkOutTime', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">
                    Khách phải trả phòng trước giờ này
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancellation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Chính sách hủy phòng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Hủy miễn phí trước (giờ)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={policy.cancellationHours ?? ''}
                  onChange={(e) =>
                    update(
                      'cancellationHours',
                      e.target.value === '' ? null : parseInt(e.target.value)
                    )
                  }
                  placeholder="VD: 24 (hủy trước 24 giờ được miễn phí)"
                />
                <p className="text-xs text-muted mt-1">
                  Để trống nếu không có chính sách hủy miễn phí
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Mô tả chi tiết
                </label>
                <textarea
                  value={policy.cancellationPolicy ?? ''}
                  onChange={(e) => update('cancellationPolicy', e.target.value || null)}
                  placeholder="Mô tả chi tiết về chính sách hủy phòng, phí hủy, hoàn tiền..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-2 focus-visible:ring-acc focus-visible:border-acc focus-visible:border-acc"
                />
                <p className="text-xs text-muted mt-1">
                  Khách thấy chính sách này trước khi đặt phòng trên website.
                </p>
              </div>
              <div>
                <label htmlFor="online-deposit" className="block text-sm font-medium text-fg mb-1">
                  Đặt cọc khi khách đặt trên website (%)
                </label>
                <Input
                  id="online-deposit"
                  type="number"
                  min={0}
                  max={100}
                  value={policy.onlineDepositPercent}
                  onChange={(e) =>
                    update('onlineDepositPercent', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
                  }
                />
                <p className="text-xs text-muted mt-1">
                  0 = không thu cọc, khách trả tại quầy. Có cọc thì khách chuyển khoản qua PayOS ngay khi đặt,
                  tiền vào thẳng tài khoản khách sạn, và đặt phòng tự được xác nhận khi tiền về.
                </p>
                {policy.onlineDepositPercent > 0 && !policy.payosConnected && (
                  <p className="text-xs text-warn mt-1">
                    Chưa kết nối PayOS (Tài khoản ngân hàng → Thanh toán online): khách chưa phải đặt cọc cho tới khi kết nối.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Children, Pets, Smoking */}
          <Card>
            <CardHeader>
              <CardTitle>Quy định khác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Baby className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">Cho phép trẻ em</p>
                    <p className="text-sm text-muted">Có cho phép khách mang theo trẻ em?</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.childrenAllowed}
                    onChange={(e) => update('childrenAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>

              {policy.childrenAllowed && (
                <div className="ml-12">
                  <label className="block text-sm font-medium text-fg mb-1">
                    Tuổi trẻ em tối thiểu được tính giá người lớn
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={18}
                    value={policy.minChildAge}
                    onChange={(e) => update('minChildAge', parseInt(e.target.value) || 0)}
                    className="max-w-[120px]"
                  />
                </div>
              )}

              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Dog className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">Cho phép thú cưng</p>
                    <p className="text-sm text-muted">Có cho phép khách mang theo thú cưng?</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.petsAllowed}
                    onChange={(e) => update('petsAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>

              <div className="flex items-start justify-between p-4 bg-fg/[0.03] rounded-lg">
                <div className="flex items-start gap-3">
                  <Cigarette className="w-5 h-5 text-muted mt-0.5" />
                  <div>
                    <p className="font-medium">Cho phép hút thuốc</p>
                    <p className="text-sm text-muted">Có cho phép hút thuốc trong phòng?</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={policy.smokingAllowed}
                    onChange={(e) => update('smokingAllowed', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-fg/10 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-acc rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-ink after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-panel after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink" />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Additional rules */}
          <Card>
            <CardHeader>
              <CardTitle>Quy định bổ sung</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={policy.additionalRules ?? ''}
                onChange={(e) => update('additionalRules', e.target.value || null)}
                placeholder="Các quy định khác của cơ sở (giờ yên tĩnh, quy định về khách đến thăm, ...)..."
                rows={5}
                className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-2 focus-visible:ring-acc focus-visible:border-acc focus-visible:border-acc"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
