import {parseCommand} from '@/lib/contracts';
import {execute,errorResponse} from '@/lib/storage.server';
import {sameSiteRequest} from '@/lib/request-origin';
export async function POST(request:Request){
 if(!sameSiteRequest(request,process.env.APP_ORIGIN))return Response.json({error:{code:'ORIGIN',message:'같은 사이트에서 다시 시도해 주세요.'}},{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:{code:'FORMAT',message:'JSON 요청이 필요합니다.'}},{status:415});
 let command;
 try{const reader=request.body?.getReader();if(!reader)throw Error('빈 요청입니다.');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return Response.json({error:{code:'TOO_LARGE',message:'입력 내용이 너무 깁니다.'}},{status:413});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}command=parseCommand(JSON.parse(new TextDecoder().decode(bytes)));}catch(error){return Response.json({error:{code:'INVALID',message:error instanceof SyntaxError?'요청 형식을 확인해 주세요.':error instanceof Error?error.message:'입력을 확인해 주세요.'}},{status:400});}
 try{return Response.json(await execute(command),{headers:{'Cache-Control':'no-store'}})}catch(error){return errorResponse(error)}
}
