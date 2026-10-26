'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronsUpDown, Languages, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/utils/routes'
import { useTheme } from './theme-root'
import { useLanguageSwitch } from './language-switch'

interface AccountMenuProps {
  name?: string
  email?: string
  image?: string
  /**
   * 'bar': the avatar (and the name from `sm` up) at the right of a top bar,
   * the menu drops below. 'sidebar': the row at the foot of the sidebar,
   * with `detail` (the role) under the name; the menu opens upwards.
   */
  variant: 'bar' | 'sidebar'
  detail?: string
  /** Entries above "Profile", e.g. the list of workspaces on the account pages. */
  links?: { label: string; href: string; icon: React.ReactNode }[]
  onSignOut: () => void
}

interface Entry {
  key: string
  label: string
  /** The current setting, shown at the right of a toggle. */
  value?: string
  valueLang?: string
  icon: React.ReactNode
  title?: string
  danger?: boolean
  /** Toggles stay open, so the new value shows; the rest close the menu. */
  keepOpen?: boolean
  /** Busy (the language is being switched): aria-disabled, so it keeps focus. */
  disabled?: boolean
  onSelect: () => void
}

/**
 * The account menu of the signed-in pages: profile, theme, language and sign
 * out behind the user's name, so the bars keep only what is used often. A
 * menu button (APG pattern): arrows, Home/End move between the entries,
 * Escape closes it and gives focus back to the button, Tab closes it and
 * moves on. Escape is marked handled, so the phone drawer around the sidebar
 * stays open (dialog-behavior.ts).
 */
export function AccountMenu({ name, email, image, variant, detail, links = [], onSignOut }: AccountMenuProps) {
  const t = useTranslations('dash.common.shell')
  const router = useRouter()
  const theme = useTheme()
  const language = useLanguageSwitch()
  const [open, setOpen] = React.useState(false)
  // Which entry takes focus once the menu is drawn: the first, or the last (ArrowUp on the button).
  const [focusOnOpen, setFocusOnOpen] = React.useState<'first' | 'last'>('first')
  const rootRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const itemsRef = React.useRef<(HTMLButtonElement | null)[]>([])
  const id = React.useId()
  const buttonId = `${id}-button`
  const menuId = `${id}-menu`

  const dark = theme?.preference === 'dark'
  const entries: (Entry | 'divider')[] = [
    ...links.map<Entry>((link) => ({
      key: link.href,
      label: link.label,
      icon: link.icon,
      onSelect: () => router.push(link.href),
    })),
    {
      key: 'profile',
      label: t('profile'),
      icon: <UserRound className="w-4 h-4" aria-hidden="true" />,
      onSelect: () => router.push(routes.profile()),
    },
    ...(theme
      ? [
          {
            key: 'theme',
            label: t('theme'),
            value: dark ? t('themeDark') : t('themeLight'),
            icon: dark ? <Moon className="w-4 h-4" aria-hidden="true" /> : <Sun className="w-4 h-4" aria-hidden="true" />,
            title: theme.darkAvailable ? (dark ? t('toLight') : t('toDark')) : t('noDarkHere'),
            keepOpen: true,
            onSelect: () => theme.setPreference(dark ? 'light' : 'dark'),
          },
        ]
      : []),
    {
      key: 'language',
      label: t('language'),
      value: t(`languageNames.${language.locale}`),
      valueLang: language.locale,
      icon: <Languages className="w-4 h-4" aria-hidden="true" />,
      title: t(`languageNames.${language.next}`),
      keepOpen: true,
      disabled: language.pending,
      onSelect: language.switchLanguage,
    },
    'divider',
    {
      key: 'signOut',
      label: t('signOut'),
      icon: <LogOut className="w-4 h-4" aria-hidden="true" />,
      danger: true,
      onSelect: onSignOut,
    },
  ]

  const close = React.useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  const openMenu = (focus: 'first' | 'last') => {
    setFocusOnOpen(focus)
    setOpen(true)
  }

  // Focus goes into the menu once it is drawn.
  React.useEffect(() => {
    if (!open) return
    const list = itemsRef.current.filter((item): item is HTMLButtonElement => !!item)
    ;(focusOnOpen === 'last' ? list[list.length - 1] : list[0])?.focus()
  }, [open, focusOnOpen])

  // A press anywhere else closes it (focus stays where the press put it).
  React.useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = itemsRef.current.filter((item): item is HTMLButtonElement => !!item)
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const move = (index: number) => list[(index + list.length) % list.length]?.focus()
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(at + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(at < 0 ? list.length - 1 : at - 1)
        break
      case 'Home':
        event.preventDefault()
        move(0)
        break
      case 'End':
        event.preventDefault()
        move(list.length - 1)
        break
      case 'Tab':
        // Back on the button first, so Tab carries on from there.
        close(true)
        break
    }
  }

  // On the wrapper, so Escape also works while the button has focus.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      close(true)
    }
  }

  const select = (entry: Entry) => {
    if (entry.disabled) return
    if (!entry.keepOpen) close(true)
    entry.onSelect()
  }

  const label = name || email || t('user')
  let itemIndex = 0

  return (
    // data-account-open lifts the sticky bar holding it above the page while open (like the bell).
    <div ref={rootRef} className={cn('relative', variant === 'sidebar' && 'w-full')} data-account-open={open || undefined} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // The bar shows only the avatar on phones: the button needs a name of its own.
        aria-label={variant === 'bar' ? t('account') : undefined}
        title={email}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onButtonKeyDown}
        className={cn(
          'rounded-ctl transition-colors duration-160 hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc',
          open && 'bg-fg/5',
          variant === 'bar'
            ? 'flex items-center gap-2 h-9 px-1.5 max-w-[220px]'
            : 'w-full flex items-center gap-2.5 px-2 py-1.5 text-left'
        )}
      >
        <Avatar src={image} name={label} size="sm" />
        {variant === 'bar' ? (
          // On phones only the avatar: the bar has no room for the name.
          <span className="hidden sm:block truncate text-small text-fg">{label}</span>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg truncate">{label}</span>
              {detail && <span className="block text-xs text-muted truncate">{detail}</span>}
            </span>
            <ChevronsUpDown className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 py-1 bg-raised text-fg rounded-box border border-line shadow-lift',
            variant === 'bar' ? 'right-0 top-full mt-2 w-60' : 'inset-x-0 bottom-full mb-2'
          )}
        >
          {entries.map((entry, i) => {
            if (entry === 'divider') return <div key={`divider-${i}`} role="separator" className="my-1 border-t border-line" />
            const index = itemIndex++
            return (
              <button
                key={entry.key}
                ref={(node) => {
                  itemsRef.current[index] = node
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                title={entry.title}
                aria-disabled={entry.disabled || undefined}
                onClick={() => select(entry)}
                className={cn(
                  'w-full h-10 sm:h-9 px-3 flex items-center gap-3 text-small text-left transition-colors duration-160 focus:outline-none',
                  entry.danger ? 'text-err hover:bg-err-soft focus-visible:bg-err-soft' : 'text-fg hover:bg-fg/5 focus-visible:bg-fg/5',
                  entry.disabled && 'opacity-50 cursor-wait'
                )}
              >
                <span className={cn('shrink-0', !entry.danger && 'text-muted')}>{entry.icon}</span>
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.value && (
                  <span lang={entry.valueLang} className="shrink-0 text-xs text-muted">
                    {entry.value}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
