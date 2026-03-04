import { test, expect } from '@playwright/test'

test.describe('Room Designer', () => {
  test('renders room designer page', async ({ page }) => {
    await page.goto('/room-designer')
    await expect(page.getByText(/room|designer|no room selected/i).first()).toBeVisible()
  })

  test('shows guidance when no room selected', async ({ page }) => {
    await page.goto('/room-designer')
    await expect(page.getByText(/select a room|no room/i)).toBeVisible()
  })
})

test.describe('Product Editor', () => {
  test('renders product editor page', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Product Editor' })).toBeVisible()
  })

  test('shows 3D product editor content', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByText(/product|cabinet|canvas|3d/i).first()).toBeVisible()
  })
})

test.describe('Part Editor', () => {
  test('renders part editor page', async ({ page }) => {
    await page.goto('/parts')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Part Editor' })).toBeVisible()
  })

  test('shows 2D part editor content', async ({ page }) => {
    await page.goto('/parts')
    await expect(page.getByText(/part|canvas|2d/i).first()).toBeVisible()
  })
})

test.describe('3D Viewer', () => {
  test('renders 3D viewer page', async ({ page }) => {
    await page.goto('/3d-viewer')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Scene Objects' })).toBeVisible()
  })

  test('scene objects panel is visible', async ({ page }) => {
    await page.goto('/3d-viewer')
    await expect(page.getByRole('main').getByText('Scene Objects', { exact: true })).toBeVisible()
  })

  test('render settings panel is visible', async ({ page }) => {
    await page.goto('/3d-viewer')
    await expect(page.getByRole('main').getByText('Render Settings', { exact: true })).toBeVisible()
  })
})
