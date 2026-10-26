// @vitest-environment happy-dom
/**
 * The account menu (sidebar foot): a menu button that holds the profile, the
 * site header's theme and VI | EN buttons, and sign out, usable from the keyboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const router = { push: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/workspace/demo/properties/p1',
}))
vi.mock('next-intl', () => ({
  // Keys stand in for the texts.
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}))

import { ThemeRoot } from './theme-root'
import { AccountMenu } from './account-menu'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const onSignOut = vi.fn()

function render(variant: 'bar' | 'sidebar' = 'sidebar') {
  act(() =>
    root.render(
      <ThemeRoot initial="light">
        <AccountMenu variant={variant} name="Trần Minh Đức" email="a@b.vn" detail="Chủ sở hữu" onSignOut={onSignOut} />
      </ThemeRoot>
    )
  )
}

const button = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
const menu = () => container.querySelector('[role="menu"]')
const items = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemradio"]'))
/** An entry's name: the icon buttons have only their aria-label. */
const nameOf = (el: Element | null | undefined) => el?.getAttribute('aria-label') ?? el?.textContent
const focused = () => nameOf(document.activeElement)

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    ;(document.activeElement ?? document.body).dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  router.push.mockClear()
  router.refresh.mockClear()
  onSignOut.mockClear()
  document.cookie = 'NEXT_LOCALE=vi; path=/'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AccountMenu', () => {
  it('opens from the user row with the profile, the theme and language buttons and sign out, focus on the first', () => {
    render()
    expect(menu()).toBeNull()
    act(() => button().click())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(menu()?.getAttribute('aria-labelledby')).toBe(button().id)
    expect(items().map(nameOf)).toEqual(['profile', 'toDark', 'languageNames.vi', 'languageNames.en', 'signOut'])
    // The language buttons say which one is in use, like the header's VI | EN.
    expect(items().map((item) => item.getAttribute('aria-checked'))).toEqual([null, null, 'true', 'false', null])
    expect(focused()).toBe('profile')
  })

  it('moves with the arrows, Home and End, wrapping at the ends', () => {
    render()
    act(() => button().click())
    press('ArrowDown')
    expect(focused()).toBe('toDark')
    press('End')
    expect(focused()).toBe('signOut')
    press('ArrowDown')
    expect(focused()).toBe('profile')
    press('ArrowUp')
    expect(focused()).toBe('signOut')
    press('Home')
    expect(focused()).toBe('profile')
  })

  it('opens on the last entry with ArrowUp on the button', () => {
    render('bar')
    act(() => button().focus())
    press('ArrowUp')
    expect(menu()).not.toBeNull()
    expect(focused()).toBe('signOut')
  })

  it('closes on Escape, hands focus back to the button and keeps the key from an enclosing drawer', () => {
    render()
    act(() => button().click())
    const event = press('Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(button())
    expect(button().getAttribute('aria-expanded')).toBe('false')
    // dialog-behavior.ts ignores a handled key, so the phone drawer stays open.
    expect(event.defaultPrevented).toBe(true)
  })

  it('closes on Tab with focus back on the button, so Tab carries on from there', () => {
    render()
    act(() => button().click())
    press('Tab')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  it('toggles the theme in place and stays open to show it', () => {
    render()
    act(() => button().click())
    act(() => items()[1].click())
    expect(menu()).not.toBeNull()
    expect(nameOf(items()[1])).toBe('toLight')
    expect(container.querySelector('[data-theme]')?.getAttribute('data-theme')).toBe('dark')
    expect(document.cookie).toContain('ds-theme=dark')
  })

  it('switches the language through the language cookie and reloads the page data', () => {
    render()
    act(() => button().click())
    // The language in use does nothing; the other one switches.
    act(() => items()[2].click())
    expect(router.refresh).not.toHaveBeenCalled()
    act(() => items()[3].click())
    expect(document.cookie).toContain('NEXT_LOCALE=en')
    expect(router.refresh).toHaveBeenCalledTimes(1)
    expect(menu()).not.toBeNull()
  })

  it('goes to the profile and signs out, closing the menu', () => {
    render()
    act(() => button().click())
    act(() => items()[0].click())
    expect(router.push).toHaveBeenCalledWith('/profile')
    expect(menu()).toBeNull()

    act(() => button().click())
    act(() => items()[4].click())
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(menu()).toBeNull()
  })

  it('closes on a press outside', () => {
    render()
    act(() => button().click())
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(menu()).toBeNull()
  })

  it('names the bar button, which shows only the avatar on phones', () => {
    render('bar')
    expect(button().getAttribute('aria-label')).toBe('account')
  })
})
