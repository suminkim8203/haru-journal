import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {DIARY_ID,type Command,type Snapshot} from './contracts';
export class StorageError extends Error {constructor(public status:number,public code:string,message:string){super(message)}}
export function storageConfigured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)}
function client(){if(!storageConfigured())throw new StorageError(503,'NOT_CONFIGURED','저장소 연결 준비 중입니다.');return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function failure(error:{code?:string}) {if(['P0001','P0002','23505'].includes(error.code||''))return new StorageError(409,'CONFLICT','다른 창의 변경 또는 중복 요청이 있습니다. 입력은 유지됩니다. 최신 자료를 확인해 주세요.');if(['22023','22007','22008','22P02','23502','23503','23514'].includes(error.code||''))return new StorageError(422,'INVALID','입력 내용과 계획 상태를 확인해 주세요.');return new StorageError(503,'STORAGE_UNAVAILABLE','저장소에 연결하지 못했습니다. 입력을 유지하고 다시 시도해 주세요.');}
export async function snapshot():Promise<Snapshot>{const {data,error}=await client().rpc('journal_snapshot',{p_diary_id:DIARY_ID});if(error)throw failure(error);if(!data)throw new StorageError(503,'MISSING_DIARY','저장소 초기 설정을 확인해 주세요.');return data as Snapshot;}
export async function execute(command:Command){const {data,error}=await client().rpc('journal_command',{p_diary_id:DIARY_ID,p_request_id:command.requestId,p_expected_revision:command.expectedRevision,p_command:command.command,p_payload:command.payload});if(error)throw failure(error);return data as {revision:number;entityId:string};}
export function errorResponse(error:unknown){if(error instanceof StorageError)return Response.json({error:{code:error.code,message:error.code==='NOT_CONFIGURED'?'저장소 연결 준비 중입니다.':error.message}},{status:error.status,headers:{'Cache-Control':'no-store'}});return Response.json({error:{code:'UNAVAILABLE',message:'요청을 처리하지 못했습니다. 다시 시도해 주세요.'}},{status:503});}

