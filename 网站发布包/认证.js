import {云端请求} from './云端接口.js';
export const 管理员手机号='13671068767';
let 当前用户=null;
export function 是管理员(用户=当前用户){return !!用户&&用户.手机号===管理员手机号;}
export function 获取当前用户(){return 当前用户;}
export function 是否已登录(){return !!当前用户;}
export function 退出登录(){当前用户=null;localStorage.removeItem('升本练习室_当前用户');localStorage.removeItem('升本练习室_云端令牌');}
function 保存登录(数据){
 if(!数据.token||!数据.user?.手机号)throw new Error('账户服务版本不匹配，请更新后端。');
 localStorage.setItem('升本练习室_云端令牌',数据.token);
 localStorage.setItem('升本练习室_当前用户',数据.user.手机号);
 当前用户=数据.user;return 当前用户;
}
export async function 初始化认证(){
 当前用户=null;
 if(!localStorage.getItem('升本练习室_云端令牌'))return;
 try{const 数据=await 云端请求('/api/user');当前用户=数据.user;}
 catch(e){if(e.status===401||e.status===403){退出登录();return;}throw e;}
}
export async function 注册用户(手机号,密码,名称=''){
 if(!/^1[3-9]\d{9}$/.test(手机号))throw new Error('请输入正确的手机号码');
 if(typeof 密码!=='string'||密码.length<6)throw new Error('密码至少需要6位');
 return 保存登录(await 云端请求('/api/register',{method:'POST',body:JSON.stringify({手机号,密码,名称})}));
}
// 只读取旧本机账户以核验迁移，不再创建新的离线账户。
async function 旧本机用户(手机号){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open('升本练习室认证',1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('用户'))r.result.createObjectStore('用户',{keyPath:'手机号'});};
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{const db=r.result,q=db.transaction('用户').objectStore('用户').get(手机号);q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>{db.close();reject(q.error);};};
 });
}
function 旧密码哈希(文本){let n=0;for(let i=0;i<文本.length;i++)n=((n<<5)-n+文本.charCodeAt(i))|0;return n.toString(36);}
export async function 用户登录(手机号,密码){
 if(!/^1[3-9]\d{9}$/.test(手机号))throw new Error('请输入正确的手机号码');
 try{return 保存登录(await 云端请求('/api/login',{method:'POST',body:JSON.stringify({手机号,密码})}));}
 catch(e){
  if(e.status!==401)throw e;
  const 旧=await 旧本机用户(手机号);
  if(!旧||旧.禁用||旧.密码!==旧密码哈希(密码))throw e;
  // 云端若已存在此号码，注册会拒绝，不覆盖该账户或更改密码。
  try{return await 注册用户(手机号,密码,旧.名称||'');}
  catch(迁移错误){if(迁移错误.status===409)throw new Error('该手机号已有云端账户，请使用云端密码登录；本机存档仍保留。');throw 迁移错误;}
 }
}
export async function 获取所有用户(){
 if(!是管理员())throw new Error('只有管理员可以查看账户');
 const 数据=await 云端请求('/api/users');
 if(!Array.isArray(数据.users))throw new Error('账户列表格式错误，请更新后端');
 return 数据.users;
}
export async function 更新用户状态(手机号,禁用){
 if(!是管理员())throw new Error('只有管理员可以管理账户');
 return (await 云端请求('/api/user/status',{method:'PUT',body:JSON.stringify({手机号,禁用:!!禁用})})).user;
}
