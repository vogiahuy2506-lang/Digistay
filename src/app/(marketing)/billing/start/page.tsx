import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isPlanId } from '@/lib/marketing/plans'

export const metadata: Metadata = { robots: { index: false } }

/**
 * /billing/start?plan=…&billing=MONTH|YEAR
 * Subscribing to a plan is for the user account (not per workspace).
 * Directly routes to /billing/checkout.
 */
export default async function BillingStartPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const plan = isPlanId(sp.plan) ? sp.plan : 'growth'
  const billing = sp.billing === 'YEAR' ? 'YEAR' : 'MONTH'
  const query = `plan=${plan}&billing=${billing}`

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect(`/register?callbackUrl=${encodeURIComponent(`/billing/checkout?${query}`)}`)

  redirect(`/billing/checkout?${query}`)
}
