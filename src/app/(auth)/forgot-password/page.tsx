'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui'
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert'
import {
  ArrowLeft, Mail, Lock, Check, Loader2, Shield, Phone
} from 'lucide-react'

type Step = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = React.useState<Step>('email')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [countdown, setCountdown] = React.useState(0)

  const [emailForm, setEmailForm] = React.useState({ email: '' })
  const [otpForm, setOtpForm] = React.useState({ phone: '', otp: '' })
  const [passwordForm, setPasswordForm] = React.useState({
    newPassword: '',
    confirmPassword: '',
  })

  // Countdown timer for resend
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const sendOTP = async () => {
    if (!otpForm.phone) {
      setError('Vui lòng nhập số điện thoại')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpForm.phone }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Mã OTP đã được gửi đến số điện thoại của bạn')
        setCountdown(60) // 60 seconds cooldown
        if (data.otp) {
          // Dev mode: show OTP
          console.log('OTP:', data.otp)
        }
      } else {
        setError(data.error || 'Lỗi khi gửi OTP')
      }
    } catch (err) {
      console.error('Send OTP error:', err)
      setError('Đã xảy ra lỗi khi gửi OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (!otpForm.otp || otpForm.otp.length !== 6) {
      setError('Vui lòng nhập mã OTP 6 chữ số')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: otpForm.phone,
          otp: otpForm.otp,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setStep('password')
        setSuccess('Xác thực thành công! Vui lòng đặt mật khẩu mới')
      } else {
        setError(data.error || 'Mã OTP không hợp lệ')
      }
    } catch (err) {
      console.error('Verify OTP error:', err)
      setError('Đã xảy ra lỗi khi xác thực OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async () => {
    if (passwordForm.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // First sign in with magic link or just reset
      // For this flow, we'll use a dedicated reset endpoint
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: otpForm.phone,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setStep('success')
      } else {
        setError(data.error || 'Lỗi khi đặt lại mật khẩu')
      }
    } catch (err) {
      console.error('Reset password error:', err)
      setError('Đã xảy ra lỗi khi đặt lại mật khẩu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-terracotta selection:text-white ambient-mesh" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between z-20">
        <Link href="/login" className="flex items-center gap-3.5 group">
          <div className="w-10 h-10 rounded-xl bg-charcoal flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
            <span className="material-symbols-outlined text-[22px] text-terracotta">domain_add</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-extrabold tracking-tight text-charcoal">Digi<span className="text-terracotta">Stay</span></span>
            </div>
          </div>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full shadow-luxury">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-terracotta" />
            </div>
            <CardTitle className="text-2xl font-bold text-charcoal">
              {step === 'email' && 'Khôi phục mật khẩu'}
              {step === 'otp' && 'Xác thực số điện thoại'}
              {step === 'password' && 'Đặt mật khẩu mới'}
              {step === 'success' && 'Thành công!'}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert variant="success">
                <AlertIcon variant="success" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Email (Legacy - kept for reference) */}
            {step === 'email' && (
              <div className="space-y-4">
                <p className="text-sm text-charcoal-muted text-center">
                  Nhập địa chỉ email đã đăng ký để khôi phục mật khẩu
                </p>
                <Input
                  label="Email"
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ email: e.target.value })}
                  placeholder="quanly@khachsan.vn"
                  icon={<Mail className="w-4 h-4" />}
                />
                <p className="text-xs text-charcoal-muted text-center">
                  Hoặc{' '}
                  <button
                    type="button"
                    onClick={() => setStep('otp')}
                    className="text-terracotta font-medium hover:underline"
                  >
                    xác thực bằng số điện thoại
                  </button>
                </p>
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {step === 'otp' && (
              <div className="space-y-4">
                <p className="text-sm text-charcoal-muted text-center">
                  Chúng tôi sẽ gửi mã OTP đến số điện thoại của bạn
                </p>
                <Input
                  label="Số điện thoại"
                  type="tel"
                  value={otpForm.phone}
                  onChange={(e) => setOtpForm({ ...otpForm, phone: e.target.value })}
                  placeholder="VD: 0901234567"
                  icon={<Phone className="w-4 h-4" />}
                />
                
                {countdown > 0 ? (
                  <div className="text-center text-sm text-charcoal-muted">
                    Gửi lại mã sau <span className="font-bold text-terracotta">{countdown}s</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={sendOTP}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      'Gửi mã OTP'
                    )}
                  </Button>
                )}

                <div className="border-t border-stone-200 pt-4">
                  <Input
                    label="Mã OTP"
                    type="text"
                    maxLength={6}
                    value={otpForm.otp}
                    onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, '') })}
                    placeholder="Nhập mã 6 chữ số"
                    icon={<Lock className="w-4 h-4" />}
                    className="text-center tracking-widest font-mono"
                  />
                </div>

                <p className="text-xs text-charcoal-muted text-center">
                  Chưa có tài khoản?{' '}
                  <Link href="/register" className="text-terracotta font-medium hover:underline">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>
            )}

            {/* Step 3: New Password */}
            {step === 'password' && (
              <div className="space-y-4">
                <p className="text-sm text-charcoal-muted text-center">
                  Nhập mật khẩu mới cho tài khoản của bạn
                </p>
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Ít nhất 6 ký tự"
                  icon={<Lock className="w-4 h-4" />}
                />
                <Input
                  label="Xác nhận mật khẩu"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Nhập lại mật khẩu mới"
                  icon={<Lock className="w-4 h-4" />}
                />
              </div>
            )}

            {/* Step 4: Success */}
            {step === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-charcoal-muted mb-6">
                  Mật khẩu của bạn đã được đặt lại thành công!
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            {/* Step 1: Email Submit */}
            {step === 'email' && (
              <Button
                onClick={() => setStep('otp')}
                className="w-full"
                disabled={!emailForm.email}
              >
                Tiếp tục
              </Button>
            )}

            {/* Step 2: OTP Verify */}
            {step === 'otp' && (
              <Button
                onClick={verifyOTP}
                className="w-full"
                disabled={isLoading || otpForm.otp.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  'Xác thực OTP'
                )}
              </Button>
            )}

            {/* Step 3: Password Submit */}
            {step === 'password' && (
              <Button
                onClick={resetPassword}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  'Đặt lại mật khẩu'
                )}
              </Button>
            )}

            {/* Step 4: Go to Login */}
            {step === 'success' && (
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Đăng nhập ngay
              </Button>
            )}

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-charcoal-muted hover:text-terracotta transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng nhập
            </Link>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-stone-400">
        <p>© 2025 DigiStay Technology Systems JSC</p>
      </footer>
    </div>
  )
}
