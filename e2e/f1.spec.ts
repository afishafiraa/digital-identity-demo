import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { SessionStore } from '../src/server/core/session';
import { readConfig } from '../src/server/core/config';

async function walletId(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies()).find(value => value.name === 'diw-session');
  if (!cookie) throw new Error('No session cookie was set');
  const store = new SessionStore(readConfig());
  try {
    const id = store.binding(cookie.value)?.walletId;
    if (!id) throw new Error('No persisted wallet binding');
    return id;
  } finally { store.close(); }
}
async function start(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start demo' }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
}

test('F1 starts a real wallet, resumes it, supports keyboard focus and narrow screens', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start demo' })).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Start demo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
  const original = await walletId(context);
  await page.reload();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
  expect(await walletId(context)).toBe(original);
  await page.screenshot({ path: '.local/evidence/f1-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/evidence/f1-mobile.png', fullPage: true });
  await expect(page.getByRole('button', { name: 'Receive sample credential' })).toBeEnabled();
});

test('F1 independent browser contexts cannot provision using another wallet ID', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const pageA = await a.newPage(); const pageB = await b.newPage();
    await start(pageA); await start(pageB);
    const first = await walletId(a); const second = await walletId(b);
    expect(first).not.toBe(second);
    const response = await b.request.post('/api/session/wallet', { data: { walletId: first }, headers: { Origin: 'http://localhost:47831' } });
    expect(response.status()).toBe(400);
    expect(await walletId(a)).toBe(first);
    expect(await walletId(b)).toBe(second);
  } finally { await a.close(); await b.close(); }
});

test('F1 an unavailable wallet service produces a retry path that resumes the same allocation', async ({ page }) => {
  test.setTimeout(60000);
  const stopped = spawnSync('docker', ['compose', 'stop', 'wallet'], { stdio: 'ignore', timeout: 30000 });
  try {
    expect(stopped.status).toBe(0);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start demo' }).click();
    await expect(page.getByText('Wallet setup needs attention', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry wallet setup' })).toBeEnabled();
    await page.screenshot({ path: '.local/evidence/f1-service-error.png', fullPage: true });
  } finally {
    const started = spawnSync('docker', ['compose', 'start', 'wallet'], { stdio: 'ignore', timeout: 30000 });
    expect(started.status).toBe(0);
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await page.request.get('/api/health/ready');
      if (response.ok()) break;
      await delay(500);
    }
  }
  await page.getByRole('button', { name: 'Retry wallet setup' }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
});

test('F1 expired session requires an explicit fresh start', async ({ page, context }) => {
  const store = new SessionStore(readConfig());
  let token: string;
  try { token = store.start(null, Date.now() - 86401000).token; }
  finally { store.close(); }
  await context.addCookies([{ name: 'diw-session', value: token, url: 'http://localhost:47831', httpOnly: true, sameSite: 'Strict' }]);
  await page.goto('/');
  await expect(page.getByText('Your previous session is unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start a new session' }).click();
  await expect(page.getByText('Wallet connected', { exact: true })).toBeVisible();
});
