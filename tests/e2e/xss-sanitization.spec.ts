import { test, expect } from "@playwright/test";

/**
 * XSS Sanitization Tests
 *
 * These tests verify that the sanitizer correctly neutralises XSS payloads
 * in node labels, descriptions, and metadata fields that originate from
 * on-chain data (which can be set by any network participant).
 *
 * Strategy:
 * - Navigate to /node-list-demo which renders NodeCard/NodeList with mock
 *   on-chain data and exposes sanitizeNodeString on window.__sanitizeNodeString__
 * - Use page.evaluate to call sanitizeNodeString directly on various payloads.
 */

const XSS_PAYLOADS: Record<string, string> = {
  scriptTag: '<script>alert("xss")</script>',
  eventHandler: '<img src=x onerror="alert(1)">',
  javaScriptUri: '<a href="javascript:alert(1)">click</a>',
  iframe: '<iframe src="https://evil.com"></iframe>',
  encodedScript: "&lt;script&gt;alert(1)&lt;/script&gt;",
  homoglyph: "\uFF1Cscript\uFF1Ealert(1)\uFF1C/script\uFF1E",
};

/**
 * Navigate to the demo page and wait for the sanitizer to be exposed
 * on window.__sanitizeNodeString__.
 */
async function gotoDemoAndWait(page: import("@playwright/test").Page) {
  await page.goto("/node-list-demo");
  await page.waitForSelector("[data-testid=node-card]", {
    state: "attached",
  });
  // Wait for useEffect to expose the sanitizer on window
  await page.waitForFunction(
    () =>
      (window as unknown as Record<string, unknown>).__sanitizeNodeString__ !==
      undefined,
  );
}

/**
 * Call sanitizeNodeString from the page context.
 */
async function sanitize(page: import("@playwright/test").Page, input: string) {
  return page.evaluate((payload: string) => {
    const fn = (window as unknown as Record<string, unknown>)
      .__sanitizeNodeString__ as (dirty: string) => string;
    return fn(payload);
  }, input);
}

test.describe("XSS Sanitization — NodeCard rendering", () => {
  test("NodeCard renders node labels with allowed formatting tags", async ({
    page,
  }) => {
    await gotoDemoAndWait(page);

    const sfoCard = page.locator('[data-node-id="node-002-sfo-edge"]');
    await expect(sfoCard).toBeVisible();

    const sfoLabel = sfoCard.locator("h3");
    const sfoLabelHTML = await sfoLabel.innerHTML();
    expect(sfoLabelHTML).toContain("<b>SFO</b>");
  });

  test("NodeCard renders metadata with allowed italic tag", async ({
    page,
  }) => {
    await gotoDemoAndWait(page);

    const sfoCard = page.locator('[data-node-id="node-002-sfo-edge"]');
    const cardHTML = await sfoCard.innerHTML();

    expect(cardHTML).toContain("<i>Pacific</i>");
  });

  test("NodeCard aria-label strips HTML tags", async ({ page }) => {
    await gotoDemoAndWait(page);

    const sfoCard = page.locator('[data-node-id="node-002-sfo-edge"]');
    const ariaLabel = await sfoCard.getAttribute("aria-label");

    expect(ariaLabel).not.toContain("<b>");
    expect(ariaLabel).not.toContain("<i>");
    expect(ariaLabel).toContain("SFO Edge Router");
  });
});

test.describe("XSS Sanitization — sanitizeNodeString", () => {
  test("strips script tags", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.scriptTag);

    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });

  test("strips event handlers", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.eventHandler);

    expect(result).not.toContain("onerror");
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onmouseover");
  });

  test("strips JavaScript URIs", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.javaScriptUri);

    expect(result).not.toContain("javascript:");
  });

  test("strips iframe tags", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.iframe);

    expect(result).not.toContain("<iframe");
  });

  test("neutralizes encoded HTML entities", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.encodedScript);

    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });

  test("handles Unicode homoglyph attacks", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, XSS_PAYLOADS.homoglyph);

    // Fullwidth angle brackets (U+FF1C, U+FF1E) should not produce HTML tags
    expect(result).not.toMatch(/<script[^>]*>/i);
  });

  test("preserves allowed formatting tags", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(page, "<b>Bold</b> and <i>italic</i> text");

    expect(result).toContain("<b>");
    expect(result).toContain("<i>");
    expect(result).not.toContain("<script>");
  });

  test("adds rel attributes to anchor tags", async ({ page }) => {
    await gotoDemoAndWait(page);

    const result = await sanitize(
      page,
      '<a href="https://example.com">link</a>',
    );

    expect(result).toContain("nofollow");
    expect(result).toContain("noopener");
    expect(result).toContain("noreferrer");
  });
});
