'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input } from '@/components/ui'
import { VietQR, downloadQR } from '@/components/ui/viet-qr'
import { buildVietQr } from '@/lib/vietqr'
import { toast } from '@/components/ui/toast'
import {
  Building, Plus, Trash2, Edit, QrCode, Copy,
  AlertCircle, Download
} from 'lucide-react'

interface BankAccount {
  id: string
  propertyId: string
  bankName: string
  bankCode: string
  accountNumber: string
  accountHolder: string
  qrEnabled: boolean
  isActive: boolean
}

const bankList = [
  { code: 'MB', name: 'Ngân hàng Quân đội (MB Bank)' },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'VTB', name: 'VietinBank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'CTG', name: 'VietinBank' },
]

export default function BankAccountsPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id

  const [accounts, setAccounts] = React.useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showModal, setShowModal] = React.useState(false)
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null)

  const [formData, setFormData] = React.useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
    qrEnabled: true,
  })

  React.useEffect(() => {
    if (propertyId) {
      fetchAccounts()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/bank-accounts?propertyId=${propertyId}`)
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data)
      } else {
        toast.error(data.error || 'Không thể tải danh sách tài khoản')
        setAccounts([])
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
      toast.error('Đã xảy ra lỗi khi tải danh sách tài khoản')
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!propertyId) {
      toast.error('Không xác định được cơ sở')
      return
    }
    if (!formData.bankCode || !formData.accountNumber || !formData.accountHolder) {
      toast.error('Vui lòng điền đầy đủ thông tin')
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingAccount
        ? `/api/bank-accounts/${editingAccount.id}`
        : '/api/bank-accounts'
      const method = editingAccount ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          ...formData,
        }),
      })
      const data = await response.json()

      if (!data.success) {
        toast.error(data.error || 'Không thể lưu tài khoản')
        return
      }

      toast.success(editingAccount ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản')
      setShowModal(false)
      resetForm()
      await fetchAccounts()
    } catch (err) {
      console.error('Failed to save account:', err)
      toast.error('Đã xảy ra lỗi khi lưu tài khoản')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return
    try {
      const response = await fetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(data.error || 'Không thể xóa tài khoản')
        return
      }
      toast.success('Đã xóa tài khoản')
      setAccounts(accounts.filter(a => a.id !== id))
    } catch (err) {
      console.error('Failed to delete account:', err)
      toast.error('Đã xảy ra lỗi khi xóa tài khoản')
    }
  }

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account)
    setFormData({
      bankName: account.bankName,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      qrEnabled: account.qrEnabled,
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingAccount(null)
    setFormData({
      bankName: '',
      bankCode: '',
      accountNumber: '',
      accountHolder: '',
      qrEnabled: true,
    })
  }

  const copyToClipboard = async (text: string, label = 'Đã copy') => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(label)
    } catch {
      toast.error('Không thể copy, vui lòng thử lại')
    }
  }

  const formatAccountNumber = (num: string) => {
    return num.replace(/(.{4})/g, '$1 ').trim()
  }

  // Build a real VietQR string using the canonical EMVCo implementation
  // (CRC-16/CCITT, full TLV tags) so that bank apps can parse it.
  const buildVietQRPreview = (account: BankAccount) => {
    return buildVietQr({
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      amount: 0,
      addInfo: `DIGISTAY-${account.accountNumber}`,
    })
  }

  if (!propertyId) {
    return (
      <PageContainer>
        <Header
          title="Tài Khoản Ngân Hàng"
          description="Quản lý tài khoản ngân hàng để nhận thanh toán VietQR"
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">Không xác định được cơ sở.</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title="Tài Khoản Ngân Hàng"
        description="Quản lý tài khoản ngân hàng để nhận thanh toán"
        actions={
          <Button onClick={() => { resetForm(); setShowModal(true) }}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm tài khoản
          </Button>
        }
      />

      {/* Info Banner */}
      <Card className="mb-6 bg-info-soft border-info/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-info mt-0.5" />
          <div>
            <p className="font-medium text-info">Tích hợp VietQR</p>
            <p className="text-sm text-info">
              Khách hàng có thể quét mã QR để thanh toán nhanh chóng.
              Hỗ trợ tất cả ngân hàng tại Việt Nam.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted mb-4">Chưa có tài khoản ngân hàng nào</p>
            <Button onClick={() => { resetForm(); setShowModal(true) }}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm tài khoản
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-fg/5 flex items-center justify-center">
                      <Building className="w-7 h-7 text-muted" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-fg">{account.bankName}</h3>
                      <p className="text-sm text-muted">Mã ngân hàng: {account.bankCode}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={account.isActive ? 'success' : 'gray'}>
                          {account.isActive ? 'Đang hoạt động' : 'Tắt'}
                        </Badge>
                        {account.qrEnabled && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            VietQR
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(account)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(account.id)}>
                      <Trash2 className="w-4 h-4 text-err" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-fg/[0.03] rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted">Số tài khoản</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-lg font-semibold">
                          {formatAccountNumber(account.accountNumber)}
                        </p>
                        <button
                          onClick={() => copyToClipboard(account.accountNumber)}
                          className="p-1 hover:bg-fg/10 rounded"
                          aria-label="Copy số tài khoản"
                        >
                          <Copy className="w-4 h-4 text-muted" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted">Tên tài khoản</p>
                      <p className="font-semibold">{account.accountHolder}</p>
                    </div>
                  </div>
                </div>

                {/* QR Preview */}
                {account.qrEnabled && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <VietQR
                        bankCode={account.bankCode}
                        accountNumber={account.accountNumber}
                        accountHolder={account.accountHolder}
                        size={120}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const qrData = buildVietQRPreview(account)
                          QRCode.toDataURL(qrData, { width: 300, margin: 2 }).then(downloadQR)
                        }}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Tải QR
                      </Button>
                    </div>
                    <div>
                      <p className="text-sm text-muted">Nội dung chuyển khoản</p>
                      <p className="font-mono text-sm bg-fg/5 px-2 py-1 rounded mt-1">
                        DIGISTAY - {account.accountNumber}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-panel rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-line">
              <h2 className="text-xl font-semibold">
                {editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản ngân hàng'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Ngân hàng <span className="text-err">*</span>
                </label>
                <select
                  value={formData.bankCode}
                  onChange={(e) => {
                    const bank = bankList.find(b => b.code === e.target.value)
                    setFormData({
                      ...formData,
                      bankCode: e.target.value,
                      bankName: bank?.name || '',
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-acc focus-visible:border-acc"
                >
                  <option value="">Chọn ngân hàng</option>
                  {bankList.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Số tài khoản <span className="text-err">*</span>
                </label>
                <Input
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  placeholder="Nhập số tài khoản"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Tên tài khoản <span className="text-err">*</span>
                </label>
                <Input
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                  placeholder="Tên chủ tài khoản"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="qrEnabled"
                  checked={formData.qrEnabled}
                  onChange={(e) => setFormData({ ...formData, qrEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="qrEnabled" className="text-sm text-fg">
                  Bật thanh toán VietQR
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-line flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowModal(false); resetForm() }}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button onClick={handleSubmit} isLoading={isSubmitting}>
                {editingAccount ? 'Lưu thay đổi' : 'Thêm tài khoản'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
