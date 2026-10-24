'use client'

import * as React from 'react'
import { normalizeTaxCode, type CompanyInfo } from '@/lib/einvoice/tax-code'

export type TaxLookupState =
  | { status: 'idle' | 'loading' | 'missing' | 'failed' }
  | { status: 'found'; company: CompanyInfo }

/**
 * Looks a tax code up (GET /api/public/tax-lookup) once it is complete, a
 * moment after the last keystroke, and hands the company to `onFound`.
 * Typing on cancels the answer to an older code. `retry` asks again now.
 */
export function useTaxLookup(taxCode: string, onFound: (company: CompanyInfo) => void, enabled = true) {
  const [state, setState] = React.useState<TaxLookupState>({ status: 'idle' })
  const [attempt, setAttempt] = React.useState(0)
  const found = React.useRef(onFound)
  found.current = onFound
  const code = enabled ? normalizeTaxCode(taxCode) : null
  // A code already filled in (editing a saved invoice) is not looked up again until it changes.
  const filled = React.useRef(code)

  React.useEffect(() => {
    if (!code) {
      setState({ status: 'idle' })
      return
    }
    if (attempt === 0 && filled.current === code) return
    filled.current = null
    let stale = false
    const timer = setTimeout(async () => {
      setState({ status: 'loading' })
      try {
        const res = await fetch(`/api/public/tax-lookup?taxCode=${encodeURIComponent(code)}`)
        const data = await res.json().catch(() => null)
        if (stale) return
        if (res.ok && data?.success) {
          setState({ status: 'found', company: data.data })
          found.current(data.data)
        } else {
          setState({ status: res.status === 404 ? 'missing' : 'failed' })
        }
      } catch {
        if (!stale) setState({ status: 'failed' })
      }
    }, attempt ? 0 : 400)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [code, attempt])

  return { state, code, retry: () => setAttempt((n) => n + 1) }
}
