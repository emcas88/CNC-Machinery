import { test, expect } from '@playwright/test'

test.describe('Materials Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/materials')
  })

  test('renders materials list', async ({ page }) => {
    await expect(page.getByText(/materials/i).first()).toBeVisible()
    await expect(page.getByText(/plywood|mdf|abs/i).first()).toBeVisible()
  })

  test('search filters materials', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first()
    await searchInput.fill('MDF')
    await page.waitForTimeout(300)
    await expect(page.getByText(/MDF/i).first()).toBeVisible()
  })

  test('clicking a material shows detail panel', async ({ page }) => {
    await page.getByText(/plywood/i).first().click()
    await expect(page.getByText(/category/i)).toBeVisible()
    await expect(page.getByText(/thickness/i)).toBeVisible()
  })

  test('material detail shows dimensions without undefined', async ({ page }) => {
    await page.getByText(/plywood/i).first().click()
    const detailPanel = page.locator('.panel, [class*="detail"]').first()
    const text = await detailPanel.textContent()
    expect(text).not.toContain('undefinedmm')
  })

  test('shows Add material button', async ({ page }) => {
    await expect(page.getByText(/add material/i).or(page.getByRole('button', { name: /add/i }))).toBeVisible()
  })
})

test.describe('Texture Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/textures')
  })

  test('renders texture cards', async ({ page }) => {
    await expect(page.getByText(/texture manager/i)).toBeVisible()
    await expect(page.getByText(/anthracite|oak|walnut|white|concrete|aluminium/i).first()).toBeVisible()
  })

  test('search filters textures', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('Oak')
    await page.waitForTimeout(300)
    await expect(page.getByText(/oak/i).first()).toBeVisible()
  })

  test('clicking Edit opens texture modal', async ({ page }) => {
    await page.getByRole('button', { name: /edit/i }).first().click()
    await expect(page.getByText(/update texture/i)).toBeVisible()
  })

  test('texture edit modal has correct fields', async ({ page }) => {
    await page.getByRole('button', { name: /edit/i }).first().click()
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('New Texture button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new texture/i })).toBeVisible()
  })
})

test.describe('Hardware Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hardware')
  })

  test('renders hardware cards', async ({ page }) => {
    await expect(page.getByRole('main').getByText('Hardware Library')).toBeVisible()
    await expect(page.getByRole('main').locator('div, span, p, h2, h3, h4').filter({ hasText: /Handle|Hinge|Slide/ }).first()).toBeVisible()
  })

  test('search filters hardware', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first()
    await searchInput.fill('Hinge')
    await page.waitForTimeout(300)
    await expect(page.getByRole('main').locator('div, span, p, h2, h3, h4').filter({ hasText: /Hinge/ }).first()).toBeVisible()
  })

  test('type filter dropdown works', async ({ page }) => {
    const typeFilter = page.locator('select').first()
    if (await typeFilter.isVisible()) {
      const options = await typeFilter.locator('option').allTextContents()
      expect(options.length).toBeGreaterThan(1)
    }
  })

  test('Add Hardware button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add hardware/i })).toBeVisible()
  })

  test('clicking Edit opens hardware modal', async ({ page }) => {
    await page.getByRole('button', { name: /edit/i }).first().click()
    await expect(page.getByRole('button', { name: /update/i })).toBeVisible()
  })
})
