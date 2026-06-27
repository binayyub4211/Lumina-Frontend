import { expect, test } from '@playwright/test'

const cases = [
  { width: 320, expectedColumns: 1 },
  { width: 768, expectedColumns: 2 },
  { width: 1440, expectedColumns: 3 },
  { width: 2560, expectedColumns: 3 },
]

test.describe('Dashboard container queries', () => {
  for (const { width, expectedColumns } of cases) {
    test(`lays out card content in ${expectedColumns} column(s) at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard/facility')

      const solarCards = page.locator('.card-content').first()
      await expect(solarCards).toBeVisible()

      const columnCount = await solarCards.evaluate((element) => {
        const columns = window.getComputedStyle(element).gridTemplateColumns
        return columns.split(' ').filter(Boolean).length
      })

      expect(columnCount).toBe(expectedColumns)
    })
  }
})
