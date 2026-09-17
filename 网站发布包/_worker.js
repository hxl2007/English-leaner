// Cloudflare Pages 同域代理：全部设备连接同一个 Workers API / D1。
// 这里不创建第二个数据库，也不接收 URL 中指定的转发地址。
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
    const headers=new Headers();
    for(const k of ['Authorization','Content-Type'])if(request.headers.has(k))headers.set(k,request.headers.get(k));
    const response=await fetch('https://zhuanshengben-api.adadaadadaaa.workers.dev'+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'});
    const out=new Headers(response.headers);out.set('Cache-Control','no-store');out.set('X-Content-Type-Options','nosniff');
    return new Response(response.body,{status:response.status,headers:out});
  }catch{return Response.json({error:'云端账户服务暂时无法连接，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}};
