import { test, expect } from '@playwright/test'

test.describe('Navigation & Layout', () => {
  test('authenticated user sees sidebar and header', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first()).toBeVisible()
    await expect(page.locator('header, [class*="Header"]').first()).toBeVisible()
  })

  test.describe('Sidebar navigation links', () => {
    const routes = [
      { name: /dashboard/i, url: '/dashboard' },
      { name: /jobs/i, url: '/jobs' },
      { name: /materials/i, url: '/materials' },
      { name: /textures/i, url: '/textures' },
      { name: /hardware/i, url: '/hardware' },
      { name: /machines/i, url: '/machines' },
      { name: /post proc/i, url: '/post-processors' },
      { name: /optimizer/i, url: '/optimizer' },
      { name: /g.?code/i, url: '/gcode' },
      { name: /cut\s*list/i, url: '/cutlists' },
      { name: /bom/i, url: '/bom' },
      { name: /quotes/i, url: '/quotes' },
      { name: /labels/i, url: '/labels' },
      { name: /users/i, url: '/users' },
      { name: /settings/i, url: '/settings' },
    ]

    for (const route of routes) {
      test(`navigates to ${route.url}`, async ({ page }) => {
        await page.goto('/dashboard')
        const link = page.locator(`a[href="${route.url}"]`).first()
        if (await link.isVisible()) {
          await link.click()
          await expect(page).toHaveURL(new RegExp(route.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        }
      })
    }
  })

  test('all pages render without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(`${page.url()}: ${err.message}`))

    const routes = [
      '/dashboard', '/jobs', '/jobs/new', '/room-designer', '/products',
      '/parts', '/materials', '/textures', '/hardware',
      '/machines', '/tools', '/post-processors', '/optimizer', '/gcode',
      '/flipside', '/dovetail', '/cutlists', '/bom', '/quotes',
      '/drawings', '/labels', '/exports', '/shop/cutlist', '/shop/assembly',
      '/shop/labels', '/cnc-operator', '/render', '/users', '/settings',
      '/construction-methods', '/door-profiles', '/remake-bin',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)
    }

    expect(errors).toEqual([])
  })
})
