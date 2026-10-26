'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { Header, PageContainer } from '@/components/layout'
import { Card, CardContent, Button, Badge, Input, Select, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { VietQR, downloadQR } from '@/components/ui/viet-qr'
import { MOMO_CODE, VIETQR_BANKS, buildVietQr, findBank, isWallet, toBankName, walletPhone } from '@/lib/vietqr'
import { NoAccess, useHasRole } from '@/components/payment/no-access'
import { toast } from '@/components/ui/toast'
import { PayosCard } from './payos-card'
import { DepositModeCard } from './deposit-mode-card'
import {
  Building, Plus, Trash2, Edit, QrCode, Copy,
  AlertCircle, Download, Wallet
} from 'lucide-react'
import { apiError } from '@/lib/i18n/api-errors'

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

// Every bank VietQR knows (src/lib/vietqr/banks.ts), by name; the short
// name is what is saved as the account's bankName. Wallets (MoMo) have
// their own form: phone number and name.
const bankOptions = VIETQR_BANKS.filter((bank) => !bank.wallet)
  .sort((a, b) => a.shortName.localeCompare(b.shortName))
  .map((bank) => ({ value: bank.code, label: `${bank.shortName} (${bank.code})` }))

/** The transfer content of the account's own QR (no booking). */
const qrContent = (account: { accountNumber: string }) => `DIGISTAY-${account.accountNumber}`

export default function BankAccountsPage() {
  const t = useTranslations('dash.money.bank')
  const tc = useTranslations('dash.common')
  const params = useParams<{ slug: string; id: string }>()
  const propertyId = params.id
  // Where guests' transfers go: the owner and ADMINs only, like the API.
  const allowed = useHasRole(['ADMIN'])

  const [accounts, setAccounts] = React.useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showModal, setShowModal] = React.useState(false)
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null)
  // Read the deposit settings again when accounts or PayOS change.
  const [version, setVersion] = React.useState(0)
  // The account the manual deposit QR names now (marked on its card).
  const [depositAccountId, setDepositAccountId] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
    qrEnabled: true,
  })

  React.useEffect(() => {
    if (propertyId && allowed) {
      fetchAccounts()
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, allowed])

  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/bank-accounts?propertyId=${propertyId}`)
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data)
        setVersion((v) => v + 1)
      } else {
        toast.error(apiError(data.error) || t('toast.loadFailed'))
        setAccounts([])
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
      toast.error(t('toast.loadError'))
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!propertyId) {
      toast.error(t('toast.noProperty'))
      return
    }
    if (!formData.bankCode || !formData.accountNumber || !formData.accountHolder) {
      toast.error(t('toast.fillAll'))
      return
    }
    const wallet = isWallet(formData.bankCode)
    if (wallet && !walletPhone(formData.accountNumber)) {
      toast.error(t('toast.badPhone'))
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
          ...(wallet && { accountNumber: walletPhone(formData.accountNumber) }),
        }),
      })
      const data = await response.json()

      if (!data.success) {
        toast.error(apiError(data.error) || t('toast.saveFailed'))
        return
      }

      toast.success(editingAccount ? t('toast.updated') : t('toast.added'))
      setShowModal(false)
      resetForm()
      await fetchAccounts()
    } catch (err) {
      console.error('Failed to save account:', err)
      toast.error(t('toast.saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return
    try {
      const response = await fetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!data.success) {
        toast.error(apiError(data.error) || t('toast.deleteFailed'))
        return
      }
      toast.success(t('toast.deleted'))
      setAccounts(accounts.filter(a => a.id !== id))
      setVersion((v) => v + 1)
    } catch (err) {
      console.error('Failed to delete account:', err)
      toast.error(t('toast.deleteError'))
    }
  }

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account)
    const bank = findBank(account.bankCode)
    setFormData({
      bankName: bank?.shortName ?? account.bankName,
      // An old code ("VTB") shows as its bank in the list.
      bankCode: bank?.code ?? account.bankCode,
      accountNumber: account.accountNumber,
      accountHolder: toBankName(account.accountHolder),
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

  /** A MoMo wallet: VietQR names it by MoMo's BIN and the wallet's phone number. */
  const addWallet = () => {
    resetForm()
    setFormData((f) => ({ ...f, bankCode: MOMO_CODE, bankName: findBank(MOMO_CODE)!.shortName }))
    setShowModal(true)
  }
  const walletForm = isWallet(formData.bankCode)

  const copyToClipboard = async (text: string, label = t('toast.copied')) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(label)
    } catch {
      toast.error(t('toast.copyFailed'))
    }
  }

  const formatAccountNumber = (num: string) => {
    return num.replace(/(.{4})/g, '$1 ').trim()
  }

  // Build a real VietQR string using the canonical EMVCo implementation
  // (CRC-16/CCITT, full TLV tags) so that bank apps can parse it.
  const downloadAccountQr = async (account: BankAccount) => {
    try {
      const qrData = buildVietQr({
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
        amount: 0,
        addInfo: qrContent(account),
      })
      downloadQR(await QRCode.toDataURL(qrData, { width: 300, margin: 2 }))
    } catch (err) {
      console.error('Failed to build the QR:', err)
      toast.error(t('toast.qrFailed'))
    }
  }

  if (!allowed) return <NoAccess title={t('title')} />

  if (!propertyId) {
    return (
      <PageContainer>
        <Header
          title={t('title')}
          description={t('descriptionVietqr')}
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">{t('noProperty')}</p>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Header
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addWallet}>
              <Wallet className="w-4 h-4 mr-2" />
              {t('addMomo')}
            </Button>
            <Button onClick={() => { resetForm(); setShowModal(true) }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add')}
            </Button>
          </div>
        }
      />

      {/* Info Banner */}
      <Card className="mb-6 bg-info-soft border-info/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-info mt-0.5" />
          <div>
            <p className="font-medium text-info">{t('infoTitle')}</p>
            <p className="text-sm text-info">
              {t('infoText')}
            </p>
          </div>
        </CardContent>
      </Card>

      <DepositModeCard
        propertyId={propertyId}
        accounts={accounts}
        version={version}
        onLoaded={(settings) => setDepositAccountId(settings.effectiveMode === 'MANUAL' ? settings.accountId : null)}
      />

      <PayosCard propertyId={propertyId} onChange={() => setVersion((v) => v + 1)} />

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-acc" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted mb-1">{t('empty')}</p>
            <p className="text-sm text-muted mb-4">{t('emptyHint')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={addWallet}>
                <Wallet className="w-4 h-4 mr-2" />
                {t('addMomo')}
              </Button>
              <Button onClick={() => { resetForm(); setShowModal(true) }}>
                <Plus className="w-4 h-4 mr-2" />
                {t('add')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const wallet = isWallet(account.bankCode)
            return (
            <Card key={account.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-xl bg-fg/5 items-center justify-center">
                      {wallet ? <Wallet className="w-7 h-7 text-muted" /> : <Building className="w-7 h-7 text-muted" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-fg break-words">{wallet ? t('momoWallet') : account.bankName}</h3>
                      {!wallet && <p className="text-sm text-muted">{t('bankCode', { code: findBank(account.bankCode)?.code ?? account.bankCode })}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant={account.isActive ? 'success' : 'gray'}>
                          {account.isActive ? t('active') : t('inactive')}
                        </Badge>
                        {account.id === depositAccountId && <Badge variant="acc">{t('depositAccount')}</Badge>}
                        {account.qrEnabled && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            VietQR
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button aria-label={tc('actions.edit')} variant="outline" size="sm" onClick={() => handleEdit(account)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button aria-label={tc('actions.delete')} variant="outline" size="sm" onClick={() => handleDelete(account.id)}>
                      <Trash2 className="w-4 h-4 text-err" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 sm:p-4 bg-fg/[0.03] rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted">{wallet ? t('walletPhone') : t('accountNumber')}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-lg font-semibold break-all">
                          {wallet ? account.accountNumber : formatAccountNumber(account.accountNumber)}
                        </p>
                        <button
                          onClick={() => copyToClipboard(account.accountNumber)}
                          className="p-1 hover:bg-fg/10 rounded"
                          aria-label={wallet ? t('copyWalletPhone') : t('copyAccountNumber')}
                        >
                          <Copy className="w-4 h-4 text-muted" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted">{t('accountHolder')}</p>
                      <p className="font-semibold break-words">{toBankName(account.accountHolder)}</p>
                    </div>
                  </div>
                </div>

                {/* QR Preview */}
                {account.qrEnabled && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <VietQR
                        bankCode={account.bankCode}
                        accountNumber={account.accountNumber}
                        accountHolder={account.accountHolder}
                        description={qrContent(account)}
                        size={120}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadAccountQr(account)}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {t('downloadQr')}
                      </Button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted">{t('transferContent')}</p>
                      <p className="font-mono text-sm bg-fg/5 px-2 py-1 rounded mt-1 break-all">
                        {qrContent(account)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        showHeader
        isOpen={showModal}
        onClose={() => { if (!isSubmitting) { setShowModal(false); resetForm() } }}
        title={walletForm ? (editingAccount ? t('form.editMomoTitle') : t('form.addMomoTitle')) : editingAccount ? t('form.editTitle') : t('form.addTitle')}
        size="sm"
      >
        <ModalBody className="space-y-4">
          {!walletForm && (
          <Select
            label={t('form.bank')}
            required
            value={formData.bankCode}
            onChange={(e) => {
              const bank = findBank(e.target.value)
              setFormData({
                ...formData,
                bankCode: e.target.value,
                bankName: bank?.shortName || '',
              })
            }}
            options={[{ value: '', label: t('form.chooseBank') }, ...bankOptions]}
          />
          )}
          <Input
            label={walletForm ? t('walletPhone') : t('accountNumber')}
            required
            inputMode={walletForm ? 'tel' : 'numeric'}
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            placeholder={walletForm ? t('form.momoPhonePlaceholder') : t('form.accountNumberPlaceholder')}
            hint={walletForm ? t('form.momoPhoneHint') : undefined}
          />
          <Input
            label={t('accountHolder')}
            required
            value={formData.accountHolder}
            // Banks print the holder in capitals without accents; the API saves it so.
            onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value.toUpperCase() })}
            onBlur={() => setFormData((f) => ({ ...f, accountHolder: toBankName(f.accountHolder) }))}
            placeholder={walletForm ? t('form.momoHolderPlaceholder') : t('form.accountHolderPlaceholder')}
            hint={t('form.accountHolderHint')}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="qrEnabled"
              checked={formData.qrEnabled}
              onChange={(e) => setFormData({ ...formData, qrEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="qrEnabled" className="text-sm text-fg">
              {t('form.enableQr')}
            </label>
          </div>
        </ModalBody>
        <ModalFooter className="sm:justify-end">
          <Button
            variant="outline"
            onClick={() => { setShowModal(false); resetForm() }}
            disabled={isSubmitting}
          >
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {editingAccount ? tc('actions.saveChanges') : walletForm ? t('form.submitAddMomo') : t('form.submitAdd')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}
