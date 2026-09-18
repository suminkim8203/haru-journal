const staticExport=process.env.HARU_STATIC_EXPORT==='1';
export default {distDir:staticExport?'.next-static':'.next',...(staticExport?{output:'export'}:{})};
