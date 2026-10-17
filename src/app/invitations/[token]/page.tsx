'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Button } from '@/components/ui'
import { Building2, Check, X, AlertCircle } from 'lucide-react'

interface InvitationInfo {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  workspace: {
    id: string
    name: string
    description: string | null
    logo: string | null
  }
  sender: {
    id: string
    name: string | null
    email: string
  }
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  RECEPTIONIST: 'Lễ tân',
  USER: 'Nhân viên',
}

export default function InvitationPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { token } = params

  const [invitation, setInvitation] = React.useState<InvitationInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'success' | 'declined' | 'expired' | 'invalid'>(
    'idle'
  )

  React.useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setIsLoading(false)
      return
    }
    fetchInvitationInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchInvitationInfo = async () => {
    try {
      const res = await fetch(`/api/invitations/${token}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (res.status === 404) setStatus('invalid')
        else if (data.data?.status === 'EXPIRED') setStatus('expired')
        else setError(data.error || 'Không thể tải thông tin lời mời')
        return
      }

      if (data.data.status === 'EXPIRED') {
        setStatus('expired')
        return
      }
      if (data.data.status !== 'PENDING') {
        setStatus(data.data.status === 'ACCEPTED' ? 'success' : 'declined')
        return
      }
      setInvitation(data.data)
    } catch (err) {
      setError('Không thể tải thông tin lời mời')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async () => {
    setIsProcessing(true)
    setError('')
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          // Save the token so we can return after login
          sessionStorage.setItem('pendingInvitation', token)
          router.push(`/login?callbackUrl=/invitations/${token}`)
          return
        }
        setError(data.error || 'Không thể chấp nhận lời mời')
        return
      }
      setStatus('success')
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    setIsProcessing(true)
    setError('')
    try {
      const res = await fetch(`/api/invitations/${token}/decline`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.setItem('pendingInvitation', token)
          router.push(`/login?callbackUrl=/invitations/${token}`)
          return
        }
        setError(data.error || 'Không thể từ chối lời mời')
        return
      }
      setStatus('declined')
    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (status === 'invalid' || (!invitation && !error && status === 'idle')) {
    return (
      <CenteredCard>
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Lời mời không hợp lệ
        </h1>
        <p className="text-gray-500 mb-6">
          Lời mời này không tồn tại hoặc đã bị thu hồi. Vui lòng liên hệ người mời.
        </p>
        <Button onClick={() => router.push('/login')}>Về trang đăng nhập</Button>
      </CenteredCard>
    )
  }

  if (status === 'expired') {
    return (
      <CenteredCard>
        <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Lời mời đã hết hạn
        </h1>
        <p className="text-gray-500 mb-6">
          Lời mời này đã hết hạn. Vui lòng yêu cầu người quản lý gửi lại lời mời mới.
        </p>
        <Button variant="outline" onClick={() => router.push('/login')}>
          Về trang đăng nhập
        </Button>
      </CenteredCard>
    )
  }

  if (status === 'success') {
    return (
      <CenteredCard>
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Chấp nhận lời mời thành công!
        </h1>
        <p className="text-gray-500 mb-6">
          Bạn đã trở thành thành viên của <strong>{invitation?.workspace.name}</strong>.
        </p>
        <Button
          onClick={() =>
            router.push(
              `/workspace-picker?selected=${invitation?.workspace.id ?? ''}`
            )
          }
        >
          Mở Workspace
        </Button>
      </CenteredCard>
    )
  }

  if (status === 'declined') {
    return (
      <CenteredCard>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-gray-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Đã từ chối lời mời
        </h1>
        <p className="text-gray-500 mb-6">
          Bạn đã từ chối lời mời tham gia workspace này.
        </p>
        <Button variant="outline" onClick={() => router.push('/login')}>
          Về trang đăng nhập
        </Button>
      </CenteredCard>
    )
  }

  // Default: render the invitation details
  const roleLabel = invitation ? ROLE_LABELS[invitation.role] ?? invitation.role : ''
  const senderLabel = invitation?.sender?.name || invitation?.sender?.email || '—'

  return (
    <CenteredCard>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {invitation?.workspace.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invitation.workspace.logo}
              alt={invitation.workspace.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <Building2 className="w-8 h-8 text-primary-600" />
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Lời mời tham gia Workspace
        </h1>
        {invitation && (
          <p className="text-gray-500">
            Bạn được mời tham gia <strong>{invitation.workspace.name}</strong>
          </p>
        )}
      </div>

      {invitation?.workspace.description && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">{invitation.workspace.description}</p>
        </div>
      )}

      <div className="mb-6 space-y-2 text-sm">
        <Row label="Workspace" value={invitation?.workspace.name ?? '—'} />
        <Row label="Vai trò" value={roleLabel} />
        <Row label="Email được mời" value={invitation?.email ?? '—'} />
        <Row label="Người mời" value={senderLabel} />
      </div>

      <div className="flex gap-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleDecline}
          disabled={isProcessing}
        >
          <X className="w-4 h-4 mr-2" />
          Từ chối
        </Button>
        <Button
          className="flex-1"
          onClick={handleAccept}
          isLoading={isProcessing}
        >
          <Check className="w-4 h-4 mr-2" />
          Chấp nhận
        </Button>
      </div>
    </CenteredCard>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">{children}</CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
