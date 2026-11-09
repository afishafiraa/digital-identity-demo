import { errorResponse, handleReset } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try { return await handleReset(request); }
  catch (error) { return errorResponse(error); }
}
