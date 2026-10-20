import { readFileSync } from 'fs'
import { expect, type Page } from '@playwright/test'
import { E2E, type E2EIds } from './env'

export const ids = (): E2EIds => JSON.parse(readFileSync(E2E.idsFile, 'utf8'))
export const propertyPath = (path = '') => `/workspace/${ids().ws}/properties/${ids().prop}${path}`

export async function signIn(page: Page, username: string, password = E2E.password) {
  await page.goto('/login')
  await page.fill('input[autocomplete=username]', username)
  await page.fill('input[autocomplete=current-password]', password)
  await page.click('button[type=submit]')
}

export const leftLogin = (page: Page) => page.waitForURL((u) => !new URL(u).pathname.startsWith('/login'), { timeout: 20_000 })

/** Fails the test on any uncaught page error. */
export function failOnPageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return () => expect(errors, errors.join(' | ')).toEqual([])
}

export const control = {
  pay: async (orderCode: string) => (await fetch(`${E2E.control}/payos/pay/${orderCode}`, { method: 'POST' })).json(),
  matbaoCalls: async (): Promise<Record<string, any>[]> => (await fetch(`${E2E.control}/matbao/calls`)).json(),
  mails: async (): Promise<{ to: string; raw: string }[]> => (await fetch(`${E2E.control}/mail`)).json(),
}

/** Waits for an email to arrive at the SMTP sink. */
export async function waitForMail(match: (m: { to: string; raw: string }) => boolean, timeout = 15_000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const found = (await control.mails()).find(match)
    if (found) return found
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('no matching email arrived')
}
