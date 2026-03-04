import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('displays job statistics cards', async ({ page }) => {
    await expect(page.getByText(/total jobs/i)).toBeVisible()
    await expect(page.getByText(/active/i).first()).toBeVisible()
  })

  test('shows New Job button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new job/i })).toBeVisible()
  })

  test('New Job button navigates to /jobs/new', async ({ page }) => {
    await page.getByRole('button', { name: /new job/i }).click()
    await expect(page).toHaveURL(/\/jobs\/new/)
  })

  test('displays Active Jobs section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Active Jobs' })).toBeVisible()
  })

  test('displays Draft Jobs section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Draft Jobs' })).toBeVisible()
  })
})
