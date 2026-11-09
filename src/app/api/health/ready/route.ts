import { json } from '@/server';
import { readConfig } from '@/server/core/config';
import { serviceClient } from '@/server/core/transport';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Readiness covers the implemented F1 routes, not the unimplemented remaining journey.
export async function GET(): Promise<Response> {
  try {
    const service = readConfig().services.wallet;
    if (!service) return json({ status: 'not-ready' }, 503);
    await serviceClient(service)({ path: '/wallet', timeoutMs: 2000, decode(value: unknown) {
      if (!Array.isArray(value)) throw new Error('Invalid readiness response');
      return true;
    } });
    return json({ status: 'ready', features: ['F1'] });
  } catch { return json({ status: 'not-ready' }, 503); }
}
