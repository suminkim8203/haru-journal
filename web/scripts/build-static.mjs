import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{cwd:process.cwd(),env:{...process.env,HARU_STATIC_EXPORT:'1'},stdio:'inherit',windowsHide:true});child.on('exit',code=>process.exit(code??1));
