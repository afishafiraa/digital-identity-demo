import { errorResponse, handleProfile } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try { return await handleProfile(request); }
  catch (error) { return errorResponse(error); }
}
