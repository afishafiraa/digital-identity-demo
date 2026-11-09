import { errorResponse, handleSharingDecision } from '@/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request): Promise<Response> {
  try { return await handleSharingDecision(request); }
  catch (error) { return errorResponse(error); }
}
export { handle as POST, handle as DELETE };
