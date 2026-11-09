import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { readConfig } from '../src/server/core/config';
import { SessionStore } from '../src/server/core/session';
import { serviceClient } from '../src/server/core/transport';
import { presentationHandler } from '../src/server/core/presentation-handler';
import { object } from '../pocs/walt-fixture';
import { parsePresentation } from '../src/lib/presentation';
import { parseSharing } from '../src/lib/sharing';

async function receive(page: Page) {
  await page.getByRole('button', { name: 'Receive sample credential', exact: true }).click();
  await page.getByRole('button', { name: 'Accept credential', exact: true }).click();
  await expect(page.getByText('Training Certificate received. Storage in your wallet is confirmed.', { exact: true })).toBeVisible();
}
async function approve(page: Page, twoCredentials = false) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start demo', exact: true }).click();
  await receive(page); if (twoCredentials) await receive(page);
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Try verification', exact: true }).click();
  await page.getByRole('button', { name: 'Review sharing in Wallet', exact: true }).click();
  await page.getByRole('button', { name: 'Approve sharing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send presentation', exact: true })).toBeVisible();
}
async function owned(context: BrowserContext) {
  const token = (await context.cookies()).find(cookie => cookie.name === 'diw-session')?.value;
  if (!token) throw new Error('Missing session');
  const store = new SessionStore(readConfig());
  try {
    const reference = store.verification(token); const sharing = store.sharing(token);
    if (!reference?.requestId || !sharing) throw new Error('Missing approved reference');
    return { token, reference, sharing };
  } finally { store.close(); }
}

