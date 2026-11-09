import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { SessionStore } from '../src/server/core/session';
import { readConfig } from '../src/server/core/config';
import { serviceClient } from '../src/server/core/transport';
import { list } from '../pocs/walt-fixture';

async function owned(context: BrowserContext) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing session');
  const store = new SessionStore(readConfig());
  try {
    const walletId = store.binding(token)?.walletId;
    const offer = store.offer(token);
    if (!walletId || !offer) throw new Error('Missing wallet or offer');
    return { walletId, offer };
  } finally { store.close(); }
}
async function credentials(context: BrowserContext) {
  const { walletId } = await owned(context);
  return serviceClient({ url: 'http://127.0.0.1:7006' })({ path: `/wallet/${walletId}/credentials`, decode: list });
}
async function review(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await page.getByRole('button', { name: 'Receive sample credential' }).click();
  await expect(page.getByRole('button', { name: 'Accept credential', exact: true })).toBeVisible();
}

test('F3 accepts a real credential once, resumes receipt and permits another offer', async ({ page, context }) => {
  await review(page);
  const original = await owned(context);
  expect(await credentials(context)).toHaveLength(0);
  let accepts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/offer/decision') && request.method() === 'POST') accepts++; });
  const receiptResponse = page.waitForResponse(response => response.url().endsWith('/api/offer/decision') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Accept credential', exact: true }).evaluate(button => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected button');
    button.click(); button.click();
  });
  expect((await receiptResponse).ok()).toBe(true);
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible();
  expect(accepts).toBe(1);
  expect(await credentials(context)).toHaveLength(1);
  const replay = await context.request.post('/api/offer/decision', { headers: { Origin: 'http://localhost:47831', 'X-Demo-Offer': original.offer.id }, data: {} });
  expect(replay.ok()).toBe(true);
  expect(await credentials(context)).toHaveLength(1);
  await page.reload();
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Receive sample credential' }).click();
  await expect(page.getByRole('button', { name: 'Accept credential', exact: true })).toBeVisible();
  expect((await owned(context)).offer.id).not.toBe(original.offer.id);
  expect(await credentials(context)).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/evidence/F3-accept-or-decline-credential-mobile.png', fullPage: true });
  // Keyboard decline affects this second offer only, preserving the previous credential.
  await page.getByRole('button', { name: 'Decline offer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Offer declined. No credential was received from this offer.', { exact: true })).toBeVisible();
  expect(await credentials(context)).toHaveLength(1);
});

test('F3 keyboard decline receives nothing and persists after refresh', async ({ page, context }) => {
  await review(page);
  await page.getByRole('button', { name: 'Decline offer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Offer declined. No credential was received from this offer.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive sample credential' })).toBeFocused();
  expect(await credentials(context)).toHaveLength(0);
  await page.reload();
  await expect(page.getByText('Offer declined. No credential was received from this offer.', { exact: true })).toBeVisible();
  expect(await credentials(context)).toHaveLength(0);
});

test('F3 lost browser response checks real storage and never accepts twice', async ({ page, context }) => {
  await review(page);
  let accepts = 0;
  await page.route('**/api/offer/decision', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    accepts++;
    const result = await route.fetch();
    expect(result.ok()).toBe(true);
    await route.fulfill({ status: 504, contentType: 'application/json', body: '{}' });
  });
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check receipt', exact: true })).toBeVisible();
  expect(await credentials(context)).toHaveLength(1);
  await page.getByRole('button', { name: 'Check receipt', exact: true }).click();
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible();
  expect(accepts).toBe(1);
  expect(await credentials(context)).toHaveLength(1);
  await page.screenshot({ path: '.local/evidence/F3-accept-or-decline-credential-received.png', fullPage: true });
});
