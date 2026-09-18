import {snapshot,errorResponse} from '@/lib/storage.server';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await snapshot(),{headers:{'Cache-Control':'no-store'}})}catch(error){return errorResponse(error)}}
