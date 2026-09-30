const staticExport=process.env.HARU_STATIC_EXPORT==='1';
export default {distDir:staticExport?'.next-static':'.next',allowedDevOrigins:['127.0.0.1'],...(staticExport?{output:'export'}:{})};
