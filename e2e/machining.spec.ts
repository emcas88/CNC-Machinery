import { test, expect } from '@playwright/test'

test.describe('Machine Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/machines')
  })

  test('renders machine setup page', async ({ page }) => {
    await expect(page.getByText(/machine/i).first()).toBeVisible()
  })

  test('shows New Machine button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new machine/i })).toBeVisible()
  })

  test('empty state shows guidance message', async ({ page }) => {
    await expect(page.getByText(/no machines configured|add a machine/i)).toBeVisible()
  })
})

test.describe('Post Processor Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/post-processors')
  })

  test('renders processor list', async ({ page }) => {
    await expect(page.getByText(/post processor/i).first()).toBeVisible()
    await expect(page.getByText(/generic g-code|homag|scm/i).first()).toBeVisible()
  })

  test('clicking a processor shows detail panel', async ({ page }) => {
    await page.getByText(/generic g-code/i).first().click()
    await expect(page.getByText(/machine type/i)).toBeVisible()
    await expect(page.getByText(/output format/i)).toBeVisible()
  })

  test('detail panel shows template editors', async ({ page }) => {
    await page.getByText(/generic g-code/i).first().click()
    await expect(page.getByText(/main template/i)).toBeVisible()
  })

  test('variables section renders without error', async ({ page }) => {
    await page.getByText(/generic g-code/i).first().click()
    await expect(page.getByRole('main').getByText('Variables').first()).toBeVisible()
  })

  test('search filters processors', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('Homag')
    await page.waitForTimeout(300)
    await expect(page.getByText(/homag/i).first()).toBeVisible()
  })

  test('New PP button is visible', async ({ page }) => {
    await expect(page.getByText(/\+ New PP/)).toBeVisible()
  })
})

test.describe('Optimizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/optimizer')
  })

  test('renders optimizer controls', async ({ page }) => {
    await expect(page.getByText(/sheet optimizer/i)).toBeVisible()
    await expect(page.getByText(/algorithm/i)).toBeVisible()
    await expect(page.getByText(/blade kerf/i)).toBeVisible()
  })

  test('algorithm dropdown has options', async ({ page }) => {
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
    const options = await select.locator('option').allTextContents()
    expect(options.some(o => /guillotine/i.test(o))).toBeTruthy()
  })

  test('blade kerf input is editable', async ({ page }) => {
    const kerfInput = page.locator('input[type="number"]').first()
    await expect(kerfInput).toBeVisible()
    await kerfInput.fill('3.5')
    await expect(kerfInput).toHaveValue('3.5')
  })

  test('grain direction checkbox is present', async ({ page }) => {
    await expect(page.getByText(/grain direction/i)).toBeVisible()
  })

  test('Run Optimizer button exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: /run optimizer/i })).toBeVisible()
  })

  test('empty state shows guidance', async ({ page }) => {
    await expect(page.getByText(/run the optimizer/i)).toBeVisible()
  })
})

test.describe('G-Code Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gcode')
  })

  test('renders G-code viewer with tabs', async ({ page }) => {
    await expect(page.getByText(/g-?code/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /simulate/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /safety check/i })).toBeVisible()
  })

  test('shows no sheet_id message when none provided', async ({ page }) => {
    await expect(page.getByText(/no sheet_id provided/i)).toBeVisible()
  })

  test('Generate and Export buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
  })
})

test.describe('Flipside Machining', () => {
  test('shows empty state when no optimizer data', async ({ page }) => {
    await page.goto('/flipside')
    await expect(page.getByText(/no sheets available/i)).toBeVisible()
  })
})

test.describe('Dovetail Setup', () => {
  test('shows empty state when no machines', async ({ page }) => {
    await page.goto('/dovetail')
    await expect(page.getByText(/no machines configured/i)).toBeVisible()
  })
})

test.describe('Tools', () => {
  test('renders tools page', async ({ page }) => {
    await page.goto('/tools')
    await expect(page.getByText(/tool/i).first()).toBeVisible()
  })
})
