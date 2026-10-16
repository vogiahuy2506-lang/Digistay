'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, Button } from '@/components/ui'
import { Building2, Check, X, AlertCircle } from 'lucide-react'

interface InvitationInfo {
  workspace: {
    id: string
    name: string
    description: string | null
  }
  role: string
  sender: {
    name: string | null
    email: string
  }
  email: string
}

export default function InvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceId = searchParams.get('workspace')
  const token = searchParams.get('token')
  
  const [invitation, setInvitation] = React.useState<InvitationInfo | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'success' | 'declined'>('idle')

  React.useEffect(() => {
    if (workspaceId && token) {
      fetchInvitationInfo()
    }
  }, [workspaceId, token])

  const fetchInvitationInfo = async () => {
    try {
      // Get workspace info from the invitation token
      const res = await fetch(`/api/workspaces/${workspaceId}`)
      const data = await res.json()
      
      if (data.success) {
        setInvitation({
          workspace: {
            id: data.data.id,
            name: data.data.name,
            description: data.data.description,
          },
          role: 'MEMBER', // Will be determined by API
          sender: data.data.owner,
          email: '', // Will be filled by backend
        })
      }
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
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${token}/accept`, {
        method: 'POST',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
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
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${token}/decline`, {
        method: 'POST',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
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

  if (!workspaceId || !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Link lời mời không hợp lệ
            </h1>
            <p className="text-gray-500 mb-6">
              Link này không có thông tin workspace hoặc token. Vui lòng kiểm tra lại.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Chấp nhận lời mời thành công!
            </h1>
            <p className="text-gray-500 mb-6">
              Bạn đã trở thành thành viên của workspace. Bắt đầu khám phá ngay!
            </p>
            <Button onClick={() => router.push(`/dashboard?workspace=${workspaceId}`)}>
              Mở Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'declined') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-gray-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Đã từ chối lời mời
            </h1>
            <p className="text-gray-500 mb-6">
              Bạn đã từ chối lời mời tham gia workspace này.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary-600" />
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

          {invitation && invitation.workspace.description && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {invitation.workspace.description}
              </p>
            </div>
          )}

          {invitation && (
            <div className="mb-6 text-sm text-gray-500">
              <p>Lời mời từ: {invitation.sender.name || invitation.sender.email}</p>
            </div>
          )}

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
        </CardContent>
      </Card>
    </div>
  )
}
