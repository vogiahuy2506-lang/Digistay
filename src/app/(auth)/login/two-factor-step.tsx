'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { MaterialSymbol } from '@/components/ui/material-symbol'
import { TWO_FACTOR_PROVIDER } from '@/lib/auth/two-factor-shared'

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-center text-headline-sm tracking-[0.3em] text-on-surface placeholder:text-on-surface-variant/40 placeholder:tracking-normal placeholder:text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all'

/**
 * Second sign-in step for accounts with two-factor on: the password (or
 * Google) was right and the server answered with a challenge; signs in
 * with the `two-factor` provider once the code is right.
 */
export function TwoFactorStep({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [code, setCode] = React.useState('')
  const [useRecoveryCode, setUseRecoveryCode] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const result = await signIn(TWO_FACTOR_PROVIDER, { challenge, code, redirect: false })
      if (result?.error) {
        // Server messages are already Vietnamese; next-auth's own are not.
        setError(result.error === 'CredentialsSignin' ? 'Mã xác thực không đúng' : result.error)
        setCode('')
        setIsLoading(false)
        return
      }
      onSuccess()
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setUseRecoveryCode(!useRecoveryCode)
    setCode('')
    setError('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold text-on-surface">Nhập mã xác thực</h2>
        <p className="text-body-md text-on-surface-variant mt-2">
          {useRecoveryCode
            ? 'Nhập một trong các mã khôi phục bạn đã lưu khi bật xác thực hai lớp. Mỗi mã chỉ dùng được một lần.'
            : 'Mở ứng dụng xác thực trên điện thoại (Google Authenticator, Microsoft Authenticator, Mật khẩu của iPhone...) và nhập mã 6 số của DigiStay.'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error-container border border-error/20 text-on-error-container text-body-sm flex items-start gap-2 animate-fade-in-up">
          <MaterialSymbol name="error" size={20} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {useRecoveryCode ? (
          <input
            key="recovery"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            className={INPUT_CLASS}
            required
            autoFocus
            disabled={isLoading}
          />
        ) : (
          <input
            key="totp"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 số"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            className={INPUT_CLASS}
            required
            autoFocus
            disabled={isLoading}
          />
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-primary to-terracotta-600 hover:from-primary-hover hover:to-terracotta-700 text-on-primary text-label-lg rounded-xl shadow-luxury hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            'Xác nhận'
          )}
        </button>
      </form>

      <div className="flex items-center justify-between text-body-sm">
        <button
          type="button"
          onClick={onCancel}
          className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
        >
          <MaterialSymbol name="arrow_back" size={18} />
          Quay lại
        </button>
        <button
          type="button"
          onClick={switchMode}
          className="text-primary hover:text-primary-hover font-semibold transition-colors"
        >
          {useRecoveryCode ? 'Dùng mã từ ứng dụng' : 'Dùng mã khôi phục'}
        </button>
      </div>
    </div>
  )
}
