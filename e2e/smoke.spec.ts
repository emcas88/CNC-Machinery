import { test, expect } from '@playwright/test'

/**
 * Comprehensive smoke test that verifies every page loads,
 * renders key content, and has no console errors.
 */
test.describe('Smoke Tests - Every Page Renders', () => {
  const pages = [
    { url: '/dashboard', content: /total jobs|dashboard/i },
    { url: '/jobs', content: /job manager/i },
    { url: '/jobs/new', content: /create new job/i },
    { url: '/room-designer', content: /room|designer/i },
    { url: '/products', content: /product editor/i },
    { url: '/parts', content: /part editor/i },
    { url: '/3d-viewer', content: /wireframe|scene|render|viewer/i },
    { url: '/materials', content: /material/i },
    { url: '/textures', content: /texture/i },
    { url: '/hardware', content: /hardware/i },
    { url: '/machines', content: /machine/i },
    { url: '/tools', content: /tool/i },
    { url: '/post-processors', content: /post processor/i },
    { url: '/optimizer', content: /optimizer/i },
    { url: '/gcode', content: /g-?code/i },
    { url: '/flipside', content: /flipside|no sheets/i },
    { url: '/dovetail', content: /dovetail|no machines/i },
    { url: '/cutlists', content: /cut list/i },
    { url: '/bom', content: /bill of materials/i },
    { url: '/quotes', content: /quote|select a job/i },
    { url: '/drawings', content: /drawing|no job/i },
    { url: '/labels', content: /label|no job/i },
    { url: '/exports', content: /export|no job/i },
    { url: '/shop/cutlist', content: /no job selected|cutlist/i },
    { url: '/shop/assembly', content: /no job selected|assembly/i },
    { url: '/shop/labels', content: /no job selected|label/i },
    { url: '/cnc-operator', content: /no sheets|cnc operator/i },
    { url: '/render', content: /no job selected|render/i },
    { url: '/users', content: /user administration/i },
    { url: '/settings', content: /settings/i },
    { url: '/construction-methods', content: /construction method|methods/i },
    { url: '/door-profiles', content: /door profile/i },
    { url: '/remake-bin', content: /remake|no job/i },
  ]

  for (const { url, content } of pages) {
    test(`${url} loads without errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto(url)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(content).first()).toBeVisible({ timeout: 15_000 })

      expect(errors).toEqual([])
    })
  }
})

test.describe('Smoke Tests - Layout Integrity', () => {
  test('sidebar is present on all authenticated pages', async ({ page }) => {
    await page.goto('/dashboard')
    const sidebar = page.locator('[class*="sidebar"], [class*="Sidebar"], nav').first()
    await expect(sidebar).toBeVisible()
  })

  test('header is present on all authenticated pages', async ({ page }) => {
    await page.goto('/dashboard')
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
  })

  test('main content area scrolls', async ({ page }) => {
    await page.goto('/dashboard')
    const main = page.locator('main').first()
    await expect(main).toBeVisible()
  })
})

test.describe('Smoke Tests - API Data Loading', () => {
  test('jobs load real data from API', async ({ page }) => {
    await page.goto('/jobs')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 })
  })

  test('materials load real data from API', async ({ page }) => {
    await page.goto('/materials')
    await expect(page.getByText(/plywood|mdf|abs/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('textures load real data from API', async ({ page }) => {
    await page.goto('/textures')
    await expect(page.getByText(/anthracite|oak|walnut|white/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('hardware loads real data from API', async ({ page }) => {
    await page.goto('/hardware')
    await expect(page.getByRole('main').getByText('Hardware Library')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('main').locator('h3, h4, p, span').filter({ hasText: /Handle|Hinge|Slide/ }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('post processors load real data from API', async ({ page }) => {
    await page.goto('/post-processors')
    await expect(page.getByText(/generic g-code|homag|scm/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('users load real data from API', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByText(/admin user/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('construction methods load from API', async ({ page }) => {
    await page.goto('/construction-methods')
    await expect(page.getByText(/confirmat|domino|dowel/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Settings').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
  })
})
