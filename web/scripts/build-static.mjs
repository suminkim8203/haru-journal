import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';

if(process.env.NEXT_PUBLIC_HARU_PRIVATE!=='1'){
  console.error('T07 static release requires NEXT_PUBLIC_HARU_PRIVATE=1.');
  process.exit(2);
}
if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY){
  console.error('T07 static release requires both public Supabase client settings.');
  process.exit(2);
}

const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{
  cwd:process.cwd(),env:{...process.env,HARU_STATIC_EXPORT:'1'},stdio:'inherit',windowsHide:true
});
child.on('exit',async code=>{
  if(code!==0){process.exitCode=code??1;return;}
  try{
    const html=await readFile('.next-static/index.html','utf8');
    if(html.includes('지금은 로그인이 없어')||!html.includes('로그인 상태를 확인하고 있습니다.')){
      throw new Error('Static root does not contain the private journal shell.');
    }
    console.log('Private release shell verified.');
  }catch(error){console.error(error.message);process.exitCode=3;}
});
