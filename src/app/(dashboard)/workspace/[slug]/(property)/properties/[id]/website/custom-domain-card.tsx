'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { sslState } from '@/lib/public-site/ssl-state'

export interface DomainSettings {
  customDomain?: string | null
  domainVerificationStatus?: string | null
  sslEnabled?: boolean | null
  sslRequestedAt?: string | null
  sslError?: string | null
}

interface DnsRecord {
  type: string
  name: string
  value: string
}

interface Records {
  cname: DnsRecord
  a: DnsRecord[]
  txt: DnsRecord
}

/**
 * The hotel's own domain (plan item 18): type it, add the DNS records shown,
 * check (POST /api/website/domain/verify); once attached, its HTTPS
 * certificate comes within a minute (item 19, docker/certbot/custom-domains.sh)
 * and this card follows it (GET /api/website/ssl/provision).
 */
export function CustomDomainCard({
  propertyId,
  settings,
  onChange,
  onRemove,
}: {
  propertyId: string
  settings: DomainSettings
  /** Merge what the server says into the builder's settings (a later save must send the domain back). */
  onChange: (patch: DomainSettings) => void
  /** Save the settings without the domain (the builder's own save). */
  onRemove: () => Promise<boolean>
}) {
  const t = useTranslations('dash.website.domain')
  const [domain, setDomain] = React.useState('')
  const [checking, setChecking] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [records, setRecords] = React.useState<Records | null>(null)
  const [retrying, setRetrying] = React.useState(false)
  const attached = settings.customDomain && settings.domainVerificationStatus === 'verified' ? settings.customDomain : null
  const state = sslState({ ...settings, sslRequestedAt: settings.sslRequestedAt ?? null })

  // While the certificate is on its way, ask how it is going.
  React.useEffect(() => {
    if (state !== 'pending') return
    const id = setInterval(async () => {
      const res = await fetch(`/api/website/ssl/provision?propertyId=${encodeURIComponent(propertyId)}`).catch(() => null)
      const data = await res?.json().catch(() => null)
      if (data?.success) {
        onChange({ sslEnabled: data.data.sslEnabled, sslError: data.data.sslError, sslRequestedAt: data.data.sslRequestedAt })
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [state, propertyId, onChange])

  const check = async (host: string) => {
    setChecking(true)
    setProblem(null)
    try {
      const res = await fetch('/api/website/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, domain: host }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.data?.records) setRecords(data.data.records)
      if (res.ok && data.success) {
        onChange({
          customDomain: data.data.domain,
          domainVerificationStatus: 'verified',
          sslEnabled: false,
          sslError: null,
          sslRequestedAt: new Date().toISOString(),
        })
        setDomain('')
        toast.success(t('attached'))
      } else {
        setProblem(apiError(data.error) || t('checkFailed'))
      }
    } catch {
      setProblem(t('checkFailed'))
    } finally {
      setChecking(false)
    }
  }

  const retry = async () => {
    setRetrying(true)
    try {
      const res = await fetch('/api/website/ssl/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) toast.error(apiError(data.error) || t('retryFailed'))
      else onChange({ sslError: null, sslRequestedAt: new Date().toISOString() })
    } finally {
      setRetrying(false)
    }
  }

  const remove = async () => {
    if (!confirm(t('removeConfirm', { domain: attached ?? '' }))) return
    if (await onRemove()) {
      setRecords(null)
      onChange({ customDomain: null, domainVerificationStatus: null, sslEnabled: false, sslError: null, sslRequestedAt: null })
    }
  }

  return (
    <section aria-label={t('title')} className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" aria-hidden="true" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attached ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 break-all font-medium text-fg">{attached}</p>
                <Button type="button" variant="ghost" size="sm" onClick={remove}>
                  {t('remove')}
                </Button>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2 text-ok">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('dnsOk')}</span>
                </li>
                {state === 'active' && (
                  <li className="flex flex-wrap items-start gap-2 text-ok">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t('httpsOk')}</span>
                    <a href={`https://${attached}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-acc hover:underline">
                      {t('open')} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </li>
                )}
                {state === 'pending' && (
                  <li className="flex items-start gap-2 text-muted">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span>{t('httpsPending')}</span>
                  </li>
                )}
                {state === 'failed' && (
                  <li className="flex flex-wrap items-start gap-2 text-warn">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{t('httpsFailed')}</span>
                    <Button type="button" variant="outline" size="sm" onClick={retry} isLoading={retrying}>
                      {t('retry')}
                    </Button>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{t('intro')}</p>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (domain.trim()) void check(domain.trim())
                }}
              >
                <Input
                  aria-label={t('label')}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="www.khachsan.vn"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1"
                />
                <Button type="submit" isLoading={checking} disabled={!domain.trim()}>
                  {t('check')}
                </Button>
              </form>
              {problem && <p className="rounded-ctl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">{problem}</p>}
              {records && <DnsSteps records={records} />}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** The records to add at the domain's DNS provider. A records, not the CNAME: *.digistay.vn has no address of its own yet. */
function DnsSteps({ records }: { records: Records }) {
  const t = useTranslations('dash.website.domain')
  const rows: (DnsRecord & { step: string })[] = [
    ...records.a.map((r) => ({ ...r, step: t('stepPoint') })),
    { ...records.txt, step: t('stepOwn') },
  ]
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-fg">{t('recordsTitle')}</p>
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.type}-${r.value}`} className="rounded-box border border-line p-3 text-sm">
            <p className="mb-2 text-xs text-muted">{r.step}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">{t('type')}</dt>
              <dd className="font-mono text-fg">{r.type}</dd>
              <dt className="text-muted">{t('name')}</dt>
              <dd className="font-mono text-fg break-all">{r.name}</dd>
              <dt className="text-muted">{t('value')}</dt>
              <dd className="flex items-start gap-2">
                <span className="font-mono text-fg break-all">{r.value}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(r.value).then(() => toast.success(t('copied')))}
                  aria-label={t('copy')}
                  className="shrink-0 rounded-ctl p-1 text-muted hover:bg-fg/5 hover:text-fg"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </dd>
            </dl>
          </li>
        ))}
      </ol>
      {records.a.length === 0 && <p className="text-xs text-warn">{t('noAddress')}</p>}
      <p className="text-xs text-muted">{t('wait')}</p>
    </div>
  )
}
