import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { SessionStore } from '../src/server/core/session';
import { readConfig } from '../src/server/core/config';
import { serviceClient } from '../src/server/core/transport';
import { list } from '../pocs/walt-fixture';

async function owned(context: BrowserContext) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing owning session');
  const store = new SessionStore(readConfig());
  try {
    const walletId = store.binding(token)?.walletId;
    if (!walletId) throw new Error('Missing wallet');
    return { token, walletId, offer: store.offer(token) };
  } finally { store.close(); }
}
async function credentials(context: BrowserContext) {
  const { walletId } = await owned(context);
  return serviceClient({ url: 'http://127.0.0.1:7006' })({ path: `/wallet/${walletId}/credentials`, decode: list });
}
async function start(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive sample credential' })).toBeEnabled();
}

test('F2 reviews a real offer without receiving; refresh, keyboard return and expiry retain the correct reference', async ({ page, context }) => {
  await start(page);
  expect(await credentials(context)).toEqual([]);
  await page.getByRole('button', { name: 'Receive sample credential' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review credential offer' })).toBeFocused();
  await expect(page.getByText('Offered by Northstar Learning', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Review credential offer', exact: true }).getByText('Alex Morgan', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Review credential offer', exact: true }).getByText('Cloud Foundations', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-10-15', { exact: true })).toBeVisible();
  const original = await owned(context);
  expect(original.offer).not.toBeNull();
  expect(await credentials(context)).toEqual([]);
  await page.screenshot({ path: '.local/evidence/F2-create-and-review-credential-offer-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  expect((await owned(context)).offer?.id).toBe(original.offer?.id);
  await page.getByRole('button', { name: 'Back to wallet' }).click();
  await expect(page.getByRole('button', { name: 'Receive sample credential' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  expect((await owned(context)).offer?.id).toBe(original.offer?.id);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/evidence/F2-create-and-review-credential-offer-mobile.png', fullPage: true });
  const store = new SessionStore(readConfig());
  try {
    if (!original.offer) throw new Error('Missing offer');
    store.expireOffer(original.token, original.offer.id);
  } finally { store.close(); }
  await page.reload();
  await expect(page.getByText('This offer has expired. Request a fresh offer to continue.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request fresh offer' }).click();
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  const current = await owned(context);
  expect(current.offer?.id).not.toBe(original.offer?.id);
  expect(current.walletId).toBe(original.walletId);
  expect(await credentials(context)).toEqual([]);
});

test('F2 a lost browser response and repeated clicks offer a check of the same real offer', async ({ page, context }) => {
  await start(page);
  let posts = 0;
  await page.route('**/api/offer', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++;
    if (posts !== 1) { await route.continue(); return; }
    await delay(250);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    // Controlled browser-side loss after a real successful server operation.
    await route.fulfill({ status: 504, contentType: 'application/json', body: '{}' });
  });
  const receive = page.getByRole('button', { name: 'Receive sample credential' });
  await receive.evaluate(button => { if (!(button instanceof HTMLButtonElement)) throw new Error('Expected a button'); button.click(); button.click(); });
  await expect(page.getByRole('button', { name: 'Check or retry offer' })).toBeVisible();
  expect(posts).toBe(1);
  const original = await owned(context);
  await page.getByRole('button', { name: 'Check or retry offer' }).click();
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  expect((await owned(context)).offer?.id).toBe(original.offer?.id);
  expect(await credentials(context)).toEqual([]);
});

test('F2 an unavailable real issuer keeps the wallet empty and retry succeeds after restart', async ({ page, context }) => {
  test.setTimeout(60000);
  await start(page);
  const before = await owned(context);
  expect(spawnSync('docker', ['compose', 'stop', 'issuer'], { stdio: 'ignore', timeout: 30000 }).status).toBe(0);
  try {
    await page.getByRole('button', { name: 'Receive sample credential' }).click();
    await expect(page.getByRole('button', { name: 'Check or retry offer' })).toBeVisible();
    await expect(page.getByText('The offer could not be confirmed. Your wallet is unchanged. Check or retry the same request.', { exact: true })).toBeVisible();
    expect(await credentials(context)).toEqual([]);
    expect((await owned(context)).offer).toBeNull();
    await page.screenshot({ path: '.local/evidence/F2-create-and-review-credential-offer-error.png', fullPage: true });
  } finally {
    expect(spawnSync('docker', ['compose', 'start', 'issuer'], { stdio: 'ignore', timeout: 30000 }).status).toBe(0);
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:7005/.well-known/openid-credential-issuer/openid4vci', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) break;
      } catch { /* Startup can briefly refuse the connection. */ }
      await delay(500);
    }
  }
  await page.getByRole('button', { name: 'Check or retry offer' }).click();
  await expect(page.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  expect((await owned(context)).walletId).toBe(before.walletId);
  expect(await credentials(context)).toEqual([]);
});
