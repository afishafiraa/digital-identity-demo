import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { readConfig } from '../src/server/core/config';
import { SessionStore } from '../src/server/core/session';
import { serviceClient } from '../src/server/core/transport';
import { object } from '../pocs/walt-fixture';
import { parseVerification } from '../src/lib/verification';
import { parseProfile } from '../src/lib/profile';
import { parseCredentials } from '../src/lib/credentials';

async function start(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await expect(page.getByText('No credentials received yet.', { exact: false })).toBeVisible();
}
async function accept(page: Page) {
  await page.getByRole('tab', { name: 'Wallet (User)', exact: false }).click();
  await page.getByRole('button', { name: 'Receive sample credential', exact: true }).click();
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('1 stored credential.', { exact: false })).toBeVisible();
}
async function reference(context: BrowserContext) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing session');
  const store = new SessionStore(readConfig());
  try {
    const ref = store.verification(token); if (!ref?.requestId) throw new Error('Missing real request');
    return { ref, token };
  } finally { store.close(); }
}

test('F5 real request, missing credential, no presentation, refresh, ownership and expiry', async ({ page, context, browser }) => {
  await start(page);
  const emptyProfileResponse = await context.request.get('/api/profile');
  expect(emptyProfileResponse.ok()).toBe(true);
  const emptyProfileValue: unknown = await emptyProfileResponse.json();
  expect(parseProfile(emptyProfileValue).keys).toEqual([]);
  const walletTab = page.getByRole('tab', { name: 'Wallet (User)', exact: false });
  await expect(walletTab).toHaveAttribute('aria-selected', 'true');
  await walletTab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Issuer', exact: false })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Northstar Learning', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/F5-role-tabs-issuer-desktop.png', fullPage: true });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Verifier', exact: false })).toBeFocused();
  await page.keyboard.press('Home'); await expect(walletTab).toBeFocused();
  await expect(page.getByRole('button', { name: 'Try verification', exact: true })).toBeHidden();
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await expect(page.getByText('Open Wallet (User), choose Receive sample credential, then accept it before trying verification.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Issuer', exact: false }).click();
  await page.getByRole('button', { name: 'Create sample offer', exact: true }).click();
  await expect(walletTab).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('1 stored credential.', { exact: false })).toBeVisible();
  await expect(page.getByText('View holder public key (JWK)', { exact: true })).toBeVisible();
  const profileResponse = await context.request.get('/api/profile');
  expect(profileResponse.ok()).toBe(true);
  const profileValue: unknown = await profileResponse.json(); const profile = parseProfile(profileValue);
  expect(profile.issuerDid).toMatch(/^did:jwk:/); expect(profile.holderPublicKey?.crv).toBe('P-256');
  const liveKeys = await serviceClient({ url: 'http://127.0.0.1:7006' })({ path: `/wallet/${profile.walletId}/keys`, decode: value => {
    if (!Array.isArray(value)) throw new Error('Missing keys');
    return value.map((entry: unknown) => { const key = object(entry); return { id: key['keyId'], type: key['keyType'] }; });
  } });
  expect(profile.keys).toEqual(liveKeys);
  expect(profile.keys.some(key => key.id === profile.holderThumbprint)).toBe(true);
  expect(JSON.stringify(profileValue)).not.toContain('holderKeyBinding');
  await page.screenshot({ path: '.local/evidence/F5-role-tabs-wallet-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Issuer', exact: false }).click();
  await expect(page.getByText('View issuer public key (JWK)', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/evidence/F5-identity-profile-issuer.png', fullPage: true });
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await expect(page.getByText('No verifier DID used in this flow', { exact: true })).toBeVisible();
  await page.getByText('How these identities communicate', { exact: true }).click();
  await expect(page.getByText('Issuer → Wallet · OID4VCI', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try verification', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Request prepared', exact: true })).toBeDisabled();
  const { ref, token } = await reference(context);
  const info = await serviceClient({ url: 'http://127.0.0.1:7004' })({ path: `/verification-session/${ref.requestId}/info`, decode: object });
  expect(info['status']).toBe('UNUSED'); expect(info['attempted']).toBe(false);
  const entries = object(object(object(info['setup'])['core_flow'])['dcql_query'])['credentials'];
  if (!Array.isArray(entries)) throw new Error('Missing query');
  expect(object(entries[0])['format']).toBe('dc+sd-jwt');
  expect(object(object(entries[0])['meta'])['vct_values']).toEqual(['urn:diw:training:1']);
  const raw = await (await context.request.get('/api/verification')).text();
  expect(raw).not.toContain('openid4vp'); expect(raw).not.toContain(ref.requestId);
  const repeated = await context.request.post('/api/verification', { headers: { origin: 'http://localhost:47831' }, data: {} });
  const value: unknown = await repeated.json(); const snapshot = parseVerification(value);
  if (snapshot.state !== 'ready') throw new Error('Not ready'); expect(snapshot.attemptId).toBe(ref.attemptId);
  await page.screenshot({ path: '.local/evidence/F5-create-verification-request-desktop.png', fullPage: true });
  await page.reload(); await page.getByRole('tab', { name: 'Verifier', exact: false }).click(); await expect(page.getByRole('button', { name: 'Request prepared', exact: true })).toBeVisible();
  expect((await reference(context)).ref.attemptId).toBe(ref.attemptId);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage(); await start(otherPage);
    expect((await other.request.get(`/api/verification?attemptId=${ref.attemptId}`)).status()).toBe(400);
    const own = await other.request.get('/api/verification'); const ownValue: unknown = await own.json(); expect(parseVerification(ownValue)).toEqual({ state: 'none' });
  } finally { await other.close(); }
  const store = new SessionStore(readConfig());
  try { store.expireVerification(token, ref.attemptId); } finally { store.close(); }
  await page.reload(); await page.getByRole('tab', { name: 'Verifier', exact: false }).click(); await expect(page.getByText('This request is no longer available.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Request prepared', exact: true })).toBeVisible();
  const next = (await reference(context)).ref; expect(next.attemptId).not.toBe(ref.attemptId);
  const untouched = await serviceClient({ url: 'http://127.0.0.1:7004' })({ path: `/verification-session/${next.requestId}/info`, decode: object });
  expect(untouched['attempted']).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/evidence/F5-create-verification-request-mobile.png', fullPage: true });
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
});

test('F5 controlled request failure keeps the real credential and retries successfully', async ({ page, context }) => {
  await start(page); await accept(page);
  const before = await context.request.get('/api/credentials'); const beforeValue: unknown = await before.json();
  let fail = true;
  await page.route('**/api/verification', async route => {
    if (fail && route.request().method() === 'POST') { await route.fulfill({ status: 502, contentType: 'application/json', body: '{}' }); return; }
    await route.continue();
  });
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await expect(page.getByText('Your credential stays in your wallet.', { exact: false })).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Retry verification request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Request prepared', exact: true })).toBeVisible();
  const after = await context.request.get('/api/credentials'); const afterValue: unknown = await after.json();
  expect(parseCredentials(afterValue)).toEqual(parseCredentials(beforeValue));
});
