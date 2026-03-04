import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test.describe('Login page', () => {
    test('renders login form with all fields', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('CNC Cabinet Manager')).toBeVisible()
      await expect(page.getByText('Sign in to your account')).toBeVisible()
      await expect(page.getByLabel('Email address')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
      await expect(page.getByText('Create one')).toBeVisible()
    })

    test('shows validation error when submitting empty form', async ({ page }) => {
      await page.goto('/login')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByText(/required/i).or(page.locator('#email:invalid'))).toBeVisible()
    })

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/login')
      await page.locator('#email').fill('wrong@test.com')
      await page.locator('#password').fill('wrongpass')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.locator('.text-red-300')).toBeVisible({ timeout: 10_000 })
    })

    test('successful login redirects to dashboard', async ({ page }) => {
      await page.goto('/login')
      await page.locator('#email').fill('admin@cnc.dev')
      await page.locator('#password').fill('Admin123!')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
    })

    test('link to register page works', async ({ page }) => {
      await page.goto('/login')
      await page.getByText('Create one').click()
      await expect(page).toHaveURL(/register/)
    })
  })

  test.describe('Register page', () => {
    test('renders registration form with all fields', async ({ page }) => {
      await page.goto('/register')
      await expect(page.getByText('Create your account')).toBeVisible()
      await expect(page.getByLabel('First name')).toBeVisible()
      await expect(page.getByLabel('Last name')).toBeVisible()
      await expect(page.getByLabel('Email address')).toBeVisible()
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Confirm password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    })

    test('shows error for password mismatch', async ({ page }) => {
      await page.goto('/register')
      await page.locator('#email').fill('test@test.com')
      await page.locator('#password').fill('Password123!')
      await page.locator('#confirmPassword').fill('Different123!')
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByText(/passwords do not match/i)).toBeVisible()
    })

    test('shows error for short password', async ({ page }) => {
      await page.goto('/register')
      await page.locator('#email').fill('test@test.com')
      await page.locator('#password').fill('short')
      await page.locator('#confirmPassword').fill('short')
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
    })

    test('link to login page works', async ({ page }) => {
      await page.goto('/register')
      await page.getByText('Sign in').click()
      await expect(page).toHaveURL(/login/)
    })
  })

  test.describe('Protected routes', () => {
    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/login/)
    })

    test('unauthenticated user accessing /jobs is redirected', async ({ page }) => {
      await page.goto('/jobs')
      await expect(page).toHaveURL(/login/)
    })

    test('root path redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/login/)
    })
  })
})
