'use client'

import * as React from 'react'
import QRCode from 'qrcode'

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
  size = 200 
}: VietQRProps) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const generateQR = async () => {
      if (!bankCode || !accountNumber || !accountHolder) {
        setQrDataUrl('')
        setIsLoading(false)
        return
      }

      try {
        // VietQR format
        const qrData = buildVietQRString({
          bankCode,
          accountNumber,
          accountHolder,
          amount,
          description,
        })
        
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })
        
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Failed to generate QR:', error)
        setQrDataUrl('')
      } finally {
        setIsLoading(false)
      }
    }

    generateQR()
  }, [bankCode, accountNumber, accountHolder, amount, description, size])

  if (isLoading) {
    return (
      <div 
        className="bg-gray-100 rounded-lg animate-pulse"
        style={{ width: size, height: size }}
      />
    )
  }

  if (!qrDataUrl) {
    return (
      <div 
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-gray-400 text-sm text-center p-4">QR sẽ hiển thị ở đây</span>
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

// Build VietQR string according to VietQR standard
function buildVietQRString(data: {
  bankCode: string
  accountNumber: string
  accountHolder: string
  amount?: number
  description?: string
}): string {
  // VietQR uses a specific format
  // Format: [Service Code][Version][Terminal][Merchant ID][Transaction Amount][Tip]
  
  const parts: string[] = []
  
  // Add bank code and account info
  parts.push(`38${data.bankCode}`) // 38 = VietQR service code
  parts.push(`0012${data.accountNumber}`)
  
  // Add merchant name (account holder)
  const nameLength = data.accountHolder.length.toString().padStart(2, '0')
  parts.push(`0808${nameLength}${data.accountHolder}`)
  
  // Add amount if provided
  if (data.amount && data.amount > 0) {
    const amountStr = Math.round(data.amount).toString().padStart(12, '0')
    parts.push(`54${amountStr}`)
  }
  
  // Add description
  if (data.description) {
    const descLength = data.description.length.toString().padStart(2, '0')
    parts.push(`08${descLength}${data.description}`)
  }
  
  // Add CRC (simplified - in production use proper CRC16)
  parts.push('6304') // CRC placeholder
  
  return parts.join('')
}

// Download QR code as image
export function downloadQR(dataUrl: string, filename: string = 'vietqr.png') {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
