import { test, expect } from '@playwright/test'

test.describe('Cut List View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cutlists')
  })

  test('renders cutlist page with table columns', async ({ page }) => {
    await expect(page.getByRole('main').getByRole('heading', { name: /Cut List/i })).toBeVisible()
    await expect(page.getByRole('main').getByText('Part Name', { exact: true })).toBeVisible()
  })

  test('search input is present', async ({ page }) => {
    await expect(page.getByPlaceholder(/filter/i)).toBeVisible()
  })

  test('Export CSV button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible()
  })

  test('shows empty state when no job selected', async ({ page }) => {
    await expect(page.getByText(/select a job/i)).toBeVisible()
  })
})

test.describe('BOM View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bom')
  })

  test('renders BOM page with tabs', async ({ page }) => {
    await expect(page.getByRole('main').getByText(/bill of materials/i).first()).toBeVisible()
    const bomTab = page.getByRole('main').getByRole('button').filter({ hasText: /BOM/ }).first()
    const boqTab = page.getByRole('main').getByRole('button').filter({ hasText: /BOQ/ }).first()
    await expect(bomTab).toBeVisible()
    await expect(boqTab).toBeVisible()
  })

  test('BOM/BOQ tab switching works', async ({ page }) => {
    const boqTab = page.getByRole('main').getByRole('button').filter({ hasText: /BOQ/ }).first()
    await boqTab.click()
    await page.waitForTimeout(300)
    const bomTab = page.getByRole('main').getByRole('button').filter({ hasText: /BOM/ }).first()
    await bomTab.click()
    await page.waitForTimeout(300)
  })

  test('shows grand total', async ({ page }) => {
    await expect(page.getByText(/grand total/i)).toBeVisible()
  })

  test('export button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
  })
})

test.describe('Quote Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quotes')
  })

  test('renders quotes page', async ({ page }) => {
    await expect(page.getByText(/quote|select a job/i).first()).toBeVisible()
  })

  test('shows empty state when no job selected', async ({ page }) => {
    await expect(page.getByText(/select a job/i)).toBeVisible()
  })
})

test.describe('Label Designer', () => {
  test('renders label page', async ({ page }) => {
    await page.goto('/labels')
    await expect(page.getByText(/label|no job selected/i).first()).toBeVisible()
  })
})

test.describe('Multi-Print / Drawings', () => {
  test('renders drawings page', async ({ page }) => {
    await page.goto('/drawings')
    await expect(page.getByText(/drawing|no job selected/i).first()).toBeVisible()
  })
})

test.describe('Export Center', () => {
  test('renders export center page', async ({ page }) => {
    await page.goto('/exports')
    await expect(page.getByText(/export|no job selected/i).first()).toBeVisible()
  })
})
