'use client'

import * as React from 'react'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

/**
 * Client providers for every page: none for now. next-auth's SessionProvider
 * used to sit here without a session, so every page load fetched it; that
 * context change landed while the dashboard's streamed content was still
 * waiting to be shown (React 19.2 reveals it in batches), and React dropped
 * the server's HTML and rendered the page again on the client, on most loads.
 * Pages that call useSession get SessionScope instead.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/**
 * useSession below, from the session the server already read: given one,
 * SessionProvider does not fetch it on load, so nothing changes before the
 * page is hydrated. The one read after hydration renews the session cookie
 * (next-auth re-issues it on every read), as the old fetch on each page load
 * did: without it, users would be signed out 30 days after signing in however
 * often they came back.
 */
export function SessionScope({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const signedIn = session !== null
  React.useEffect(() => {
    // Read the body: an unread one keeps the request open (and the page never idle).
    if (signedIn) fetch('/api/auth/session', { cache: 'no-store' }).then((res) => res.text()).catch(() => {})
  }, [signedIn])
  return <SessionProvider session={session}>{children}</SessionProvider>
}