test('F7 real approved exact credential is presented once, verified, restored and isolated from new attempts/visitors', async ({ page, context, browser }) => {
  test.setTimeout(60000);
  await approve(page, true);
  const before = await owned(context);
  const reviewResponse = await context.request.get('/api/sharing'); const reviewValue: unknown = await reviewResponse.json(); const review = parseSharing(reviewValue);
  if (review.state !== 'approved') throw new Error('Not approved');
  let posts = 0;
  page.on('request', request => { if (request.url().endsWith('/api/presentation') && request.method() === 'POST') posts++; });
  await page.getByRole('button', { name: 'Send presentation', exact: true }).evaluate(button => { if (!(button instanceof HTMLButtonElement)) throw new Error('Not a button'); button.click(); button.click(); });
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible({ timeout: 35000 }); expect(posts).toBe(1);
  const verifier = serviceClient({ url: 'http://127.0.0.1:7004' });
  const info = await verifier({ path: `/verification-session/${before.reference.requestId}/info`, decode: object });
  expect(info['status']).toBe('SUCCESSFUL'); expect(object(info['policy_results'])['overallSuccess']).toBe(true);
  const credentials = object(info['presented_credentials'])['training'];
  if (!Array.isArray(credentials) || credentials.length !== 1) throw new Error('Expected only the selected credential');
  expect(object(credentials[0])['credentialData']).toEqual(review.review.claims);
  const response = await context.request.get('/api/presentation'); const raw = await response.text(); const value: unknown = JSON.parse(raw);
  const result = parsePresentation(value); expect(result).toEqual({ state: 'verified', attemptId: before.reference.attemptId });
  for (const field of ['vpToken', 'nonce', 'credentialData', 'openid4vp']) expect(raw).not.toContain(field);
  const repeated = await context.request.post('/api/presentation', { headers: { origin: 'http://localhost:47831', 'X-Demo-Review': before.sharing.reviewId }, data: {} });
  const repeatedValue: unknown = await repeated.json(); expect(parsePresentation(repeatedValue)).toEqual(result);
  await page.screenshot({ path: '.local/evidence/F7-present-and-show-verifier-result-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Start new verification', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Wallet (User)', exact: false }).click();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send presentation', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: 'Verified', exact: true }).screenshot({ path: '.local/evidence/F7-present-and-show-verifier-result-mobile.png', animations: 'disabled' });
  const other = await browser.newContext();
  try {
    expect((await other.request.get('/api/presentation')).status()).toBe(403);
    const otherPage = await other.newPage(); await otherPage.goto('/'); await otherPage.getByRole('button', { name: 'Start demo', exact: true }).click();
    await expect(otherPage.getByText('Wallet connected', { exact: true })).toBeVisible();
    const own = await other.request.get('/api/presentation'); const ownValue: unknown = await own.json(); expect(parsePresentation(ownValue)).toEqual({ state: 'none' });
    expect((await other.request.get(`/api/presentation?attemptId=${before.reference.attemptId}`)).status()).toBe(400);
    expect((await other.request.post('/api/presentation', { headers: { origin: 'http://localhost:47831', 'X-Demo-Review': before.sharing.reviewId }, data: {} })).status()).toBe(403);
    await expect(otherPage.getByRole('heading', { name: 'Verified', exact: true })).toHaveCount(0);
  } finally { await other.close(); }
  await page.getByRole('tab', { name: 'Verifier', exact: false }).click();
  await page.getByRole('button', { name: 'Start new verification', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review sharing in Wallet', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Wallet (User)', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send presentation', exact: true })).toHaveCount(0);
});

test('F7 controlled delayed/lost browser result never claims verification from delivery and safely checks the real result', async ({ page, context }) => {
  await approve(page);
  const { reference } = await owned(context);
  let pending = true;
  let posts = 0;
  await page.route('**/api/presentation', async route => {
    if (route.request().method() === 'POST') { posts++; const response = await route.fetch(); expect(response.ok()).toBe(true); await route.fulfill({ status: 200, contentType: 'application/json', json: { state: 'pending', attemptId: reference.attemptId } }); return; }
    if (pending) { await route.fulfill({ status: 200, contentType: 'application/json', json: { state: 'pending', attemptId: reference.attemptId } }); return; }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Send presentation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verification pending', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toHaveCount(0);
  // An inconclusive browser read is distinct from rejection; retry reads the same real result.
  pending = false;
  await page.route('**/api/presentation', async route => { await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); });
  await page.getByRole('button', { name: 'Check verification result', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Result not confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verification failed', exact: true })).toHaveCount(0);
  await page.unroute('**/api/presentation');
  await page.getByRole('button', { name: 'Check verification result', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible(); expect(posts).toBe(1);
});

test('F7 controlled corruption of a real holder proof yields a real verifier rejection and failure UI', async ({ page, context }) => {
  await approve(page);
  const { token, sharing } = await owned(context);
  const config = readConfig({ ...process.env, WALT_WALLET_URL: 'http://127.0.0.1:7006', WALT_VERIFIER_URL: 'http://127.0.0.1:7004' });
  const store = new SessionStore(config);
  const corrupt: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (!url.pathname.endsWith('/send-response')) return fetch(input, init);
    const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : 'null'); const request = object(body);
    const encoded = request['vpToken']; if (typeof encoded !== 'string') throw new Error('Missing VP');
    const tokens: unknown = JSON.parse(encoded); const grouped = object(tokens); const training = grouped['training'];
    if (!Array.isArray(training) || typeof training[0] !== 'string') throw new Error('Missing training proof');
    const parts = training[0].split('~'); const binding = parts.pop();
    if (!binding) throw new Error('Missing holder proof'); const jwt = binding.split('.'); const signature = jwt[2];
    if (!signature) throw new Error('Missing proof signature'); jwt[2] = (signature.startsWith('A') ? 'B' : 'A') + signature.slice(1);
    const altered = [...parts, jwt.join('.')].join('~');
    return fetch(input, { ...init, body: JSON.stringify({ ...request, vpToken: JSON.stringify({ training: [altered] }) }) });
  };
  try {
    const response = await presentationHandler(config, store, corrupt)(new Request(`${config.origin}/api/presentation`, { method: 'POST', headers: { origin: config.origin, cookie: `diw-session=${token}`, 'content-type': 'application/json', 'X-Demo-Review': sharing.reviewId }, body: '{}' }));
    const value: unknown = await response.json(); expect(parsePresentation(value).state).toBe('failed');
  } finally { store.close(); }
  await page.reload(); await expect(page.getByRole('heading', { name: 'Verification failed', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toHaveCount(0);
  await expect(page.getByText('Harbor Works rejected the presentation.', { exact: false })).toBeVisible();
});
