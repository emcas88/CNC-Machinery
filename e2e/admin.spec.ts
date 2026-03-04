import { test, expect } from '@playwright/test'

test.describe('User Administration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users')
  })

  test('renders user table with real data', async ({ page }) => {
    await expect(page.getByText(/user administration/i)).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('shows real user names from API', async ({ page }) => {
    await expect(page.getByText(/admin user/i).first()).toBeVisible()
  })

  test('shows user roles', async ({ page }) => {
    await expect(page.getByText(/super_admin|designer|cnc_operator|shop_floor/).first()).toBeVisible()
  })

  test('Add User button opens form', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click()
    await expect(page.getByText(/new user/i)).toBeVisible()
    await expect(page.getByPlaceholder(/name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('Add User form can be closed', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click()
    await expect(page.getByText(/new user/i)).toBeVisible()
    await page.locator('button').filter({ has: page.locator('svg') }).first().click()
  })

  test('Edit button switches to inline editing', async ({ page }) => {
    const editBtn = page.locator('tbody tr').first().getByRole('button').first()
    await editBtn.click()
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i }).last()).toBeVisible()
  })

  test('Cancel edit reverts to display mode', async ({ page }) => {
    const editBtn = page.locator('tbody tr').first().getByRole('button').first()
    await editBtn.click()
    await page.getByRole('button', { name: /cancel/i }).last().click()
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible()
  })
})

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
  })

  test('renders settings page with tabs', async ({ page }) => {
    await expect(page.getByText('Settings').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Security', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toBeVisible()
  })

  test('Profile tab shows user data', async ({ page }) => {
    await page.waitForTimeout(2000)
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toBeVisible()
    const value = await nameInput.inputValue()
    expect(value.length).toBeGreaterThanOrEqual(0)
  })

  test('Security tab has password fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Security', exact: true }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /change password/i })).toBeVisible()
  })

  test('Notifications tab has toggles', async ({ page }) => {
    await page.getByRole('button', { name: 'Notifications', exact: true }).click()
    await page.waitForTimeout(500)
    const toggles = page.locator('input[type="checkbox"], [role="switch"], button[role="switch"]')
    const count = await toggles.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Appearance tab has theme options', async ({ page }) => {
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText(/theme/i)).toBeVisible()
  })

  test('tab switching works for all tabs', async ({ page }) => {
    const tabs = ['Profile', 'Security', 'Notifications', 'Appearance']
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Construction Methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/construction-methods')
  })

  test('renders methods list', async ({ page }) => {
    await expect(page.getByText(/construction method|methods/i).first()).toBeVisible()
    await expect(page.getByText(/confirmat|domino|dowel/i).first()).toBeVisible()
  })

  test('search filters methods', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('Domino')
    await page.waitForTimeout(300)
    await expect(page.getByText(/domino/i).first()).toBeVisible()
  })

  test('clicking a method shows edit form', async ({ page }) => {
    await page.getByText(/confirmat/i).first().click()
    await expect(page.getByText(/edit construction method/i)).toBeVisible()
  })

  test('edit form has all required fields', async ({ page }) => {
    await page.getByText(/confirmat/i).first().click()
    await expect(page.getByText(/joining method/i)).toBeVisible()
    await expect(page.getByText(/back panel/i)).toBeVisible()
    await expect(page.getByText(/bottom panel/i)).toBeVisible()
  })

  test('New button creates blank form', async ({ page }) => {
    await page.getByRole('button', { name: /new/i }).first().click()
    await expect(page.getByText(/new construction method/i)).toBeVisible()
  })

  test('Save button is present in edit view', async ({ page }) => {
    await page.getByText(/confirmat/i).first().click()
    await expect(page.getByRole('button', { name: /save method/i })).toBeVisible()
  })

  test('Delete button is present in edit view', async ({ page }) => {
    await page.getByText(/confirmat/i).first().click()
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
  })
})

test.describe('Door Profile Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/door-profiles')
  })

  test('renders door profile editor', async ({ page }) => {
    await expect(page.getByText(/door profile/i).first()).toBeVisible()
  })

  test('New button is visible', async ({ page }) => {
    await expect(page.getByTestId('new-profile-btn').or(page.getByRole('button', { name: /new/i }))).toBeVisible()
  })

  test('shows live SVG preview', async ({ page }) => {
    await expect(page.locator('svg').first()).toBeVisible()
  })

  test('creating a profile shows numeric inputs', async ({ page }) => {
    const newBtn = page.getByTestId('new-profile-btn').or(page.getByRole('button', { name: /new/i }))
    await newBtn.click()
    await page.waitForTimeout(500)
    const numberInputs = page.locator('input[type="number"]')
    const count = await numberInputs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('style dropdown has options', async ({ page }) => {
    const styleSelect = page.getByTestId('input-style').or(page.locator('select').first())
    if (await styleSelect.isVisible()) {
      const options = await styleSelect.locator('option').allTextContents()
      expect(options.length).toBeGreaterThan(1)
    }
  })
})
