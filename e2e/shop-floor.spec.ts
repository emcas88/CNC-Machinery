import { test, expect } from '@playwright/test'

test.describe('Shop Floor - Cut List App', () => {
  test('shows no-job-selected state', async ({ page }) => {
    await page.goto('/shop/cutlist')
    await expect(page.getByText(/no job selected/i)).toBeVisible()
  })
})

test.describe('Shop Floor - Assembly App', () => {
  test('shows no-job-selected state', async ({ page }) => {
    await page.goto('/shop/assembly')
    await expect(page.getByText(/no job selected/i)).toBeVisible()
  })
})

test.describe('Shop Floor - Labels App', () => {
  test('shows no-job-selected state', async ({ page }) => {
    await page.goto('/shop/labels')
    await expect(page.getByText(/no job selected/i)).toBeVisible()
  })
})

test.describe('CNC Operator View', () => {
  test('shows empty state when no optimizer data', async ({ page }) => {
    await page.goto('/cnc-operator')
    await expect(page.getByText(/no sheets available/i)).toBeVisible()
  })
})

test.describe('Cloud Render', () => {
  test('shows no-job-selected state', async ({ page }) => {
    await page.goto('/render')
    await expect(page.getByText(/no job selected/i)).toBeVisible()
  })
})

test.describe('Remake Bin', () => {
  test('shows no-job-selected state', async ({ page }) => {
    await page.goto('/remake-bin')
    await expect(page.getByText(/no job selected/i)).toBeVisible()
  })
})
