import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseProfile } from '../src/lib/profile';

test.use({ baseURL: process.env['DEMO_TEST_ORIGIN'] ?? 'http://localhost:47831' });

async function walletId(page: Page): Promise<string> {
  const response = await page.request.get('/api/profile');
  expect(response.ok()).toBe(true);
  const value: unknown = await response.json();
  return parseProfile(value).walletId;
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible({ timeout: 20000 });
}
async function exchange(page: Page) {
  await page.getByRole('button', { name: 'Receive sample credential', exact: true }).click();
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible({ timeout: 20000 });
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Approve sharing', exact: true }).click();
  await page.getByRole('button', { name: 'Send presentation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible({ timeout: 35000 });
}

test('F9 real reset isolates visitors, blocks a late old result and permits a fresh real exchange after refresh', async ({ page, browser, baseURL }) => {
  test.setTimeout(180000);
  const other = await browser.newContext({ baseURL: baseURL ?? 'http://localhost:47831' });
  try {
    await start(page); await exchange(page);
    const oldWallet = await walletId(page);
    const b = await other.newPage(); await start(b); await exchange(b);
    const walletB = await walletId(b);
    const beforeB = await b.request.get('/api/credentials'); const credentialsB = await beforeB.text();
    let release: (() => void) | undefined;
    let received: (() => void) | undefined;
    let finished: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const held = new Promise<void>(resolve => { received = resolve; });
    const delivered = new Promise<void>(resolve => { finished = resolve; });
    await page.route('**/api/presentation', async route => {
      const response = await route.fetch();
      received?.(); await gate;
      await route.fulfill({ response });
      finished?.();
    });
    await page.reload(); await held;
    let resets = 0;
    page.on('request', request => { if (request.url().endsWith('/api/session/reset') && request.method() === 'POST') resets++; });
    await page.getByRole('button', { name: 'Reset demo', exact: true }).evaluate(button => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('Expected reset button');
      button.click(); button.click();
    });
    await expect(page.getByText('Demo reset', { exact: true })).toBeVisible();
    expect(resets).toBe(1); release?.(); await delivered; await page.unroute('**/api/presentation');
    await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toHaveCount(0);
    await page.reload(); await page.getByRole('button', { name: 'Start demo', exact: true }).click();
    await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible({ timeout: 20000 });
    expect(await walletId(page)).not.toBe(oldWallet);
    const empty = await page.request.get('/api/credentials'); const emptyValue: unknown = await empty.json();
    expect(emptyValue).toEqual([]);
    await exchange(page);
    await b.reload(); await expect(b.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible();
    expect(await walletId(b)).toBe(walletB);
    expect(await (await b.request.get('/api/credentials')).text()).toBe(credentialsB);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Reset demo', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.local/evidence/F9-reset-current-demo-mobile.png', fullPage: true });
  } finally { await other.close(); }
});

test('F9 failed or lost reset replies never claim early completion or blindly repeat the reset', async ({ page }) => {
  test.setTimeout(90000);
  await start(page);
  const oldWallet = await walletId(page);
  let mutations = 0;
  await page.route('**/api/session/reset', async route => {
    mutations++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByText('Reset not confirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check reset status', exact: true }).click();
  await expect(page.getByText('Reset not confirmed', { exact: true })).toBeVisible();
  expect(mutations).toBe(1); expect(await walletId(page)).toBe(oldWallet);
  await page.reload(); await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
  await page.unroute('**/api/session/reset');
  await page.route('**/api/session/reset', async route => {
    mutations++;
    const response = await route.fetch(); expect(response.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByText('Reset not confirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check reset status', exact: true }).click();
  await expect(page.getByText('Demo reset', { exact: true })).toBeVisible();
  expect(mutations).toBe(2);
  await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible({ timeout: 20000 });
  expect(await walletId(page)).not.toBe(oldWallet);
});
