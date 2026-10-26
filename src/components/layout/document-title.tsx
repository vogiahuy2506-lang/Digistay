'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

/**
 * The tab's title while mounted: the parts, then "Digistay" ("Đặt phòng ·
 * Khách sạn Demo Hà Nội · Digistay"). The dashboard pages are client
 * components without metadata of their own, so every tab read the same.
 * Next may write its own <title> afterwards (streamed metadata, a
 * navigation): the title is put back whenever it changes, and the one it
 * replaced comes back when the page goes.
 */
export function useDocumentTitle(parts: (string | null | undefined | false)[]) {
  const title = [...parts.filter((part): part is string => !!part), 'Digistay'].join(' · ')
  React.useEffect(() => {
    let previous = document.title
    const apply = () => {
      if (document.title === title) return
      previous = document.title
      document.title = title
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (document.title === title) document.title = previous
    }
  }, [title])
}

/** The workspace level's pages (no sidebar there): "Thành viên · <workspace> · Digistay". */
export function WorkspaceLevelTitle({ workspaceName }: { workspaceName: string }) {
  const t = useTranslations('dash.common.nav')
  const tBilling = useTranslations('dash.billing')
  const pathname = usePathname() ?? ''
  const page = /\/members\/?$/.test(pathname)
    ? t('members')
    : /\/settings\/?$/.test(pathname)
      ? t('settings')
      : /\/billing\/?$/.test(pathname)
        ? tBilling('nav')
        : t('properties')
  useDocumentTitle([page, workspaceName])
  return null
}
