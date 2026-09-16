import {获取当前用户} from './认证.js';
const 云端地址='https://zhuanshengben-api.adadaadadaaa.workers.dev';
const 请求=(操作)=>new Promise((完成,拒绝)=>{操作.onsuccess=()=>完成(操作.result);操作.onerror=()=>拒绝(操作.error);});
let 数据库,同步队列=Promise.resolve();
let 云端更新时间=0;
export function 空存档(){return {版本:3,草稿:null,记录:[],收藏:[],已抽原创:[],消费金币:0,背包:{},小段:1,更新时间:0};}
function 当前存档键(){const 手机号=获取当前用户()?.手机号;return 手机号?`学习:${手机号}`:'学习:未登录';}
async function 本地读取(键=当前存档键()){return (await 请求(数据库.transaction('存档').objectStore('存档').get(键)))||空存档();}
async function 本地写入(存档,键=当前存档键()){return 请求(数据库.transaction('存档','readwrite').objectStore('存档').put(存档,键));}
async function 迁移旧存档(键){
  const 用户=获取当前用户();
  if(!用户||键==='学习:未登录'||localStorage.getItem('升本练习室_本机存档归属'))return;
  const 旧=await 本地读取('学习');
  const 有内容=旧.更新时间||旧.记录?.length||旧.收藏?.length||旧.已抽原创?.length||旧.草稿||Object.keys(旧.背包||{}).length;
  if(!有内容)return;
  await 本地写入(旧,键);
  const 删除=数据库.transaction('存档','readwrite').objectStore('存档').delete('学习');
  await 请求(删除);
  localStorage.setItem('升本练习室_本机存档归属',用户.手机号);
}
async function 云端读取(){const 用户=获取当前用户(),令牌=localStorage.getItem('升本练习室_云端令牌');if(!用户||!令牌)return null;try{const 响应=await fetch(`${云端地址}/api/archive`,{headers:{Authorization:`Bearer ${令牌}`}});if(!响应.ok)return null;const 数据=await 响应.json();云端更新时间=Number(数据.updatedAt)||Number(数据.archive?.更新时间)||0;return 数据;}catch{return null;}}
function 云端写入(存档){const 用户=获取当前用户(),令牌=localStorage.getItem('升本练习室_云端令牌');if(!用户||!令牌)return;同步队列=同步队列.then(async()=>{try{const 响应=await fetch(`${云端地址}/api/archive`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${令牌}`},body:JSON.stringify({archive:存档,updatedAt:存档.更新时间||Date.now()})});const 数据=await 响应.json().catch(()=>({}));if(响应.ok){云端更新时间=Number(数据.updatedAt)||云端更新时间;return;}if(响应.status===409&&数据.archive&&Number(数据.updatedAt)>Number(存档.更新时间||0)){const 最新={...空存档(),...数据.archive,更新时间:Number(数据.updatedAt)};云端更新时间=最新.更新时间;await 本地写入(最新);window.dispatchEvent(new CustomEvent('云端存档更新'));}}catch{}});}
export function 等待云端同步(){return 同步队列.catch(()=>{});}
export async function 打开存档(){const 操作=indexedDB.open('升本练习室',1);操作.onupgradeneeded=()=>{if(!操作.result.objectStoreNames.contains('存档'))操作.result.createObjectStore('存档');};数据库=await 请求(操作);const 键=当前存档键();await 迁移旧存档(键);const 本地=await 本地读取(键),云端=await 云端读取(),云端存档=云端?.archive;let 当前=本地;if(云端存档&&Number(云端.updatedAt||云端存档.更新时间)>Number(本地.更新时间||0)){当前={...空存档(),...云端存档,更新时间:Number(云端.updatedAt||云端存档.更新时间)||Date.now()};await 本地写入(当前,键);}else if(本地.更新时间){云端写入(本地);}if(获取当前用户())localStorage.setItem('升本练习室_本机存档归属',获取当前用户().手机号);return 当前;}
export async function 读取(){return 本地读取(当前存档键());}
export function 更新(操作){return new Promise((完成,拒绝)=>{const 键=当前存档键(),事务=数据库.transaction('存档','readwrite'),仓库=事务.objectStore('存档');const 查询=仓库.get(键);let 最新,异常;查询.onsuccess=()=>{try{最新={...操作(查询.result||空存档()),更新时间:Date.now()};仓库.put(最新,键);}catch(错误){异常=错误;事务.abort();}};事务.oncomplete=()=>{云端写入(最新);完成(最新);};事务.onabort=事务.onerror=()=>拒绝(异常||事务.error||new Error('存档写入失败'));});}
export function 判题(题目编号,作答,答案){return 答案[题目编号].正确选项.includes(作答);}
export function 评分(题目编号,作答,答案){if(题目编号.length!==25||!题目编号.every(q=>/^[ABCD]$/.test(作答[q]||'')))throw new Error('请完成全部 25 道题后再提交。');const 对错=题目编号.map(q=>判题(q,作答[q],答案));return {对错,分数:对错.filter(Boolean).length*4,金币:25};}
export function 总金币(存档){return 存档.记录.reduce((合计,r)=>合计+r.金币,0);}
