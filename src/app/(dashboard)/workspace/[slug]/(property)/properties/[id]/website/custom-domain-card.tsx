'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { toast } from '@/components/ui/toast'
import { apiError } from '@/lib/i18n/api-errors'
import { useDashLabels } from '@/lib/i18n/dash'
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
  /** The CNAME target resolves to Digistay's server, so a CNAME to it works (POST /api/website/domain/verify). */
  cnameReady?: boolean
  a: DnsRecord[]
  txt: DnsRecord
}

/**
 * The certificate script runs every minute (RUNBOOK "Tên miền riêng của
 * khách sạn"): a request still waiting after this long, without an error,
 * is stuck (DNS changed, the timer not running...), not on its way.
 */
const SLOW_AFTER_MS = 10 * 60 * 1000

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
  const labels = useDashLabels()
  const [domain, setDomain] = React.useState('')
  const [checking, setChecking] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [records, setRecords] = React.useState<Records | null>(null)
  const [retrying, setRetrying] = React.useState(false)
  const attached = settings.customDomain && settings.domainVerificationStatus === 'verified' ? settings.customDomain : null
  const state = sslState({ ...settings, sslRequestedAt: settings.sslRequestedAt ?? null })
  // The card renders on the client only (the builder loads its settings), so reading the clock here is safe.
  const [now, setNow] = React.useState(() => Date.now())
  const requestedAt = settings.sslRequestedAt ? Date.parse(settings.sslRequestedAt) : NaN
  const slow = state === 'pending' && now - requestedAt > SLOW_AFTER_MS

  // While the certificate is on its way, ask how it is going.
  React.useEffect(() => {
    if (state !== 'pending') return
    const id = setInterval(async () => {
      setNow(Date.now())
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
      else {
        setNow(Date.now())
        onChange({ sslError: null, sslRequestedAt: new Date().toISOString() })
      }
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
                {state === 'pending' && !slow && (
                  <li className="flex items-start gap-2 text-muted">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span>{t('httpsPending')}</span>
                  </li>
                )}
                {slow && (
                  <li className="flex flex-wrap items-start gap-2 text-warn">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      {t('httpsSlow', { when: labels.dateTime(settings.sslRequestedAt!) })}
                      <span className="mt-1 block text-muted">{t('httpsSlowCheck')}</span>
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={retry} isLoading={retrying}>
                      {t('retry')}
                    </Button>
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

/**
 * The records to add at the domain's DNS provider (src/lib/custom-domain.ts):
 * point the name at Digistay — a CNAME (to the site's own <subdomain>.<root>,
 * or the DNS-only name of CUSTOM_DOMAIN_CNAME_TARGET) for www.… and other
 * subdomains, A records for a root domain (no CNAME there) — and the TXT that
 * proves ownership. The CNAME only once its target leads to Digistay's server
 * (the API says so); until then A records for all. These records must not go
 * through the hotel's own Cloudflare proxy: the check would see Cloudflare's
 * addresses, and Let's Encrypt could not reach us.
 */
function DnsSteps({ records }: { records: Records }) {
  const t = useTranslations('dash.website.domain')
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-fg">{t('recordsTitle')}</p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">{t('stepPoint')}</p>
        {records.cnameReady && <RecordCard note={t('pointCname')} records={[records.cname]} />}
        {records.a.length > 0 && <RecordCard note={records.cnameReady ? t('pointApex') : t('pointA')} records={records.a} />}
        {!records.cnameReady && <p className="text-xs text-muted">{t('cnameLater')}</p>}
        {records.a.length === 0 && <p className="text-xs text-warn">{t('noAddress')}</p>}
        <p className="text-xs text-muted">{t('pointOnlyOne')}</p>
        <p className="text-xs text-muted">{t('dnsOnly')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">{t('stepOwn')}</p>
        <RecordCard records={[records.txt]} />
      </div>
      <p className="text-xs text-muted">{t('wait')}</p>
    </div>
  )
}

function RecordCard({ note, records }: { note?: string; records: DnsRecord[] }) {
  const t = useTranslations('dash.website.domain')
  return (
    <div className="rounded-box border border-line p-3 text-sm">
      {note && <p className="mb-2 text-xs text-muted">{note}</p>}
      <ul className="space-y-3">
        {records.map((r) => (
          <li key={`${r.type}-${r.value}`}>
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
      </ul>
    </div>
  )
}
