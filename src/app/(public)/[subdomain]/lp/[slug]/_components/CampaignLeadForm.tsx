'use client'

import * as React from 'react'
import { Send, CheckCircle2, Sparkles, Loader2, Phone, Mail, User } from 'lucide-react'

export function CampaignLeadForm({
  propertyId,
  landingPageId,
  title,
  subtitle,
  primaryColor,
}: {
  propertyId: string
  landingPageId?: string
  title: string
  subtitle?: string
  primaryColor?: string
}) {
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [couponCode, setCouponCode] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          landingPageId,
          email: email.trim(),
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          source: 'LANDING_PAGE',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(true)
        if (data.data?.coupon?.code) {
          setCouponCode(data.data.coupon.code)
        }
      } else {
        setError(data.error || 'Không thể gửi thông tin. Vui lòng thử lại.')
      }
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl p-6 sm:p-10 border bg-card text-center space-y-4 max-w-xl mx-auto shadow-sm">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Sparkles className="w-6 h-6" />
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-fg">{title}</h2>
      {subtitle && <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">{subtitle}</p>}

      {success ? (
        <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
          <div className="font-semibold text-sm">Đăng ký nhận ưu đãi thành công!</div>
          <p className="text-xs text-muted">
            Bộ phận lễ tân sẽ liên hệ hỗ trợ báo giá và tư vấn cho bạn trong thời gian sớm nhất.
          </p>
          {couponCode && (
            <div className="mt-3 pt-3 border-t border-emerald-500/20">
              <span className="text-xs block text-muted mb-1">Mã ưu đãi đặc quyền của bạn:</span>
              <span className="font-mono font-bold text-base bg-card px-3 py-1 rounded border inline-block text-fg">
                {couponCode}
              </span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-fg block mb-1">Họ tên của bạn</label>
              <div className="relative">
                <User className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs text-fg placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-fg block mb-1">Số điện thoại / Zalo</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="tel"
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs text-fg placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-fg block mb-1">
              Địa chỉ Email <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs text-fg placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: primaryColor || '#3B82F6' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang gửi thông tin...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Nhận Báo Giá & Ưu Đãi Ngay
                </>
              )}
            </button>
          </div>
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          <p className="text-[11px] text-muted text-center pt-1">
            Chúng tôi cam kết bảo mật 100% thông tin cá nhân của bạn.
          </p>
        </form>
      )}
    </div>
  )
}
