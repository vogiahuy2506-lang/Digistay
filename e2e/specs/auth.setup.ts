import { test as setup } from '@playwright/test'
import { E2E } from '../env'
import { leftLogin, signIn } from '../helpers'

setup('the hotel admin signs in with a password', async ({ page }) => {
  await signIn(page, E2E.users.admin.username)
  await leftLogin(page)
  await page.context().storageState({ path: E2E.adminState })
})
