import { test, expect, Page } from "@playwright/test";

const TEST_WALLETS = {
  alice: "GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  bob: "GBOBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  carol: "GCAROLXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
};

async function mockFreighter(page: Page, publicKey: string) {
  await page.addInitScript(
    ({ pk }: { pk: string }) => {
      let currentPk: string | null = pk;

      (window as unknown as Record<string, unknown>).freighter = {
        getUserInfo: async () => ({ publicKey: currentPk }),
        isConnected: async () => ({ isConnected: true }),
      };

      function triggerAccountChange(newPk: string) {
        currentPk = newPk;
        window.dispatchEvent(new Event("accountChange"));
      }

      (window as unknown as Record<string, unknown>).__switchWallet = (pk: string) => {
        triggerAccountChange(pk);
      };
    },
    { pk: publicKey },
  );
}

test.describe("Wallet identity toggling", () => {
  test("rapidly toggling between 3 wallets shows correct data for each", async ({
    page,
  }) => {
    await mockFreighter(page, TEST_WALLETS.alice);
    await page.goto("/");

    await expect(page.getByText("Vesting operations dashboard")).toBeVisible();

    const checkWalletData = async (expectedPk: string) => {
      const walletIndicator = page.locator("[data-testid=wallet-indicator]");
      await expect(walletIndicator).toHaveAttribute(
        "data-public-key",
        expectedPk,
      );
    };

    await checkWalletData(TEST_WALLETS.alice);

    for (let round = 0; round < 5; round++) {
      const wallets = [TEST_WALLETS.bob, TEST_WALLETS.carol, TEST_WALLETS.alice];
      for (const wallet of wallets) {
        await page.evaluate(
          ({ pk }: { pk: string }) =>
            ((window as unknown as Record<string, unknown>).__switchWallet as (pk: string) => void)(pk),
          { pk: wallet },
        );
        await page.waitForTimeout(50);
      }
    }

    await checkWalletData(TEST_WALLETS.alice);

    await page.evaluate(
      ({ pk }: { pk: string }) =>
        ((window as unknown as Record<string, unknown>).__switchWallet as (pk: string) => void)(pk),
      { pk: TEST_WALLETS.bob },
    );
    await page.waitForTimeout(100);
    await checkWalletData(TEST_WALLETS.bob);

    await page.evaluate(
      ({ pk }: { pk: string }) =>
        ((window as unknown as Record<string, unknown>).__switchWallet as (pk: string) => void)(pk),
      { pk: TEST_WALLETS.carol },
    );
    await page.waitForTimeout(100);
    await checkWalletData(TEST_WALLETS.carol);
  });

  test("no stale data displayed after rapid switching", async ({ page }) => {
    await mockFreighter(page, TEST_WALLETS.alice);
    await page.goto("/");

    const walletIndicator = page.locator("[data-testid=wallet-indicator]");
    await expect(walletIndicator).toHaveAttribute(
      "data-public-key",
      TEST_WALLETS.alice,
    );

    for (let i = 0; i < 10; i++) {
      const wallet =
        i % 3 === 0
          ? TEST_WALLETS.bob
          : i % 3 === 1
            ? TEST_WALLETS.carol
            : TEST_WALLETS.alice;
      await page.evaluate(
        ({ pk }: { pk: string }) =>
          ((window as unknown as Record<string, unknown>).__switchWallet as (pk: string) => void)(pk),
        { pk: wallet },
      );
      await page.waitForTimeout(30);
    }

    await page.evaluate(
      ({ pk }: { pk: string }) =>
        ((window as unknown as Record<string, unknown>).__switchWallet as (pk: string) => void)(pk),
      { pk: TEST_WALLETS.carol },
    );
    await page.waitForTimeout(200);

    const generationSpan = page.locator("[data-testid=wallet-generation]");
    const genText = await generationSpan.textContent();
    expect(genText).not.toBeNull();

    await expect(walletIndicator).toHaveAttribute(
      "data-public-key",
      TEST_WALLETS.carol,
    );
  });
});
