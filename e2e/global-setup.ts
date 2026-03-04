import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

const STORAGE_STATE = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('admin@cnc.dev')
  await page.getByLabel('Password').fill('Admin123!')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })

  await page.context().storageState({ path: STORAGE_STATE })
})

export { STORAGE_STATE }
