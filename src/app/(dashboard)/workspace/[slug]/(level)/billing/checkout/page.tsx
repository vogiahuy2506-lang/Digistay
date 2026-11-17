'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loading } from '@/components/ui'

export default function DedicatedCheckoutPage() {
  const router = useRouter()
  const search = useSearchParams()

  React.useEffect(() => {
    const qs = search.toString()
    router.replace(`/billing/checkout${qs ? `?${qs}` : ''}`)
  }, [router, search])

  return <Loading className="py-24" />
}
