'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Select } from '@/components/ui'
import { VietQR, downloadQR } from '@/components/ui/viet-qr'
import { 
  Building, Plus, Trash2, Edit, QrCode, Check, X, Copy, 
  CreditCard, Shield, AlertCircle, Download
} from 'lucide-react'

interface BankAccount {
  id: string
  bankName: string
  bankCode: string
  accountNumber: string
  accountHolder: string
  qrEnabled: boolean
  isActive: boolean
}

interface Property {
  id: string
  name: string
  subdomain: string
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
  { code: 'CTG', name: 'BIDV' },
]

export default function BankAccountsPage() {
  const params = useParams<{ slug: string; id: string }>()
  const propertyIdFromUrl = params.id
  const workspaceId = params.slug ? null : null // not used in this page
  
  const [properties, setProperties] = React.useState<Property[]>([])
  const [accounts, setAccounts] = React.useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showModal, setShowModal] = React.useState(false)
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null)
  const [selectedProperty, setSelectedProperty] = React.useState('')

  const [formData, setFormData] = React.useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
    qrEnabled: true,
  })

  // Fetch properties when workspace changes
  React.useEffect(() => {
    fetchProperties()
  }, [workspaceId])

  // Fetch accounts when property changes
  React.useEffect(() => {
    if (selectedProperty) {
      fetchAccounts()
    } else {
      setAccounts([])
      setIsLoading(false)
    }
  }, [selectedProperty])

  const fetchProperties = async () => {
    if (!workspaceId) {
      setIsLoading(false)
      return
    }
    try {
      const response = await fetch(`/api/properties?workspaceId=${workspaceId}`)
      const data = await response.json()
      if (data.success && data.data.length > 0) {
        setProperties(data.data)
        // Auto-select first property if none selected
        if (!selectedProperty) {
          setSelectedProperty(data.data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/bank-accounts?propertyId=${selectedProperty}`)
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data)
      } else {
        // Mock data
        setAccounts([
          {
            id: '1',
            bankName: 'Ngân hàng Quân đội (MB Bank)',
            bankCode: 'MB',
            accountNumber: '1234567890123',
            accountHolder: 'CÔNG TY TNHH DIGISTAY',
            qrEnabled: true,
            isActive: true,
          },
          {
            id: '2',
            bankName: 'Vietcombank',
            bankCode: 'VCB',
            accountNumber: '1234567890',
            accountHolder: 'CÔNG TY TNHH DIGISTAY',
            qrEnabled: true,
            isActive: true,
          },
        ])
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      if (editingAccount) {
        // Update
        setAccounts(accounts.map(a => 
          a.id === editingAccount.id ? { ...a, ...formData } : a
        ))
      } else {
        // Create
        const newAccount: BankAccount = {
          id: Date.now().toString(),
          ...formData,
          isActive: true,
        }
        setAccounts([...accounts, newAccount])
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save account:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
      setAccounts(accounts.filter(a => a.id !== id))
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Đã copy!')
  }

  const formatAccountNumber = (num: string) => {
    return num.replace(/(.{4})/g, '$1 ').trim()
  }

  // Build VietQR string for preview/download
  const buildVietQRPreview = (account: BankAccount) => {
    const parts: string[] = []
    parts.push(`38${account.bankCode}`)
    parts.push(`0012${account.accountNumber}`)
    const nameLength = account.accountHolder.length.toString().padStart(2, '0')
    parts.push(`0808${nameLength}${account.accountHolder}`)
    parts.push('6304')
    return parts.join('')
  }

  if (!workspaceId) {
    return (
      <PageContainer>
        <Header
          title="Tài Khoản Ngân Hàng"
          description="Quản lý tài khoản ngân hàng để nhận thanh toán VietQR"
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Không tìm thấy thông tin workspace</p>
            <p className="text-sm text-gray-400">Vui lòng chọn workspace từ thanh sidebar</p>
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
          <div className="flex items-center gap-3">
            <Select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-64"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Button onClick={() => { resetForm(); setShowModal(true) }} disabled={!selectedProperty}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm tài khoản
            </Button>
          </div>
        }
      />

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Tích hợp VietQR</p>
            <p className="text-sm text-blue-700">
              Khách hàng có thể quét mã QR để thanh toán nhanh chóng. 
              Hỗ trợ tất cả ngân hàng tại Việt Nam.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* No property selected */}
      {!selectedProperty && properties.length > 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Vui lòng chọn cơ sở để quản lý tài khoản</p>
          </CardContent>
        </Card>
      )}

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Chưa có tài khoản ngân hàng nào</p>
            <Button onClick={() => setShowModal(true)}>
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
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Building className="w-7 h-7 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{account.bankName}</h3>
                      <p className="text-sm text-gray-500">Mã ngân hàng: {account.bankCode}</p>
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
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Số tài khoản</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-lg font-semibold">
                          {formatAccountNumber(account.accountNumber)}
                        </p>
                        <button
                          onClick={() => copyToClipboard(account.accountNumber)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tên tài khoản</p>
                      <p className="font-semibold">{account.accountHolder}</p>
                    </div>
                  </div>
                </div>

                {/* QR Preview */}
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
                        // Generate and download QR with amount
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
                    <p className="text-sm text-gray-500">Nội dung chuyển khoản</p>
                    <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded mt-1">
                      DIGISTAY - {account.accountNumber}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">
                {editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản ngân hàng'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngân hàng <span className="text-red-500">*</span>
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số tài khoản <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  placeholder="Nhập số tài khoản"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên tài khoản <span className="text-red-500">*</span>
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
                <label htmlFor="qrEnabled" className="text-sm text-gray-700">
                  Bật thanh toán VietQR
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowModal(false); resetForm() }}>
                Hủy
              </Button>
              <Button onClick={handleSubmit}>
                {editingAccount ? 'Lưu thay đổi' : 'Thêm tài khoản'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
