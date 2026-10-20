'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Copy, CheckCircle2, QrCode as QrIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  qrString: string
  amount: number
  transferContent?: string
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  currency?: string
  expiresAt?: string
  size?: number
}

/**
 * Renders a Vietnamese QR (VietQR) for a payment. The customer scans
 * the code with any Vietnamese banking app — the app pre-fills the
 * transfer amount and content (booking code) automatically.
 */
export function VietQRDisplay({
  qrString,
  amount,
  transferContent = '',
  bankName = '',
  accountNumber = '',
  accountHolder = '',
  currency = 'VND',
  expiresAt,
  size = 320,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      width: size,
      margin: 2,
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => console.error('QR render error:', err))
    return () => {
      cancelled = true
    }
  }, [qrString])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrIcon className="w-5 h-5" />
          Quét mã QR để thanh toán
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* QR image */}
        <div className="flex justify-center">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="VietQR"
              className="w-72 h-72 border border-line rounded-lg p-2 bg-panel"
            />
          ) : (
            <div className="w-72 h-72 flex items-center justify-center text-muted border border-line rounded-lg">
              Đang tạo mã QR...
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted">
          Mở app ngân hàng và quét mã để chuyển khoản tự động
        </p>

        {/* Bank info table */}
        <div className="space-y-2 text-sm">
          <Row label="Số tiền" value={formatCurrency(amount, currency)} highlight />
          <Row label="Nội dung CK">
            <button
              onClick={() => copy(transferContent)}
              className="inline-flex items-center gap-1.5 text-acc hover:underline"
            >
              <span className="font-mono">{transferContent}</span>
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-ok" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </Row>
          <Row label="Ngân hàng" value={bankName} />
          <Row label="Số tài khoản" value={accountNumber} />
          <Row label="Chủ tài khoản" value={accountHolder} />
          {expiresAt && (
            <Row
              label="Hết hạn"
              value={new Date(expiresAt).toLocaleString('vi-VN')}
            />
          )}
        </div>

        <p className="text-xs text-muted text-center">
          Hệ thống tự động xác nhận khoản thanh toán trong vài giây sau khi chuyển khoản thành công.
        </p>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  highlight,
  children,
}: {
  label: string
  value?: string
  highlight?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-0">
      <span className="text-muted">{label}</span>
      {children ?? (
        <span
          className={
            highlight
              ? 'font-bold text-acc text-base'
              : 'font-medium text-fg'
          }
        >
          {value}
        </span>
      )}
    </div>
  )
}
