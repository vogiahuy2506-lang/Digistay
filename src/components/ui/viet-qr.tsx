'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { buildVietQr, type VietQrInput } from '@/lib/vietqr'

interface VietQRProps {
  bankCode: string
  accountNumber: string
  accountHolder: string
  amount?: number
  description?: string
  size?: number
}

export function VietQR({
  bankCode,
  accountNumber,
  accountHolder,
  amount,
  description,
  size = 200,
}: VietQRProps) {
  const t = useTranslations('dash.money.qr')
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const generateQR = async () => {
      if (!bankCode || !accountNumber || !accountHolder) {
        if (!cancelled) {
          setQrDataUrl('')
          setIsLoading(false)
        }
        return
      }

      try {
        // Use the canonical implementation in src/lib/vietqr so the
        // generated string is a real EMVCo / VietQR payload (CRC-16
        // computed correctly) and not a placeholder.
        const qrData = buildVietQr({
          bankCode,
          accountNumber,
          accountHolder,
          amount: amount ?? 0,
          addInfo: description ?? '',
        } satisfies VietQrInput)

        const dataUrl = await QRCode.toDataURL(qrData, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })

        if (!cancelled) {
          setQrDataUrl(dataUrl)
        }
      } catch (error) {
        console.error('Failed to generate QR:', error)
        if (!cancelled) setQrDataUrl('')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    generateQR()

    return () => {
      cancelled = true
    }
  }, [bankCode, accountNumber, accountHolder, amount, description, size])

  if (isLoading) {
    return (
      <div
        className="bg-fg/5 rounded-lg animate-pulse"
        style={{ width: size, height: size }}
      />
    )
  }

  if (!qrDataUrl) {
    return (
      <div
        className="bg-fg/5 rounded-lg flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-muted text-sm text-center p-4">
          {t('placeholder')}
        </span>
      </div>
    )
  }

  return (
    <img
      src={qrDataUrl}
      alt="VietQR Code"
      width={size}
      height={size}
      className="rounded-lg"
    />
  )
}

// Download QR code as image
export function downloadQR(dataUrl: string, filename: string = 'vietqr.png') {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
