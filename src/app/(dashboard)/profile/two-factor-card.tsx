'use client'

import * as React from 'react'
import { signOut } from 'next-auth/react'
import { Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

interface Status {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesLeft: number
  requiresPassword: boolean
}

type View = 'status' | 'setup' | 'codes' | 'regenerate' | 'disable'

const INPUT_CLASS =
  'w-full px-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-sm font-medium text-charcoal placeholder-stone-400 focus-visible:bg-white focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all outline-none'

async function post(path: string, body?: object) {
  const res = await fetch(`/api/users/me/two-factor${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.error || 'Đã xảy ra lỗi, vui lòng thử lại')
  return data
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Mã 6 số trong ứng dụng, hoặc một mã khôi phục"
      autoComplete="one-time-code"
      className={INPUT_CLASS}
    />
  )
}

/**
 * Optional two-factor sign-in (Part 4f), in the profile's security tab.
 * Users turn it on themselves; nothing here makes it required.
 */
export function TwoFactorCard() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [view, setView] = React.useState<View>('status')
  const [setup, setSetup] = React.useState<{ secret: string; qrDataUrl: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([])
  const [signOutAfterCodes, setSignOutAfterCodes] = React.useState(false)
  const [codesSaved, setCodesSaved] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/users/me/two-factor')
      const data = await res.json()
      if (data.success) setStatus(data.data)
    } catch {
      setError('Không tải được trạng thái xác thực hai lớp')
    }
  }, [])

  React.useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const go = (next: View) => {
    setView(next)
    setCode('')
    setPassword('')
    setError('')
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setBusy(false)
    }
  }

  const startSetup = () =>
    run(async () => {
      const { data } = await post('/setup')
      setSetup(data)
      go('setup')
    })

  const enable = () =>
    run(async () => {
      const { data } = await post('/enable', { code })
      setRecoveryCodes(data.recoveryCodes)
      setSignOutAfterCodes(true)
      setCodesSaved(false)
      setSetup(null)
      go('codes')
    })

  const regenerate = () =>
    run(async () => {
      const { data } = await post('/recovery-codes', { code })
      setRecoveryCodes(data.recoveryCodes)
      setSignOutAfterCodes(false)
      setCodesSaved(false)
      go('codes')
    })

  const disable = () =>
    run(async () => {
      await post('/disable', { code, password })
      go('status')
      setNotice('Đã tắt xác thực hai lớp.')
      await loadStatus()
    })

  const finishCodes = async () => {
    setRecoveryCodes([])
    if (signOutAfterCodes) {
      // Turning it on signed out every device, this one included.
      await signOut({ callbackUrl: '/login' })
      return
    }
    go('status')
    await loadStatus()
  }

  const codesText = () =>
    [
      `Mã khôi phục DigiStay (${new Date().toLocaleDateString('vi-VN')})`,
      'Mỗi mã dùng được một lần, khi không có điện thoại để lấy mã.',
      '',
      ...recoveryCodes,
    ].join('\n')

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codesText())
    setNotice('Đã sao chép các mã khôi phục.')
  }

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'digistay-ma-khoi-phuc.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Xác thực hai lớp
          {status?.enabled && (
            <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              Đang bật
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        {view === 'status' && status && !status.enabled && (
          <>
            <p className="text-sm text-gray-600">
              Không bắt buộc. Khi bật, ngoài mật khẩu (hoặc Google) bạn cần nhập thêm mã 6 số từ ứng dụng trên
              điện thoại. Kẻ gian có được mật khẩu của bạn cũng không đăng nhập được.
            </p>
            <div className="flex justify-end">
              <Button onClick={startSetup} isLoading={busy}>
                Bật xác thực hai lớp
              </Button>
            </div>
          </>
        )}

        {view === 'status' && status?.enabled && (
          <>
            <p className="text-sm text-gray-600">
              Đã bật từ {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString('vi-VN') : ''}. Còn{' '}
              <span className={status.recoveryCodesLeft <= 2 ? 'font-semibold text-red-600' : 'font-semibold'}>
                {status.recoveryCodesLeft} mã khôi phục
              </span>
              {status.recoveryCodesLeft <= 2 && ' — nên tạo bộ mã mới'}.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => go('regenerate')}>
                Tạo bộ mã khôi phục mới
              </Button>
              <Button variant="danger" onClick={() => go('disable')}>
                Tắt xác thực hai lớp
              </Button>
            </div>
          </>
        )}

        {view === 'setup' && setup && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Bước 1 — Cài ứng dụng xác thực
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Google Authenticator hoặc Microsoft Authenticator (App Store, Google Play). iPhone có sẵn ứng
                dụng Mật khẩu cũng dùng được.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Bước 2 — Quét mã QR bằng ứng dụng đó</p>
              <p className="text-sm text-gray-600 mt-1">
                Trong ứng dụng, chọn thêm tài khoản rồi quét mã. Trên iPhone, quét bằng Camera sẽ mở ứng dụng
                Mật khẩu — vẫn đúng, cứ làm tiếp.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from our API */}
              <img src={setup.qrDataUrl} alt="Mã QR xác thực hai lớp" className="w-48 h-48 mt-3 border rounded-lg" />
              <p className="text-sm text-gray-600 mt-3">Đang mở trang này trên điện thoại? Nhập khoá này vào ứng dụng:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="px-3 py-2 bg-stone-100 rounded-lg text-sm tracking-wider break-all">
                  {setup.secret.match(/.{1,4}/g)?.join(' ')}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(setup.secret).then(() => setNotice('Đã sao chép khoá.'))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Bước 3 — Nhập mã 6 số ứng dụng hiện ra</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 số"
                className={`${INPUT_CLASS} mt-2 max-w-[12rem] tracking-[0.3em] placeholder:tracking-normal`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                Huỷ
              </Button>
              <Button onClick={enable} isLoading={busy} disabled={code.length !== 6}>
                Bật
              </Button>
            </div>
          </div>
        )}

        {view === 'codes' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <p className="font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Lưu các mã khôi phục này ở nơi an toàn
              </p>
              <p className="mt-1">
                Mất điện thoại thì dùng một mã thay cho mã 6 số; mỗi mã dùng được một lần. Các mã chỉ hiện{' '}
                <strong>một lần duy nhất</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c} className="px-3 py-2 bg-stone-100 rounded-lg text-center">
                  {c}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy className="w-4 h-4 mr-2" /> Sao chép
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCodes}>
                <Download className="w-4 h-4 mr-2" /> Tải xuống
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} />
              Tôi đã lưu các mã khôi phục
            </label>
            {signOutAfterCodes && (
              <p className="text-sm text-gray-600">
                Xác thực hai lớp đã bật. Mọi thiết bị đã được đăng xuất; hãy đăng nhập lại bằng mật khẩu và mã 6
                số.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={finishCodes} disabled={!codesSaved}>
                {signOutAfterCodes ? 'Xong, đăng nhập lại' : 'Xong'}
              </Button>
            </div>
          </div>
        )}

        {view === 'regenerate' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Bộ mã mới sẽ thay toàn bộ mã cũ (mã cũ không dùng được nữa).
            </p>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                Huỷ
              </Button>
              <Button onClick={regenerate} isLoading={busy} disabled={!code.trim()}>
                Tạo bộ mã mới
              </Button>
            </div>
          </div>
        )}

        {view === 'disable' && status && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Sau khi tắt, đăng nhập chỉ cần mật khẩu (hoặc Google).</p>
            {status.requiresPassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu hiện tại"
                autoComplete="current-password"
                className={INPUT_CLASS}
              />
            )}
            <CodeInput value={code} onChange={setCode} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                Huỷ
              </Button>
              <Button
                variant="danger"
                onClick={disable}
                isLoading={busy}
                disabled={!code.trim() || (status.requiresPassword && !password)}
              >
                Tắt xác thực hai lớp
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
