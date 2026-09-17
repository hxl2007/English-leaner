import {获取当前用户} from './认证.js';
import {云端请求} from './云端接口.js';
const 请求=操作=>new Promise((完成,拒绝)=>{操作.onsuccess=()=>完成(操作.result);操作.onerror=()=>拒绝(操作.error);});
let 数据库,同步队列=Promise.resolve(),正在同步=false,需要拉取=false,同步状态={状态:'未同步',说明:'正在读取学习进度'};
export function 空存档(){return {版本:3,草稿:null,记录:[],收藏:[],已抽原创:[],消费金币:0,背包:{},小段:1,更新时间:0,云端版本:0,待同步:false};}
const 当前存档键=()=>`学习:${获取当前用户()?.手机号||'未登录'}`;
export function 获取同步状态(){return {...同步状态};}
function 状态(状态,说明){同步状态={状态,说明};window.dispatchEvent(new CustomEvent('同步状态变化',{detail:同步状态}));}
async function 本地读取(键=当前存档键()){return {...空存档(),...await 请求(数据库.transaction('存档').objectStore('存档').get(键))};}
function 本地写入(值,键=当前存档键()){
 return new Promise((resolve,reject)=>{const t=数据库.transaction('存档','readwrite');t.objectStore('存档').put(值,键);t.oncomplete=()=>resolve(值);t.onabort=t.onerror=()=>reject(t.error);});
}
function 云端数据(存档){const {云端版本,待同步,...内容}=存档;return 内容;}
export function 合并并发存档(本地,云端){
 const 新=本地.更新时间>=云端.更新时间?本地:云端,旧=新===本地?云端:本地;
 const 记录=[...new Map([...旧.记录,...新.记录].map(r=>[r.编号,r])).values()].sort((a,b)=>a.提交时间-b.提交时间);
 let 草稿=新.草稿;
 if(本地.草稿&&云端.草稿&&本地.草稿.编号===云端.草稿.编号)草稿={...旧.草稿,...新.草稿,作答:{...旧.草稿.作答,...新.草稿.作答},自评:{...旧.草稿.自评,...新.草稿.自评}};
 if(草稿&&记录.some(r=>r.编号===草稿.编号))草稿=null;
 return {...旧,...新,记录,草稿,收藏:[...new Set([...本地.收藏,...云端.收藏])],已抽原创:[...new Set([...本地.已抽原创,...云端.已抽原创])],消费金币:Math.max(本地.消费金币||0,云端.消费金币||0),小段:Math.max(本地.小段||1,云端.小段||1),背包:新.背包||{},待同步:true};
}
async function 拉取合并(键){
 const 云=await 云端请求('/api/archive'),本=await 本地读取(键),版本=Number(云.updatedAt)||0;
 const 远=云.archive?{...空存档(),...云.archive,更新时间:版本,云端版本:版本,待同步:false}:null;
 if(远&&版本!==本.云端版本){
  if(本.待同步){
   await 本地写入(本,`冲突备份:${键}`);
   await 本地写入({...合并并发存档(本,远),云端版本:版本},键);
  }else await 本地写入(远,键);
  window.dispatchEvent(new CustomEvent('云端存档更新'));
 }else if(!远&&本.更新时间&&!本.待同步)await 本地写入({...本,待同步:true,云端版本:0},键);
 return 本地读取(键);
}
async function 推送(键){
 for(let 次=0;次<4;次++){
  const 本=await 本地读取(键);if(!本.待同步){状态('已同步','学习进度已同步到云端');return true;}
  状态('同步中','正在保存到云端');
  try{
   const 响应=await 云端请求('/api/archive',{method:'PUT',body:JSON.stringify({archive:云端数据(本),updatedAt:本.更新时间,baseUpdatedAt:本.云端版本||0})});
   // 网络等待期间可能又有作答，只更新同步元数据，不覆盖新答案。
   await new Promise((resolve,reject)=>{const t=数据库.transaction('存档','readwrite'),s=t.objectStore('存档'),r=s.get(键);r.onsuccess=()=>{const 当前=r.result||本;const 相同=当前.更新时间===本.更新时间;s.put({...当前,云端版本:响应.updatedAt,待同步:!相同,...(相同?{更新时间:响应.updatedAt}:{})},键);};t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(t.error);});
  }catch(e){
   if(e.status!==409)throw e;
   await 拉取合并(键);
  }
 }
 throw new Error('另一台设备正在更新进度，请稍后点击“立即同步”。');
}
function 排队同步(拉取=false){
 const 键=当前存档键(),用户=获取当前用户();
 if(!用户)return Promise.resolve(false);
 需要拉取 ||= 拉取;
 if(正在同步)return 同步队列;
 正在同步=true;
 同步队列=同步队列.catch(()=>false).then(async()=>{
  if(键!==当前存档键())return false;
  try{do{const 拉=需要拉取;需要拉取=false;if(拉){状态('同步中','正在检查其他设备的进度');await 拉取合并(键);}await 推送(键);}while(需要拉取);return true;}
  catch(e){状态('待同步',e.message||'已保存到本机，云端连接失败');return false;}
 }).finally(()=>{正在同步=false;});return 同步队列;
}
export const 等待云端同步=()=>同步队列;
export const 同步存档=()=>排队同步(true);
export async function 打开存档(){
 const r=indexedDB.open('升本练习室',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('存档'))r.result.createObjectStore('存档');};数据库=await 请求(r);
 const 键=当前存档键(),本=await 本地读取(键);
 if(本.更新时间&&!本.云端版本)await 本地写入({...本,待同步:true},键);
 if(!本.更新时间&&!localStorage.getItem('升本练习室_本机存档归属')){
  const 旧=await 本地读取('学习');
  if(旧.更新时间||旧.记录.length||旧.草稿)await 本地写入({...旧,待同步:true,云端版本:0},键);
 }
 if(获取当前用户())localStorage.setItem('升本练习室_本机存档归属',获取当前用户().手机号);
 await 同步存档();return 本地读取(键);
}
export const 读取=()=>本地读取();
export function 更新(操作){
 return new Promise((完成,拒绝)=>{const 键=当前存档键(),事务=数据库.transaction('存档','readwrite'),仓库=事务.objectStore('存档'),查询=仓库.get(键);let 最新,异常;
  查询.onsuccess=()=>{try{const 旧={...空存档(),...查询.result};最新={...操作(旧),更新时间:Math.max(Date.now(),Number(旧.更新时间||0)+1),待同步:true,云端版本:旧.云端版本||0};仓库.put(最新,键);}catch(e){异常=e;事务.abort();}};
  事务.oncomplete=()=>{排队同步();完成(最新);};事务.onabort=事务.onerror=()=>拒绝(异常||事务.error||new Error('存档写入失败'));
 });
}
export const 判题=(题目编号,作答,答案)=>答案[题目编号].正确选项.includes(作答[题目编号]);
export function 评分(题目编号,作答,答案){if(题目编号.length!==25||!题目编号.every(q=>/^[ABCD]$/.test(作答[q]||'')))throw new Error('请完成全部 25 道题后再提交。');const 对错=题目编号.map(q=>判题(q,作答,答案));const 正确=对错.filter(Boolean).length;return {对错,分数:正确*4,金币:正确};}
export const 总金币=存档=>存档.记录.reduce((合计,r)=>合计+Number(r.金币||0),0);
window.addEventListener('online',()=>{if(数据库)同步存档();});
