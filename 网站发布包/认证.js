// 用户认证系统：优先使用 Cloudflare Worker + D1，接口暂时不可用时保留本机兜底。
const 认证数据库名 = '升本练习室认证';
const 云端地址 = 'https://zhuanshengben-api.adadaadadaaa.workers.dev';
export const 管理员手机号 = '13671068767';
let 认证数据库, 当前用户 = null, 云端可用 = false;

const 用户视图 = 用户 => 用户 ? {
  手机号: 用户.手机号 || 用户.phone,
  名称: 用户.名称 || 用户.name || `学习者${String(用户.手机号 || 用户.phone).slice(-4)}`,
  注册时间: Number(用户.注册时间 || 用户.registeredAt || 0),
  最后登录: Number(用户.最后登录 || 用户.lastLogin || 0),
  禁用: !!(用户.禁用 ?? 用户.disabled)
} : null;
export function 是管理员(用户 = 当前用户) { return !!用户 && 用户.手机号 === 管理员手机号; }

async function 云端请求(路径, 选项 = {}) {
  const 头 = {'Content-Type':'application/json', ...(选项.headers || {})};
  const token = localStorage.getItem('升本练习室_云端令牌');
  if (token) 头.Authorization = `Bearer ${token}`;
  try {
    const 响应 = await fetch(`${云端地址}${路径}`, {...选项, headers:头});
    云端可用 = true;
    const 数据 = await 响应.json().catch(() => ({}));
    if (!响应.ok) throw new Error(数据.error || '云端请求失败');
    return 数据;
  } catch (错误) {
    if (云端可用 || 错误.name !== 'TypeError') throw 错误;
    return null;
  }
}

function 打开本地数据库() {
  return new Promise((完成, 拒绝) => {
    const 请求 = indexedDB.open(认证数据库名, 1);
    请求.onupgradeneeded = 事件 => {
      const db = 事件.target.result;
      if (!db.objectStoreNames.contains('用户')) {
        const 仓库 = db.createObjectStore('用户', {keyPath:'手机号'});
        仓库.createIndex('手机号', '手机号', {unique:true});
      }
    };
    请求.onsuccess = () => {认证数据库 = 请求.result;完成();};
    请求.onerror = () => 拒绝(new Error('认证数据库初始化失败'));
  });
}

export async function 初始化认证() {
  await 打开本地数据库();
  const token = localStorage.getItem('升本练习室_云端令牌');
  if (token) {
    try {
      const 数据 = await 云端请求('/api/user');
      if (数据?.user) {
        当前用户 = 用户视图(数据.user);
        localStorage.setItem('升本练习室_当前用户', 当前用户.手机号);
        return;
      }
    } catch { localStorage.removeItem('升本练习室_云端令牌'); }
  }
  const 手机号 = localStorage.getItem('升本练习室_当前用户');
  if (手机号) {
    const 用户 = await 获取本地用户(手机号);
    if (用户 && !用户.禁用) 当前用户 = 用户视图(用户);
  }
}

export async function 注册用户(手机号, 密码, 名称 = '') {
  if (!/^1[3-9]\d{9}$/.test(手机号)) throw new Error('请输入正确的手机号码');
  if (密码.length < 6) throw new Error('密码至少需要6位');
  const 云端 = await 云端请求('/api/register', {method:'POST', body:JSON.stringify({手机号,密码,名称})});
  if (云端) {
    localStorage.setItem('升本练习室_云端令牌', 云端.token || '');
    当前用户 = 用户视图(云端.user || {手机号,名称,注册时间:Date.now(),最后登录:Date.now()});
    localStorage.setItem('升本练习室_当前用户', 手机号);
    return 当前用户;
  }
  return 本地注册(手机号, 密码, 名称);
}

export async function 用户登录(手机号, 密码) {
  if (!/^1[3-9]\d{9}$/.test(手机号)) throw new Error('请输入正确的手机号码');
  const 云端 = await 云端请求('/api/login', {method:'POST', body:JSON.stringify({手机号,密码})});
  if (云端) {
    localStorage.setItem('升本练习室_云端令牌', 云端.token || '');
    当前用户 = 用户视图(云端.user || {手机号,注册时间:Date.now(),最后登录:Date.now()});
    localStorage.setItem('升本练习室_当前用户', 手机号);
    return 当前用户;
  }
  return 本地登录(手机号, 密码);
}

