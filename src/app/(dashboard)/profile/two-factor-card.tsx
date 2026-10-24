'use client'

import * as React from 'react'
import { signOut } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiError } from '@/lib/i18n/api-errors'

interface Status {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesLeft: number
  requiresPassword: boolean
}

type View = 'status' | 'setup' | 'codes' | 'regenerate' | 'disable'

const INPUT_CLASS =
  'w-full px-4 py-3 bg-fg/[0.03] border border-line rounded-xl text-sm font-medium text-charcoal placeholder-muted focus-visible:bg-panel focus-visible:border-acc focus-visible:ring-2 focus-visible:ring-acc/20 transition-all outline-none'

async function post(path: string, body?: object) {
  const res = await fetch(`/api/users/me/two-factor${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  // No message from the API: the card shows its own (dash.common.states.error).
  if (!res.ok || !data.success) throw new Error(apiError(data.error) || '')
  return data
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('dash.account.twoFactor')
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('codeInputPlaceholder')}
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
  const t = useTranslations('dash.account.twoFactor')
  const tc = useTranslations('dash.common')
  const locale = useLocale()
  const dateLocale = locale === 'en' ? 'en-GB' : 'vi-VN'
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
      setError(t('loadFailed'))
    }
  }, [t])

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
      setError(e instanceof Error && e.message ? e.message : tc('states.error'))
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
      setNotice(t('disable.done'))
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
      t('codes.fileTitle', { date: new Date().toLocaleDateString(dateLocale) }),
      t('codes.fileHelp'),
      '',
      ...recoveryCodes,
    ].join('\n')

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codesText())
    setNotice(t('codes.copied'))
  }

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = t('codes.fileName')
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          {t('title')}
          {status?.enabled && (
            <span className="ml-2 text-xs font-semibold text-ok bg-ok-soft px-2 py-0.5 rounded-full">
              {t('on')}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-err">{error}</p>}
        {notice && <p className="text-sm text-ok">{notice}</p>}

        {view === 'status' && status && !status.enabled && (
          <>
            <p className="text-sm text-muted">{t('off.intro')}</p>
            <div className="flex justify-end">
              <Button onClick={startSetup} isLoading={busy}>
                {t('off.enable')}
              </Button>
            </div>
          </>
        )}

        {view === 'status' && status?.enabled && (
          <>
            <p className="text-sm text-muted">
              {t.rich(status.recoveryCodesLeft <= 2 ? 'status.enabledLow' : 'status.enabled', {
                date: status.enabledAt ? new Date(status.enabledAt).toLocaleDateString(dateLocale) : '',
                count: status.recoveryCodesLeft,
                b: (chunks) => (
                  <span className={status.recoveryCodesLeft <= 2 ? 'font-semibold text-err' : 'font-semibold'}>{chunks}</span>
                ),
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => go('regenerate')}>
                {t('status.regenerate')}
              </Button>
              <Button variant="danger" onClick={() => go('disable')}>
                {t('status.disable')}
              </Button>
            </div>
          </>
        )}

        {view === 'setup' && setup && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-fg flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> {t('setup.step1')}
              </p>
              <p className="text-sm text-muted mt-1">{t('setup.step1Help')}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-fg">{t('setup.step2')}</p>
              <p className="text-sm text-muted mt-1">{t('setup.step2Help')}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from our API */}
              <img src={setup.qrDataUrl} alt={t('setup.qrAlt')} className="w-48 h-48 mt-3 border rounded-lg" />
              <p className="text-sm text-muted mt-3">{t('setup.manualKey')}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="px-3 py-2 bg-fg/5 rounded-lg text-sm tracking-wider break-all">
                  {setup.secret.match(/.{1,4}/g)?.join(' ')}
                </code>
                <Button aria-label={tc('actions.copy')}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(setup.secret).then(() => setNotice(t('setup.keyCopied')))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-fg">{t('setup.step3')}</p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t('setup.codePlaceholder')}
                className={`${INPUT_CLASS} mt-2 max-w-[12rem] tracking-[0.3em] placeholder:tracking-normal`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                {t('cancel')}
              </Button>
              <Button onClick={enable} isLoading={busy} disabled={code.length !== 6}>
                {t('setup.enable')}
              </Button>
            </div>
          </div>
        )}

        {view === 'codes' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-warn-soft border border-warn/30 text-sm text-warn">
              <p className="font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> {t('codes.saveTitle')}
              </p>
              <p className="mt-1">{t.rich('codes.saveHelp', { strong: (chunks) => <strong>{chunks}</strong> })}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c} className="px-3 py-2 bg-fg/5 rounded-lg text-center">
                  {c}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy className="w-4 h-4 mr-2" /> {t('codes.copy')}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCodes}>
                <Download className="w-4 h-4 mr-2" /> {t('codes.download')}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input type="checkbox" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} />
              {t('codes.saved')}
            </label>
            {signOutAfterCodes && (
              <p className="text-sm text-muted">{t('codes.signedOut')}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={finishCodes} disabled={!codesSaved}>
                {signOutAfterCodes ? t('codes.doneSignIn') : t('codes.done')}
              </Button>
            </div>
          </div>
        )}

        {view === 'regenerate' && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('regenerate.intro')}</p>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                {t('cancel')}
              </Button>
              <Button onClick={regenerate} isLoading={busy} disabled={!code.trim()}>
                {t('regenerate.submit')}
              </Button>
            </div>
          </div>
        )}

        {view === 'disable' && status && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('disable.intro')}</p>
            {status.requiresPassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('disable.passwordPlaceholder')}
                autoComplete="current-password"
                className={INPUT_CLASS}
              />
            )}
            <CodeInput value={code} onChange={setCode} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go('status')}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={disable}
                isLoading={busy}
                disabled={!code.trim() || (status.requiresPassword && !password)}
              >
                {t('disable.submit')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
