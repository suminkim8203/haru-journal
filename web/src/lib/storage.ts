import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {compatibleSnapshot,parseCommand,type Command,type Snapshot} from './contracts';
export class StorageError extends Error {
 constructor(public status:number,public code:string,message:string){super(message)}
}
let connection:SupabaseClient|undefined;
export function storageConfigured(){return !!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}
function client(){
 if(!storageConfigured())throw new StorageError(503,'NOT_CONFIGURED','Supabase 연결 설정이 필요합니다.');
 return connection??=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
function failure(error:{code?:string}){
 if(['P0001','P0002','23505'].includes(error.code||''))return new StorageError(409,'CONFLICT','다른 창의 변경 또는 중복 요청이 있습니다. 입력은 유지됩니다. 최신 자료를 확인해 주세요.');
 if(['22023','22007','22008','22P02','23502','23503','23514','22003'].includes(error.code||''))return new StorageError(422,'INVALID','입력 내용과 계획 상태를 확인해 주세요.');
 return new StorageError(503,'STORAGE_UNAVAILABLE','Supabase에 연결하지 못했습니다. 입력을 유지하고 다시 시도해 주세요.');
}
export async function snapshot():Promise<Snapshot>{
 const {data,error}=await client().rpc('haru_snapshot').abortSignal(AbortSignal.timeout(15000));
 if(error)throw failure(error);
 if(!compatibleSnapshot(data))throw new StorageError(503,'SCHEMA_UPDATE_REQUIRED','Supabase의 다이어리 DB 설정을 확인해 주세요.');
 return data;
}
export async function execute(input:Command):Promise<{revision:number;entityId:string|null}>{
 let command:Command;try{command=parseCommand(input)}catch(e){throw new StorageError(422,'INVALID',e instanceof Error?e.message:'입력을 확인해 주세요.')}
 // A client check improves feedback. SQL validates again; clients are never trusted.
 const {data,error}=await client().rpc('haru_command',{p_request_id:command.requestId,p_expected_revision:command.expectedRevision,p_command:command.command,p_payload:command.payload}).abortSignal(AbortSignal.timeout(15000));
 if(error)throw failure(error);return data;
}
export async function exportDiary(){
 const {data,error}=await client().rpc('haru_export').abortSignal(AbortSignal.timeout(15000));
 if(error)throw failure(error);if(!data||data.diaryId!=='00000000-0000-4000-8000-000000000006')throw new StorageError(503,'INVALID_EXPORT','자료를 내보내지 못했습니다.');return data;
}