export function 退出登录() { 当前用户=null;localStorage.removeItem('升本练习室_当前用户');localStorage.removeItem('升本练习室_云端令牌'); }
export function 获取当前用户() { return 当前用户; }
export function 是否已登录() { return 当前用户 !== null; }

async function 获取本地用户(手机号) { return new Promise((完成,拒绝)=>{const 请求=认证数据库.transaction(['用户'],'readonly').objectStore('用户').get(手机号);请求.onsuccess=()=>完成(请求.result||null);请求.onerror=()=>拒绝(new Error('获取用户信息失败'));}); }
async function 本地注册(手机号, 密码, 名称) {
  return new Promise((完成,拒绝)=>{const 事务=认证数据库.transaction(['用户'],'readwrite'),仓库=事务.objectStore('用户'),检查=仓库.get(手机号);检查.onsuccess=()=>{if(检查.result){拒绝(new Error('该手机号已注册'));return;}const 用户={手机号,名称:String(名称||'').trim().slice(0,20)||`学习者${手机号.slice(-4)}`,密码:简单加密(密码),注册时间:Date.now(),最后登录:Date.now(),禁用:false};仓库.add(用户).onsuccess=()=>{当前用户=用户视图(用户);localStorage.setItem('升本练习室_当前用户',手机号);完成(当前用户);};};检查.onerror=()=>拒绝(new Error('注册失败，请重试'));});
}
async function 本地登录(手机号, 密码) {
  return new Promise((完成,拒绝)=>{const 事务=认证数据库.transaction(['用户'],'readwrite'),仓库=事务.objectStore('用户'),查询=仓库.get(手机号);查询.onsuccess=()=>{const 用户=查询.result;if(!用户||用户.密码!==简单加密(密码)){拒绝(new Error('手机号或密码错误'));return;}if(用户.禁用){拒绝(new Error('该账号已被管理员禁用'));return;}用户.最后登录=Date.now();仓库.put(用户);当前用户=用户视图(用户);localStorage.setItem('升本练习室_当前用户',手机号);完成(当前用户);};查询.onerror=()=>拒绝(new Error('登录失败，请重试'));});
}

export async function 获取所有用户() {
  if (是管理员() && localStorage.getItem('升本练习室_云端令牌')) { const 云端=await 云端请求('/api/users'); if(云端?.users)return 云端.users.map(用户视图); }
  const 列表=await new Promise((完成,拒绝)=>{const 请求=认证数据库.transaction(['用户'],'readonly').objectStore('用户').getAll();请求.onsuccess=()=>完成(请求.result);请求.onerror=()=>拒绝(new Error('获取用户列表失败'));});
  return 列表.map(用户视图).sort((a,b)=>a.注册时间-b.注册时间);
}
export async function 更新用户状态(手机号, 禁用) {
  if (!是管理员()) throw new Error('只有管理员可以管理账户');
  if (手机号===管理员手机号) throw new Error('管理员账号不能被禁用');
  if (localStorage.getItem('升本练习室_云端令牌')) { const 云端=await 云端请求('/api/user/status',{method:'PUT',body:JSON.stringify({手机号,禁用:!!禁用})}); if(云端?.user)return 用户视图(云端.user); }
  return new Promise((完成,拒绝)=>{const 事务=认证数据库.transaction(['用户'],'readwrite'),仓库=事务.objectStore('用户'),请求=仓库.get(手机号);请求.onsuccess=()=>{if(!请求.result){拒绝(new Error('用户不存在'));return;}const 用户=请求.result;用户.禁用=!!禁用;仓库.put(用户);完成(用户视图(用户));};请求.onerror=()=>拒绝(new Error('更新用户状态失败'));});
}
function 简单加密(文本){let 结果=0;for(let i=0;i<文本.length;i++){结果=((结果<<5)-结果)+文本.charCodeAt(i);结果|=0;}return 结果.toString(36);}
