import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from '../src/server/core/config';
import { SessionStore } from '../src/server/core/session';
import { serviceClient } from '../src/server/core/transport';
import { object } from '../pocs/walt-fixture';
import { parseSharing } from '../src/lib/sharing';
import { parseVerification } from '../src/lib/verification';

async function prepare(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await page.getByRole('button', { name: 'Receive sample credential', exact: true }).click();
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('1 stored credential.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review sharing in Wallet', exact: true })).toBeVisible();
}
async function owned(context: BrowserContext) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing session');
  const store = new SessionStore(readConfig());
  try {
    const reference = store.verification(token);
    if (!reference?.requestId || !reference.requestUrl) throw new Error('Missing verifier request');
    return { token, reference, sharing: store.sharing(token) };
  } finally { store.close(); }
}
const verifier = serviceClient({ url: 'http://127.0.0.1:7004' });
const wallet = serviceClient({ url: 'http://127.0.0.1:7006' });

test('F6 real review/cancel/review/approve matches whole credential; test-only exchange confirms actual disclosed claims', async ({ page, context }) => {
  await prepare(page);
  let approvals = 0;
  page.on('request', request => { if (request.url().endsWith('/api/sharing/decision') && request.method() === 'POST') approvals++; });
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Wallet (User)', exact: false })).toHaveAttribute('aria-selected', 'true');
  const reviewPanel = page.getByRole('region', { name: 'Review sharing', exact: true });
  await expect(reviewPanel.getByRole('button', { name: 'Approve sharing', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review sharing', exact: true })).toBeFocused();
  await expect(reviewPanel.getByText('The whole credential will be shared.', { exact: true })).toBeVisible();
  await expect(reviewPanel.getByText('Harbor Works · verifier', { exact: true })).toBeVisible();
  const reviewResponse = await context.request.get('/api/sharing'); const reviewValue: unknown = await reviewResponse.json(); const review = parseSharing(reviewValue);
  if (review.state !== 'reviewing') throw new Error(`Expected review, got ${review.state}`);
  const { reference } = await owned(context);
  const stored = await wallet({ path: `/wallet/${reference.walletId}/credentials/${reference.credentialId}`, decode: object });
  expect(review.review.claims).toEqual(object(stored['credential'])['credentialData']);
  await reviewPanel.getByText('View all credential claims to be shared', { exact: true }).click();
  await page.screenshot({ path: '.local/evidence/F6-review-and-approve-sharing-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await reviewPanel.getByRole('heading', { name: 'Review sharing', exact: true }).scrollIntoViewIfNeeded();
  await reviewPanel.screenshot({ path: '.local/evidence/F6-review-and-approve-sharing-mobile-panel.png', animations: 'disabled' });
  await page.screenshot({ path: '.local/evidence/F6-review-and-approve-sharing-mobile.png', fullPage: true, animations: 'disabled' });
  await reviewPanel.getByRole('button', { name: 'Cancel sharing', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Sharing cancelled. No presentation was sent.', { exact: true })).toBeVisible();
  expect((await verifier({ path: `/verification-session/${reference.requestId}/info`, decode: object }))['attempted']).toBe(false);
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  const approve = reviewPanel.getByRole('button', { name: 'Approve sharing', exact: true });
  await expect(approve).toBeVisible();
  await approve.evaluate(button => { if (!(button instanceof HTMLButtonElement)) throw new Error('Not a button'); button.click(); button.click(); });
  await expect(page.getByText('Sharing approved for this request.', { exact: false })).toBeVisible();
  expect(approvals).toBe(1);
  const approved = await owned(context); expect(approved.sharing?.state).toBe('approved');
  expect(approved.sharing?.reviewId).not.toBe(review.review.reviewId);
  expect((await verifier({ path: `/verification-session/${reference.requestId}/info`, decode: object }))['attempted']).toBe(false);
  await page.reload(); await expect(page.getByText('Sharing approved for this request.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve sharing', exact: true })).toHaveCount(0);
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);

  // F6 disclosure compatibility evidence only: no product presentation route/UI is introduced.
  const sent = await wallet({ path: `/wallet/${reference.walletId}/credentials/present`, method: 'POST', body: { requestUrl: reference.requestUrl }, decode: object, timeoutMs: 30000 });
  expect(sent['transmission_success']).toBe(true);
  let info = await verifier({ path: `/verification-session/${reference.requestId}/info`, decode: object });
  for (let attempt = 0; attempt < 20 && info['status'] !== 'SUCCESSFUL' && info['status'] !== 'FAILED'; attempt++) { await delay(250); info = await verifier({ path: `/verification-session/${reference.requestId}/info`, decode: object }); }
  expect(info['status']).toBe('SUCCESSFUL');
  const entries = object(info['presented_credentials'])['training'];
  if (!Array.isArray(entries) || entries.length !== 1) throw new Error('Expected one actually presented training credential');
  expect(object(entries[0])['credentialData']).toEqual(review.review.claims);
});

test('F6 foreign/expired/replaced reviews cannot approve; controlled lost browser approval reconciles once', async ({ page, context, browser }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve sharing', exact: true })).toBeVisible();
  const original = await owned(context);
  if (!original.sharing) throw new Error('Missing review reference');
  const other = await browser.newContext();
  try {
    expect((await other.request.post('/api/sharing/decision', { headers: { origin: 'http://localhost:47831', 'X-Demo-Review': original.sharing.reviewId }, data: {} })).status()).toBe(403);
  } finally { await other.close(); }
  const store = new SessionStore(readConfig());
  try { store.expireVerification(original.token, original.reference.attemptId); } finally { store.close(); }
  await page.getByRole('button', { name: 'Approve sharing', exact: true }).click();
  await expect(page.getByText('This sharing review is no longer current.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve sharing', exact: true })).toHaveCount(0);
  expect((await verifier({ path: `/verification-session/${original.reference.requestId}/info`, decode: object }))['attempted']).toBe(false);
  await context.request.post('/api/verification', { headers: { origin: 'http://localhost:47831' }, data: {} });
  expect((await context.request.post('/api/sharing/decision', { headers: { origin: 'http://localhost:47831', 'X-Demo-Review': original.sharing.reviewId }, data: {} })).status()).toBe(409);
  await page.reload();
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve sharing', exact: true })).toBeVisible();
  let posts = 0;
  await page.route('**/api/sharing/decision', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++; const response = await route.fetch(); expect(response.ok()).toBe(true);
    await route.fulfill({ status: 504, contentType: 'application/json', body: '{}' });
  });
  await page.getByRole('button', { name: 'Approve sharing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check sharing review', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check sharing review', exact: true }).click();
  await expect(page.getByText('Sharing approved for this request.', { exact: false })).toBeVisible();
  expect(posts).toBe(1);
  const request = await context.request.get('/api/verification'); const value: unknown = await request.json(); expect(parseVerification(value).state).toBe('ready');
});
