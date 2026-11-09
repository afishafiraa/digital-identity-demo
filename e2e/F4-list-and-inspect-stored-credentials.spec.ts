import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { readConfig } from '../src/server/core/config';
import { SessionStore } from '../src/server/core/session';
import { serviceClient } from '../src/server/core/transport';
import { object } from '../pocs/walt-fixture';
import { parseCredentials } from '../src/lib/credentials';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await expect(page.getByText('No credentials received yet.', { exact: false })).toBeVisible();
}
async function accept(page: Page) {
  await page.getByRole('button', { name: 'Receive sample credential' }).click();
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible();
  await expect(page.getByText('1 stored credential.', { exact: false })).toBeVisible();
}
async function stored(context: BrowserContext, id: string) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing session');
  const store = new SessionStore(readConfig());
  try {
    const walletId = store.binding(token)?.walletId;
    if (!walletId) throw new Error('Missing wallet');
    return await serviceClient({ url: 'http://127.0.0.1:7006' })({ path: `/wallet/${walletId}/credentials/${id}`, decode: object });
  } finally { store.close(); }
}

test('F4 real empty → accepted → inline details matches storage, refresh and isolated visitor', async ({ page, context, browser }) => {
  await start(page);
  await expect(page.getByRole('button', { name: 'Receive sample credential' })).toBeEnabled();
  await accept(page);
  const response = await context.request.get('/api/credentials');
  const value: unknown = await response.json();
  const [credential] = parseCredentials(value);
  if (!credential) throw new Error('Missing credential');
  const entry = await stored(context, credential.id);
  const claims = object(object(entry['credential'])['credentialData']);
  expect(credential.issuer).toBe(claims['issuer_name']);
  expect(credential.issuerId).toBe(claims['iss']);
  expect(credential.holderName).toBe(claims['holder_name']);
  expect(credential.course).toBe(claims['course']);
  expect(credential.completionDate).toBe(claims['completion_date']);
  for (const [field, claim] of [['issuedAt', 'iat'], ['notBefore', 'nbf'], ['expiresAt', 'exp']] as const) {
    const seconds = claims[claim];
    if (typeof seconds !== 'number') throw new Error('Missing real timestamp');
    expect(credential[field]).toBe(new Date(seconds * 1000).toISOString());
  }
  expect(credential.addedAt).toBe(entry['addedAt']);
  const summary = page.locator('.stored-card > summary');
  await summary.focus(); await page.keyboard.press('Enter');
  const card = page.locator('.stored-card');
  await expect(card.getByRole('heading', { name: 'Training Certificate', exact: true })).toBeVisible();
  await expect(card.locator('.credential-document').getByText(credential.holderName, { exact: true })).toBeVisible();
  await expect(card.getByText(credential.issuerId, { exact: true })).toBeVisible();
  for (const date of [credential.addedAt, credential.issuedAt, credential.notBefore, credential.expiresAt]) {
    if (!date) throw new Error('Missing date');
    expect(await card.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))).toContain(date);
  }
  await expect(card.getByText('Signature validity and revocation status have not been checked in this view.', { exact: false })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/F4-list-and-inspect-stored-credentials-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('1 stored credential.', { exact: false })).toBeVisible();
  await page.locator('.stored-card > summary').click();
  const refreshed = await context.request.get('/api/credentials');
  const refreshedValue: unknown = await refreshed.json();
  expect(parseCredentials(refreshedValue)).toEqual([credential]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/evidence/F4-list-and-inspect-stored-credentials-mobile.png', fullPage: true });
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage(); await start(otherPage);
    const foreign = await other.request.get(`/api/credentials?credentialId=${credential.id}`);
    expect(foreign.status()).toBe(400);
    const own = await other.request.get('/api/credentials');
    const ownValue: unknown = await own.json();
    expect(parseCredentials(ownValue)).toEqual([]);
    await expect(otherPage.locator('.stored-card')).toHaveCount(0);
  } finally { await other.close(); }
});

test('F4 failed read is unavailable rather than empty, retry restores real card and unknown dates stay explicit', async ({ page }) => {
  await start(page); await accept(page);
  let fail = true;
  let unknown = false;
  await page.route('**/api/credentials', async route => {
    if (fail) { await route.fulfill({ status: 502, contentType: 'application/json', body: '{}' }); return; }
    if (!unknown) { await route.continue(); return; }
    const response = await route.fetch();
    const value: unknown = await response.json();
    const credentials = parseCredentials(value).map(credential => ({ ...credential, expiresAt: null }));
    await route.fulfill({ response, json: credentials });
  });
  await page.reload();
  await expect(page.getByText('Wallet contents and validity are unavailable.', { exact: false })).toBeVisible();
  await expect(page.locator('.stored-card')).toHaveCount(0);
  await expect(page.getByText('No credentials received yet.', { exact: false })).toHaveCount(0);
  fail = false; unknown = true;
  await page.getByRole('button', { name: 'Retry wallet read', exact: true }).click();
  await expect(page.locator('.stored-card')).toHaveCount(1);
  await page.locator('.stored-card > summary').click();
  await expect(page.locator('.stored-card').getByText('Not provided', { exact: true })).toBeVisible();
});

test('F4 a controlled pending acceptance displays no received credential', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Receive sample credential' }).click();
  await page.route('**/api/offer/decision', async route => {
    await route.fulfill({ status: 202, contentType: 'application/json', json: { state: 'accepting' } });
  });
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check receipt', exact: true })).toBeVisible();
  await expect(page.getByText('No credentials received yet.', { exact: false })).toBeVisible();
  await expect(page.locator('.stored-card')).toHaveCount(0);
});
