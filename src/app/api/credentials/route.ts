import { errorResponse, handleCredentials } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try { return await handleCredentials(request); }
  catch (error) { return errorResponse(error); }
}
