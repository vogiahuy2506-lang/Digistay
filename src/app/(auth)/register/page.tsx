'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button, Input } from '@/components/ui'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  
  // Get prefill data from URL params
  const hotelName = searchParams.get('hotelName') || ''
  const phone = searchParams.get('phone') || ''
  const scale = searchParams.get('scale') || ''
  const createWorkspace = searchParams.get('createWorkspace') === 'true'
  
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        setIsLoading(false)
        return
      }

      // Auto login after registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Đăng ký thành công nhưng không thể đăng nhập tự động')
        router.push('/login')
      } else {
        // Build redirect URL with params to prefill workspace creation
        const params = new URLSearchParams()
        if (hotelName) params.set('hotelName', hotelName)
        if (phone) params.set('phone', phone)
        if (scale) params.set('scale', scale)
        if (createWorkspace) params.set('createWorkspace', 'true')
        
        const redirectUrl = params.toString() 
          ? `/workspaces?${params.toString()}`
          : '/workspaces'
        
        router.push(redirectUrl)
        router.refresh()
      }
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/workspaces' })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản mới</h1>
        <p className="mt-2 text-sm text-gray-600">
          Bắt đầu quản lý cơ sở kinh doanh của bạn ngay hôm nay.
        </p>
      </div>

      {/* Google Login */}
      <Button
        type="button"
        variant="outline"
        className="w-full mb-6"
        onClick={handleGoogleLogin}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Đăng ký với Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-gray-50 text-gray-500">hoặc</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Họ và tên"
          type="text"
          placeholder="Nguyen Van A"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <Input
          label="Email"
          type="email"
          placeholder="nhap@email.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <Input
          label="Mật khẩu"
          type="password"
          placeholder="Ít nhất 6 ký tự"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />

        <Input
          label="Xác nhận mật khẩu"
          type="password"
          placeholder="Nhập lại mật khẩu"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          required
        />

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            className="mt-1 rounded border-gray-300 text-primary focus:ring-primary-500"
            required
          />
          <label htmlFor="terms" className="text-sm text-gray-600">
            Tôi đồng ý với{' '}
            <Link href="/terms" className="text-primary hover:text-primary-600">
              Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-600">
              Chính sách bảo mật
            </Link>
          </label>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Tạo tài khoản
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-primary hover:text-primary-600 font-medium">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}
