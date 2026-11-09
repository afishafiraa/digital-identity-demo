import { json } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(): Response { return json({ status: 'alive' }); }
