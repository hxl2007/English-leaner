// 账户与存档统一保存到 Cloudflare Worker + D1，静态网站部署到 GitHub Pages、Netlify 或 Cloudflare Pages 均可访问。
export const 云端地址 = 'https://zhuanshengben-api.adadaadadaaa.workers.dev';
let 接口地址;
async function 选择接口(){
 if(接口地址!==undefined)return 接口地址;
 // Pages 通过同域访问，避免部分手机网络无法直接访问 workers.dev。
 if(location.protocol==='https:'&&!location.hostname.endsWith('.github.io')){
   try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(4500)});if(r.ok&&r.headers.get('content-type')?.includes('application/json')){const d=await r.json();if(d.service==='升本账户服务'){接口地址='';return 接口地址;}}}catch{}
 }
 接口地址=云端地址;return 接口地址;
}
export async function 云端请求(路径,选项={}){
 const 地址=await 选择接口(),控制=new AbortController(),计时=setTimeout(()=>控制.abort(),12000);
 try{
  const token=localStorage.getItem('升本练习室_云端令牌');
  const headers={...(选项.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...选项.headers};
  const r=await fetch(地址+路径,{...选项,headers,signal:控制.signal,cache:'no-store'});
  if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('账户服务返回异常，请检查发布包与后端是否已更新。');
  const 数据=await r.json();
  if(!r.ok){const e=new Error(数据.error||'云端请求失败（'+r.status+'）');e.status=r.status;e.data=数据;throw e;}
  return 数据;
 }catch(e){
  if(e.name==='AbortError'||e instanceof TypeError)throw new Error('无法连接云端账户服务，请检查网络后重试。此次操作未创建本机账户。');
  throw e;
 }finally{clearTimeout(计时);}
}
