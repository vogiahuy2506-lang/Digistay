'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MaterialSymbol } from '@/components/ui/material-symbol'
import { TWO_FACTOR_QUERY, TWO_FACTOR_REQUIRED } from '@/lib/auth/two-factor-shared'
import { TwoFactorStep } from './two-factor-step'

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isResending, setIsResending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [unverifiedEmail, setUnverifiedEmail] = React.useState('')
  // Set when the account has two-factor on: the code step replaces the form.
  const [challenge, setChallenge] = React.useState<string | null>(null)

  // Google sign-in with two-factor on lands here with ?twoFactor=<challenge>.
  // Read it once and drop it from the address bar and history.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromGoogle = params.get(TWO_FACTOR_QUERY)
    if (fromGoogle) {
      setChallenge(fromGoogle)
      params.delete(TWO_FACTOR_QUERY)
      const rest = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
    }
  }, [])

  const goToApp = () => {
    router.push('/workspaces')
    router.refresh()
  }

  const [form, setForm] = React.useState({
    username: '',
    password: '',
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setUnverifiedEmail('')

    try {
      const result = await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      })

      if (result?.error?.startsWith(TWO_FACTOR_REQUIRED)) {
        setChallenge(result.error.slice(TWO_FACTOR_REQUIRED.length))
        setIsLoading(false)
        return
      }

      if (result?.error) {
        // Map NextAuth error messages to Vietnamese user-friendly messages
        const errMsg = result.error
        if (errMsg.includes('xác thực email')) {
          setUnverifiedEmail(form.username)
          setError(errMsg) // Already Vietnamese
        } else if (errMsg.includes('không chính xác') || errMsg.includes('not match')) {
          setError('Tên đăng nhập hoặc mật khẩu không chính xác')
        } else if (errMsg.includes('quá nhiều lần') || errMsg.includes('tạm khoá')) {
          setError(errMsg) // brute-force limits, already Vietnamese
        } else {
          setError('Đã xảy ra lỗi, vui lòng thử lại')
        }
        setIsLoading(false)
        return
      }

      goToApp()
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return
    setIsResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      const data = await res.json()
      if (data.success) {
        setError('')
        // Redirect to register verify step with email
        router.push(`/register?email=${encodeURIComponent(unverifiedEmail)}&resend=1`)
      } else {
        setError(data.error || 'Không thể gửi lại mã')
      }
    } catch {
      setError('Không thể gửi lại mã')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-terracotta-700 via-primary to-terracotta-600">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80')",
        }}
      />
      {/* Background morph blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-primary-fixed/40 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-terracotta-300/40 blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/30 blur-3xl animate-pulse-slow animation-delay-4000" />
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
                <MaterialSymbol name="hotel" size={26} className="text-on-primary" />
              </div>
              <div>
                <div className="text-lg font-bold">DigiStay</div>
                <div className="text-xs text-on-primary/70">Quản lý khách sạn</div>
              </div>
            </div>

            <div className="relative z-10 space-y-5 my-8 lg:my-0">
              <h1 className="text-headline-lg-mobile lg:text-headline-xl font-display-hero leading-tight">
                Khách sạn đầy phòng,{' '}
                <span className="font-serif italic font-medium text-primary-fixed">đội ngũ thở phào</span>
              </h1>
              <p className="text-body-md lg:text-body-lg text-on-primary/85">
                DigiStay gom booking, lễ tân và hoá đơn vào một màn hình. Bạn nhìn thấy hôm nay bao nhiêu phòng trống, khách nào sắp đến, doanh thu tuần này — trước cốc cà phê sáng.
              </p>
              <ul className="space-y-3 pt-2">
                <Feature icon="trending_up" text="Báo cáo doanh thu cập nhật mỗi 60 giây" />
                <Feature icon="event_available" text="Check-in online — khách vào phòng không cần xếp hàng" />
                <Feature icon="support_agent" text="Hỗ trợ tiếng Việt từ 7h sáng đến 11h đêm" />
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
          <div className="p-8 lg:p-12 flex flex-col justify-center bg-surface-container-lowest">
            {challenge ? (
              <div className="w-full max-w-sm mx-auto">
                <TwoFactorStep
                  challenge={challenge}
                  onSuccess={goToApp}
                  onCancel={() => {
                    setChallenge(null)
                    setForm({ ...form, password: '' })
                  }}
                />
              </div>
            ) : (
            <div className="w-full max-w-sm mx-auto space-y-7">
              <div>
                <h2 className="text-headline-md font-bold text-on-surface">Đăng nhập</h2>
                <p className="text-body-md text-on-surface-variant mt-2">
                Chào mừng bạn quay trở lại DigiStay.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-container border border-error/20 text-on-error-container text-body-sm flex flex-col gap-2 animate-fade-in-up">
                  <div className="flex items-start gap-2">
                    <MaterialSymbol name="error" size={20} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  {unverifiedEmail && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResending}
                      className="ml-7 self-start text-body-sm text-primary hover:text-primary-hover font-semibold transition-colors disabled:opacity-50"
                    >
                      {isResending ? 'Đang gửi...' : 'Gửi lại mã xác thực →'}
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">
                    Tên đăng nhập
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <MaterialSymbol name="person" size={20} />
                    </span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="VD: nguyenvana"
                      autoComplete="username"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <MaterialSymbol name="lock" size={20} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Nhập mật khẩu"
                      autoComplete="current-password"
                      className="w-full pl-12 pr-12 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                      disabled={isLoading}
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

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20 accent-primary"
                    />
                    <span className="text-body-sm text-on-surface-variant">Ghi nhớ đăng nhập</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-body-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      Đang đăng nhập...
                    </>
                  ) : (
                    <>
                      Đăng nhập
                      <MaterialSymbol name="arrow_forward" size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-surface-container-lowest text-label-md text-on-surface-variant">HOẶC TIẾP TỤC VỚI</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/workspaces' })}
                className="w-full py-3 px-4 bg-surface-container-low border border-outline-variant rounded-xl text-body-md text-on-surface flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Tiếp tục bằng Google
              </button>
              <p className="text-center text-label-md text-on-surface-variant/80">
                Một chạm — không cần nhớ mật khẩu.
              </p>

              <p className="text-center text-body-sm text-on-surface-variant">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-primary hover:text-primary-hover font-semibold transition-colors">
                  Tạo miễn phí trong 2 phút →
                </Link>
              </p>
            </div>
            )}
          </div>
        </div>
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
