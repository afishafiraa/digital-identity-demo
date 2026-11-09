import { errorResponse, handleSharing } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request): Promise<Response> {
  try { return await handleSharing(request); }
  catch (error) { return errorResponse(error); }
}
export { handle as GET, handle as POST };
