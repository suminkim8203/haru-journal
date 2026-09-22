import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {privateJournalEnabled} from './auth-mode';
let connection:SupabaseClient|undefined;
/** Shared auth and diary client; server RPCs remain the authority. */
export function authClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('인증 연결 설정을 확인해 주세요.');
 return connection??=createClient(url,key,{auth:{persistSession:privateJournalEnabled,autoRefreshToken:privateJournalEnabled,detectSessionInUrl:false}});
}
