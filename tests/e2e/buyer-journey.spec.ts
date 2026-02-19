import { expect, test } from '@playwright/test'

test('critical buyer journey: browse -> view model -> add to cart -> checkout page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Browse Library/i })).toBeVisible()

  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: /Discover Models/i })).toBeVisible()

  const firstModelLink = page.locator('a[href^="/models/"]').first()
  await expect(firstModelLink).toBeVisible()
  await firstModelLink.click()

  await expect(page).toHaveURL(/\/models\//)

  const addButton = page.getByRole('button', { name: /^Add$/ }).first()
  await expect(addButton).toBeVisible()
  await addButton.click()

  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: /Cart/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Checkout/i })).toBeVisible()

  await page.getByRole('link', { name: /Checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByRole('heading', { name: /Checkout/i })).toBeVisible()
})
