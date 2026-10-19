'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const [form, setForm] = React.useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const [step, setStep] = React.useState<'form' | 'verify'>('form')
  const [pendingUser, setPendingUser] = React.useState<{ userId: string; email: string } | null>(null)
  const [otp, setOtp] = React.useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = React.useState('')
  const [resendCooldown, setResendCooldown] = React.useState(0)

  const passwordStrength = React.useMemo(() => {
    const p = form.password
    if (!p) return { score: 0, label: '', color: '' }
    let score = 0
    if (p.length >= 6) score++
    if (p.length >= 10) score++
    if (/[A-Z]/.test(p)) score++
    if (/\d/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++

    if (score <= 1) return { score, label: 'Yếu', color: 'bg-error' }
    if (score <= 3) return { score, label: 'Trung bình', color: 'bg-terracotta-400' }
    return { score, label: 'Mạnh', color: 'bg-tertiary' }
  }, [form.password])

  const usernameStatus = React.useMemo(() => {
    const u = form.username
    if (!u) return { valid: false, message: '' }
    if (u.length < 3) return { valid: false, message: 'Tối thiểu 3 ký tự' }
    if (u.length > 30) return { valid: false, message: 'Tối đa 30 ký tự' }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      return { valid: false, message: 'Chỉ chứa chữ, số và _' }
    }
    return { valid: true, message: 'Hợp lệ' }
  }, [form.username])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name || form.name.length < 2) {
      setError('Vui lòng nhập họ và tên')
      return
    }
    if (!usernameStatus.valid) {
      setError(usernameStatus.message)
      return
    }
    if (!form.email) {
      setError('Vui lòng nhập email')
      return
    }
    if (form.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu không khớp')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi khi đăng ký')
        setIsLoading(false)
        return
      }

      // If email verification required, go to OTP step
      if (data.data?.requiresVerification) {
        setPendingUser({
          userId: data.data.userId,
          email: data.data.email,
        })
        setStep('verify')
        setResendCooldown(60)
        setIsLoading(false)
        return
      }

      // Otherwise, sign in directly
      await completeSignIn()
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
      setIsLoading(false)
    }
  }

  const completeSignIn = async () => {
    const result = await signIn('credentials', {
      username: form.username,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      router.push('/login')
    } else {
      router.push('/workspaces')
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
    setOtpError('')

    // Auto focus next
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setOtpError('')

    const code = otp.join('')
    if (code.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số')
      return
    }

    if (!pendingUser) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingUser.email,
          userId: pendingUser.userId,
          otp: code,
          purpose: 'verify_otp',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setOtpError(data.error || 'Mã OTP không hợp lệ')
        setIsLoading(false)
        return
      }

      // Verified! Sign in
      await completeSignIn()
    } catch {
      setOtpError('Đã xảy ra lỗi, vui lòng thử lại')
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingUser) return
    setOtpError('')
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingUser.email,
          purpose: 'register',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResendCooldown(60)
        setOtp(['', '', '', '', '', ''])
      } else {
        setOtpError(data.error || 'Không thể gửi lại mã')
      }
    } catch {
      setOtpError('Không thể gửi lại mã')
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-terracotta-700 via-primary to-terracotta-600">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80')",
        }}
      />
      {/* Background morph blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-primary-fixed/40 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-terracotta-300/40 blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-primary-container/30 blur-3xl animate-pulse-slow animation-delay-4000" />
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
                Bắt đầu miễn phí <span className="font-serif italic font-medium text-primary-fixed">14 ngày</span>
              </h1>
              <p className="text-body-md lg:text-body-lg text-on-primary/85">
                Tạo tài khoản để mở khoá toàn bộ hệ điều hành quản lý khách sạn — không cần thẻ tín dụng.
              </p>
              <ul className="space-y-3 pt-2">
                <Feature icon="check_circle" text="Dùng thử đầy đủ tính năng" />
                <Feature icon="check_circle" text="Chạy trên cloud, không cần cài đặt" />
                <Feature icon="check_circle" text="Hỗ trợ 24/7 từ đội ngũ Việt Nam" />
              </ul>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-on-primary/60">
              <span>© 2026 DigiStay</span>
              <div className="flex items-center gap-4">
                <Link href="#" className="hover:text-on-primary transition-colors">Bảo mật</Link>
                <Link href="#" className="hover:text-on-primary transition-colors">Hỗ trợ</Link>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="p-8 lg:p-12 flex flex-col justify-center bg-surface-container-lowest max-h-[90vh] overflow-y-auto">
            <div className="w-full max-w-sm mx-auto space-y-5 my-4">
              {step === 'form' ? (
                <>
                  <div>
                    <h2 className="text-headline-md font-bold text-on-surface">Tạo tài khoản</h2>
                    <p className="text-body-md text-on-surface-variant mt-1.5">
                      Điền thông tin bên dưới để bắt đầu
                    </p>
                  </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-container border border-error/20 text-on-error-container text-body-sm flex items-start gap-2 animate-fade-in-up">
                  <MaterialSymbol name="error" size={20} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3.5">
                <Field
                  label="Họ và tên"
                  icon="badge"
                  type="text"
                  value={form.name}
                  placeholder="Nguyễn Văn A"
                  onChange={(v) => setForm({ ...form, name: v })}
                />

                <div>
                  <Field
                    label="Tên đăng nhập"
                    icon="alternate_email"
                    type="text"
                    value={form.username}
                    placeholder="nguyenvana"
                    onChange={(v) => setForm({ ...form, username: v.replace(/[^a-zA-Z0-9_]/g, '') })}
                    rightIcon={
                      form.username
                        ? usernameStatus.valid
                          ? 'check_circle'
                          : 'error'
                        : undefined
                    }
                    rightIconClass={
                      form.username
                        ? usernameStatus.valid
                          ? 'text-tertiary'
                          : 'text-error'
                        : ''
                    }
                  />
                  {form.username && (
                    <p className={`text-label-md mt-1 ${usernameStatus.valid ? 'text-tertiary' : 'text-error'}`}>
                      {usernameStatus.message}
                    </p>
                  )}
                </div>

                <Field
                  label="Email"
                  icon="mail"
                  type="email"
                  value={form.email}
                  placeholder="email@example.com"
                  onChange={(v) => setForm({ ...form, email: v })}
                />

                <Field
                  label="Số điện thoại"
                  icon="phone"
                  type="tel"
                  value={form.phone}
                  placeholder="0xxx xxx xxx"
                  onChange={(v) => setForm({ ...form, phone: v.replace(/[^0-9]/g, '').slice(0, 10) })}
                />

                <div>
                  <div className="relative">
                    <Field
                      label="Mật khẩu"
                      icon="lock"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      placeholder="Ít nhất 8 ký tự"
                      onChange={(v) => setForm({ ...form, password: v })}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                          tabIndex={-1}
                        >
                          <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                        </button>
                      }
                    />
                  </div>
                  {form.password && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength.score ? passwordStrength.color : 'bg-surface-container-high'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-label-md text-on-surface-variant">{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                <Field
                  label="Xác nhận mật khẩu"
                  icon="lock_reset"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  placeholder="Nhập lại mật khẩu"
                  onChange={(v) => setForm({ ...form, confirmPassword: v })}
                  rightIcon={
                    form.confirmPassword && form.confirmPassword === form.password
                      ? 'check_circle'
                      : undefined
                  }
                  rightIconClass="text-tertiary"
                />

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20 accent-primary"
                  />
                  <span className="text-body-sm text-on-surface-variant">
                    Tôi đồng ý với{' '}
                    <Link href="/terms" className="text-primary hover:underline">Điều khoản</Link>
                    {' '}và{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Chính sách bảo mật</Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      Đang tạo tài khoản...
                    </>
                  ) : (
                    <>
                      Tạo tài khoản
                      <MaterialSymbol name="arrow_forward" size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-body-sm text-on-surface-variant">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-primary hover:text-primary-hover font-semibold transition-colors">
                  Đăng nhập
                </Link>
              </p>
                </>
              ) : (
                <>
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center mb-3">
                      <MaterialSymbol name="mark_email_read" size={28} className="text-primary" />
                    </div>
                    <h2 className="text-headline-md font-bold text-on-surface">Xác thực email</h2>
                    <p className="text-body-md text-on-surface-variant mt-1.5">
                      Chúng tôi đã gửi mã 6 chữ số đến{' '}
                      <span className="font-semibold text-on-surface">{pendingUser?.email}</span>.<br />
                      Vui lòng nhập mã để hoàn tất đăng ký.
                    </p>
                  </div>

                  {otpError && (
                    <div className="p-3 rounded-xl bg-error-container border border-error/20 text-on-error-container text-body-sm flex items-start gap-2 animate-fade-in-up">
                      <MaterialSymbol name="error" size={20} className="flex-shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div className="flex justify-center gap-2">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-14 text-center text-headline-sm font-bold rounded-xl bg-surface-container-low border-2 border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                          Đang xác thực...
                        </>
                      ) : (
                        <>
                          Xác nhận
                          <MaterialSymbol name="check" size={20} className="group-hover:scale-110 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>

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
                      setStep('form')
                      setOtp(['', '', '', '', '', ''])
                      setOtpError('')
                    }}
                    className="w-full text-center text-body-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center gap-1"
                  >
                    <MaterialSymbol name="arrow_back" size={16} />
                    Quay lại đăng ký
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  icon: string
  type: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  rightIcon?: string
  rightIconClass?: string
  rightSlot?: React.ReactNode
}

function Field({ label, icon, type, value, placeholder, onChange, rightIcon, rightIconClass, rightSlot }: FieldProps) {
  return (
    <div>
      <label className="block text-label-lg text-on-surface mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <MaterialSymbol name={icon} size={20} />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {rightSlot}
        {!rightSlot && rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <MaterialSymbol name={rightIcon} size={20} className={rightIconClass} />
          </span>
        )}
      </div>
    </div>
  )
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-center gap-3 text-body-md text-on-primary/90">
      <span className="w-6 h-6 rounded-full bg-on-primary/20 flex items-center justify-center flex-shrink-0">
        <MaterialSymbol name={icon} size={16} className="text-on-primary" />
      </span>
      {text}
    </li>
  )
}
