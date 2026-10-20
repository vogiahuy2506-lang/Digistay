'use client'

import * as React from 'react'
import { siteHref } from '@/lib/public-site/paths'

/** The site's base path (src/lib/public-site/paths.ts), set by [subdomain]/layout.tsx. */
const SiteBaseContext = React.createContext<string | null>(null)

export function SiteBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <SiteBaseContext.Provider value={base}>{children}</SiteBaseContext.Provider>
}

/** Builds links inside the hotel's site: href('/rooms/x'), href('/search?…'). */
export function useSiteHref() {
  const base = React.useContext(SiteBaseContext)
  if (base === null) throw new Error('useSiteHref must be used inside SiteBaseProvider')
  return React.useCallback((path: string) => siteHref(base, path), [base])
}

/** An <a> to a page of the hotel's site, for server components. */
export function SiteLink({
  path,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { path: string }) {
  const href = useSiteHref()
  return <a href={href(path)} {...props} />
}
