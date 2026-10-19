'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

type Step = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>('email')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [info, setInfo] = React.useState('')

  const [emailForm, setEmailForm] = React.useState({ email: '' })
  const [otp, setOtp] = React.useState(['', '', '', '', '', ''])
  // Single-use token from /api/auth/otp/verify; reset-password requires it.
  const [resetToken, setResetToken] = React.useState('')
  const [resendCooldown, setResendCooldown] = React.useState(0)
  const [passwordForm, setPasswordForm] = React.useState({
    newPassword: '',
    confirmPassword: '',
  })

  const sendResetLink = async () => {
    if (!emailForm.email) {
      setError('Vui lòng nhập email')
      return
    }

    setIsLoading(true)
    setError('')
    setInfo('')

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForm.email,
          purpose: 'forgot_password',
        }),
      })

      const data = await res.json()

      if (data.success) {
        setInfo('Mã OTP đã được gửi đến email. Vui lòng kiểm tra hộp thư.')
        setStep('otp')
        setResendCooldown(60)
      } else {
        setError(data.error || 'Không thể gửi mã')
      }
    } catch {
      setError('Đã xảy ra lỗi khi gửi mã')
    } finally {
      setIsLoading(false)
    }
  }

  // Resend countdown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')

    if (value && index < 5) {
      const next = document.getElementById(`fotp-${index + 1}`)
      next?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`fotp-${index - 1}`)
      prev?.focus()
    }
  }

  const verifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForm.email,
          otp: code,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setResetToken(data.resetToken)
        setStep('password')
        setInfo('')
      } else {
        setError(data.error || 'Mã OTP không hợp lệ')
      }
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError('')
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForm.email,
          purpose: 'forgot_password',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResendCooldown(60)
        setOtp(['', '', '', '', '', ''])
        setInfo('Mã OTP mới đã được gửi đến email của bạn')
      } else {
        setError(data.error || 'Không thể gửi lại mã')
      }
    } catch {
      setError('Không thể gửi lại mã')
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Mật khẩu không khớp')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setStep('success')
      } else {
        setError(data.error || 'Đã xảy ra lỗi khi đặt lại mật khẩu')
      }
    } catch {
      setError('Đã xảy ra lỗi khi đặt lại mật khẩu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-terracotta-700 via-primary to-terracotta-600">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&q=80')",
        }}
      />
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-fixed/40 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-terracotta-300/40 blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-primary-container/30 blur-3xl animate-pulse-slow animation-delay-4000" />
      </div>

      {/* Centered card */}
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 animate-fade-in-up">
          {/* Left Brand Panel */}
          <div className="relative bg-gradient-to-br from-primary via-primary-container to-terracotta-700 p-8 lg:p-12 text-on-primary flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary-fixed blur-3xl animate-morph-1" />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-terracotta-300 blur-3xl animate-morph-2" />
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-on-primary/15 backdrop-blur-md flex items-center justify-center">
                <MaterialSymbol name="apartment" size={26} className="text-on-primary" />
              </div>
              <div>
                <div className="text-lg font-bold">DigiStay</div>
                <div className="text-xs text-on-primary/70">Hotel OS</div>
              </div>
            </div>

            <div className="relative z-10 space-y-5 my-8 lg:my-0">
              <h1 className="text-headline-lg-mobile lg:text-headline-xl font-display-hero leading-tight">
                Khôi phục <span className="font-serif italic font-medium text-primary-fixed">quyền truy cập</span>
              </h1>
              <p className="text-body-md lg:text-body-lg text-on-primary/85">
                Nhập email đã đăng ký để nhận mã xác thực và đặt lại mật khẩu mới một cách an toàn.
              </p>
              <ul className="space-y-3 pt-2">
                <StepFeature n={1} text="Nhập email đã đăng ký" />
                <StepFeature n={2} text="Nhận mã OTP qua email" />
                <StepFeature n={3} text="Đặt mật khẩu mới" />
              </ul>
            </div>

            <div className="relative z-10 text-xs text-on-primary/60">
              © 2026 DigiStay
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="p-8 lg:p-12 flex flex-col justify-center bg-surface-container-lowest">
            <div className="w-full max-w-sm mx-auto space-y-7">
              {/* Header */}
              <div>
                <h2 className="text-headline-md font-bold text-on-surface">
                  {step === 'success' ? 'Thành công!' : 'Quên mật khẩu'}
                </h2>
                <p className="text-body-md text-on-surface-variant mt-2">
                  {step === 'email' && 'Nhập email đã đăng ký để nhận mã xác thực'}
                  {step === 'otp' && 'Nhập mã OTP đã được gửi đến email của bạn'}
                  {step === 'password' && 'Đặt mật khẩu mới cho tài khoản của bạn'}
                  {step === 'success' && 'Mật khẩu đã được đặt lại thành công'}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-container border border-error/20 text-on-error-container text-body-sm flex items-start gap-2 animate-fade-in-up">
                  <MaterialSymbol name="error" size={20} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="p-3 rounded-xl bg-tertiary-fixed border border-tertiary/20 text-on-tertiary-fixed-variant text-body-sm flex items-start gap-2 animate-fade-in-up">
                  <MaterialSymbol name="info" size={20} className="flex-shrink-0 mt-0.5" />
                  <span>{info}</span>
                </div>
              )}

              {/* Step 1: Email */}
              {step === 'email' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">Email</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                        <MaterialSymbol name="mail" size={20} />
                      </span>
                      <input
                        type="email"
                        value={emailForm.email}
                        onChange={(e) => setEmailForm({ email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    onClick={sendResetLink}
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        Đang gửi mã...
                      </>
                    ) : (
                      <>
                        Gửi mã xác thực
                        <MaterialSymbol name="arrow_forward" size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 2: OTP */}
              {step === 'otp' && (
                <form onSubmit={verifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">
                      Mã xác thực
                    </label>
                    <p className="text-body-sm text-on-surface-variant mb-3">
                      Mã 6 chữ số đã được gửi đến{' '}
                      <span className="font-semibold text-on-surface">{emailForm.email}</span>
                    </p>
                    <div className="flex justify-center gap-2">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          id={`fotp-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-14 text-center text-headline-sm font-bold rounded-xl bg-surface-container-low border-2 border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        Đang xác thực...
                      </>
                    ) : (
                      <>
                        Xác nhận
                        <MaterialSymbol name="arrow_forward" size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  <div className="text-center text-body-sm text-on-surface-variant">
                    Không nhận được mã?{' '}
                    {resendCooldown > 0 ? (
                      <span className="text-on-surface-variant/60">
                        Gửi lại sau {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-primary hover:text-primary-hover font-semibold transition-colors"
                      >
                        Gửi lại
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('email')
                      setOtp(['', '', '', '', '', ''])
                      setError('')
                    }}
                    className="w-full text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                  >
                    ← Dùng email khác
                  </button>
                </form>
              )}

              {/* Step 3: Password */}
              {step === 'password' && (
                <form onSubmit={resetPassword} className="space-y-4">
                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">Mật khẩu mới</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                        <MaterialSymbol name="lock" size={20} />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Ít nhất 6 ký tự"
                        autoComplete="new-password"
                        className="w-full pl-12 pr-12 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                        tabIndex={-1}
                      >
                        <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-label-lg text-on-surface mb-1.5">Xác nhận mật khẩu</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                        <MaterialSymbol name="lock_reset" size={20} />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        className={`w-full pl-12 pr-12 py-3 rounded-xl bg-surface-container-low border text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 transition-all ${
                          passwordForm.confirmPassword && passwordForm.confirmPassword !== passwordForm.newPassword
                            ? 'border-error focus:border-error focus:ring-error/20'
                            : 'border-outline-variant focus:border-primary focus:ring-primary/20'
                        }`}
                      />
                      {passwordForm.confirmPassword && passwordForm.confirmPassword === passwordForm.newPassword && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          <MaterialSymbol name="check_circle" size={20} className="text-tertiary" />
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        Đang đặt lại...
                      </>
                    ) : (
                      <>
                        Đặt lại mật khẩu
                        <MaterialSymbol name="check" size={20} className="group-hover:scale-110 transition-transform" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="w-full text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                  >
                    ← Dùng email khác
                  </button>
                </form>
              )}

              {/* Step 3: Success */}
              {step === 'success' && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl bg-tertiary-fixed flex items-center justify-center mx-auto animate-scale-in-center">
                    <MaterialSymbol name="check_circle" size={48} className="text-tertiary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-body-md text-on-surface-variant">
                      Mật khẩu đã được đặt lại. Bạn có thể đăng nhập ngay bây giờ.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all flex items-center justify-center gap-2 group"
                  >
                    Đăng nhập ngay
                    <MaterialSymbol name="arrow_forward" size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {step !== 'success' && (
                <p className="text-center text-body-sm text-on-surface-variant">
                  <Link href="/login" className="text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-1 transition-colors">
                    <MaterialSymbol name="arrow_back" size={16} />
                    Quay lại đăng nhập
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepFeature({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-center gap-3 text-body-md text-on-primary/90">
      <span className="w-7 h-7 rounded-full bg-on-primary/20 flex items-center justify-center flex-shrink-0 text-label-lg font-semibold">
        {n}
      </span>
      {text}
    </li>
  )
}
