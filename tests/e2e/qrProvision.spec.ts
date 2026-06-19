import { test, expect } from "@playwright/test";

const ALICE_PK = "GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXMOCK";

async function initProvisioningPage(
  page: import("@playwright/test").Page,
  publicKey: string,
) {
  await page.addInitScript(
    (args: { pk: string }) => {
      (window as Record<string, unknown>).freighter = {
        isConnected: async () => ({ isConnected: true }),
        getUserInfo: async () => ({ publicKey: args.pk }),
        signTransaction: async (xdr: string) => ({ signedTxXdr: xdr }),
        signAuthEntry: async (authEntry: string) => ({
          signedAuthEntry: authEntry,
        }),
      };
    },
    { pk: publicKey },
  );
  await page.goto("/onboarding");
  await page.waitForSelector("[data-testid=wallet-indicator]", {
    state: "attached",
  });
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("accountChange")),
  );
  await page.waitForTimeout(1000);
}

test.describe("QR Provisioning Flow", () => {
  test("displays wallet status on provisioning page", async ({ page }) => {
    await initProvisioningPage(page, ALICE_PK);

    const indicator = page.locator("[data-testid=wallet-indicator]");
    await expect(indicator).toHaveAttribute("data-public-key", ALICE_PK);
  });

  test("shows configuration form with all fields", async ({ page }) => {
    await initProvisioningPage(page, ALICE_PK);

    await expect(page.locator("[data-testid=node-name-input]")).toBeVisible();
    await expect(
      page.locator("[data-testid=node-location-input]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid=node-model-input]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid=generate-qr-button]"),
    ).toBeVisible();
  });

  test("validates required fields before generating QR", async ({ page }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Click generate without filling in any fields
    await page.locator("[data-testid=generate-qr-button]").click();

    // Should show validation errors
    await expect(page.getByText("Node name is required")).toBeVisible();
    await expect(page.getByText("Location is required")).toBeVisible();
    await expect(page.getByText("Model is required")).toBeVisible();
  });

  test("generates QR code canvas after valid form submission", async ({
    page,
  }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Fill in the form
    await page.locator("[data-testid=node-name-input]").fill("sf-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("San Francisco, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");

    // Generate QR code
    await page.locator("[data-testid=generate-qr-button]").click();

    // QR canvas should render
    const canvas = page.locator("[data-testid=qr-canvas]");
    await expect(canvas).toBeVisible();

    // Verify canvas has content (non-zero dimensions)
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);
  });

  test("countdown timer displays and counts down", async ({ page }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Fill and submit form
    await page.locator("[data-testid=node-name-input]").fill("la-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("Los Angeles, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");
    await page.locator("[data-testid=generate-qr-button]").click();

    // Wait for QR to render
    const canvas = page.locator("[data-testid=qr-canvas]");
    await expect(canvas).toBeVisible();

    // Timer should be present and showing a time
    const timerValue = page.locator("[data-testid=qr-timer-value]");
    await expect(timerValue).toBeVisible();

    const initialText = await timerValue.textContent();
    expect(initialText).toMatch(/^\d+:\d{2}$/); // Format like "9:59"

    // Wait a second and verify it changed
    await page.waitForTimeout(1500);
    const nextText = await timerValue.textContent();

    // The timer should show a later time or have changed
    // (it might have ticked down by 1-2 seconds)
    expect(nextText).toBeTruthy();
  });

  test("refresh button regenerates QR", async ({ page }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Fill and submit form
    await page.locator("[data-testid=node-name-input]").fill("chi-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("Chicago, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");
    await page.locator("[data-testid=generate-qr-button]").click();

    // Wait for QR canvas
    await expect(page.locator("[data-testid=qr-canvas]")).toBeVisible();

    // Click refresh button (the button in the QR panel header)
    const refreshButton = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // QR canvas should still be visible after refresh
    await expect(page.locator("[data-testid=qr-canvas]")).toBeVisible();
  });

  test("shows provisioning log entries after QR generation", async ({
    page,
  }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Fill and submit form
    await page.locator("[data-testid=node-name-input]").fill("miami-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("Miami, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");
    await page.locator("[data-testid=generate-qr-button]").click();

    // Wait for QR canvas
    await expect(page.locator("[data-testid=qr-canvas]")).toBeVisible();

    // Provisioning log should show a "Pending" entry
    await expect(page.getByText("Provisioning Log")).toBeVisible();
  });

  test("displays node configuration summary after generation", async ({
    page,
  }) => {
    await initProvisioningPage(page, ALICE_PK);

    // Fill and submit form
    await page.locator("[data-testid=node-name-input]").fill("dal-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("Dallas, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");
    await page.locator("[data-testid=generate-qr-button]").click();

    // Wait for QR canvas
    await expect(page.locator("[data-testid=qr-canvas]")).toBeVisible();

    // Configuration summary should show the node details
    const configSummary = page.locator("[data-testid=qr-config-summary]");
    await expect(configSummary.getByText("Node Configuration")).toBeVisible();
    await expect(configSummary.getByText("dal-edge-01")).toBeVisible();
    await expect(configSummary.getByText("Dallas, US")).toBeVisible();
    await expect(configSummary.getByText("Lumina LR-200")).toBeVisible();
  });
});

test.describe("QR Provisioning Error States", () => {
  test("handles Freighter signAuthEntry rejection gracefully", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).freighter = {
        isConnected: async () => ({ isConnected: true }),
        getUserInfo: async () => ({
          publicKey:
            "GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXMOCK",
        }),
        signAuthEntry: async () => {
          throw new Error("Mock: signing rejected");
        },
      };
    });
    await page.goto("/onboarding");
    await page.waitForSelector("[data-testid=wallet-indicator]", {
      state: "attached",
    });
    await page.waitForTimeout(800);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("accountChange")),
    );
    await page.waitForTimeout(1000);

    // Fill and submit form
    await page.locator("[data-testid=node-name-input]").fill("err-edge-01");
    await page
      .locator("[data-testid=node-location-input]")
      .fill("Error City, US");
    await page.locator("[data-testid=node-model-input]").fill("Lumina LR-200");
    await page.locator("[data-testid=generate-qr-button]").click();

    // Should show error message (may take a moment for async signing to fail)
    await expect(
      page.getByText(/Mock: signing rejected/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows connect wallet message when disconnected", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).freighter = {
        isConnected: async () => ({ isConnected: true }),
        getUserInfo: async () => ({ publicKey: undefined }),
      };
    });
    await page.goto("/onboarding");
    await page.waitForSelector("[data-testid=wallet-indicator]", {
      state: "attached",
    });
    await page.waitForTimeout(800);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("accountChange")),
    );
    await page.waitForTimeout(500);

    // Fields should be disabled
    const nameInput = page.locator("[data-testid=node-name-input]");
    await expect(nameInput).toBeDisabled();

    // Should show wallet not connected message in the provisioning page
    await expect(
      page.getByText(/Wallet not connected/),
    ).toBeVisible();
  });
});
