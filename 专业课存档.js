const 数据库名='升本练习室专业课';
const 来源=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();
const 引用前缀='专业课截图:';
const 图到号=new Map(),号到图=new Map();
let 数据库;
export const 专业课账户=()=>/^1[3-9]\d{9}$/.test(localStorage.getItem('升本练习室_当前用户')||'')?localStorage.getItem('升本练习室_当前用户'):'访客';
export const 空专业课存档=()=>({版本:1,草稿:{},记录:[],冲突副本:[]});
const 同=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const 复制=x=>structuredClone(x);
export function 校验专业课存档(s){
  if(s?.版本!==1||!s.草稿||typeof s.草稿!=='object'||Array.isArray(s.草稿)||!Array.isArray(s.记录)||s.冲突副本!==undefined&&!Array.isArray(s.冲突副本))throw new Error('专业课备份格式无效，原存档已保留。');
  function 安全键(o,层=0){if(层>25)throw new Error('存档嵌套层数过多。');if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('存档含无效字段。');安全键(v,层+1);}}
  安全键(s);return {...s,冲突副本:s.冲突副本||[]};
}
// 三方合并只提交本标签页改动的题目，完成记录不会被旧标签页重新变成草稿。
export function 合并专业课存档(远,本,基线=空专业课存档(),写入来源=来源){
  远=校验专业课存档(远);本=校验专业课存档(本);基线=校验专业课存档(基线);
  const 新=复制(远),副本=new Map([...远.冲突副本,...本.冲突副本].map(x=>[x.副本编号,x]));
  const 记=new Map(远.记录.map(x=>[x.编号,x]));
  for(const r of 本.记录)if(!同(r,基线.记录.find(x=>x.编号===r.编号)))记.set(r.编号,复制(r));
  新.记录=[...记.values()].sort((a,b)=>(b.完成时间||0)-(a.完成时间||0));
  function 保留(s,原因){
    if(!s)return;
    const 签=JSON.stringify([s.编号,s.作答,s.自评,s.截图]);
    if([...副本.values()].some(x=>x.内容签名===签))return;
    const 编号=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();
    副本.set(编号,{副本编号:编号,保存时间:Date.now(),原因,内容签名:签,练习:复制(s)});
  }
  for(const 键 of new Set([...Object.keys(本.草稿),...Object.keys(基线.草稿)])){
    const l=本.草稿[键],b=基线.草稿[键],r=远.草稿[键];
    if(同(l,b))continue;
    if(!l){if(!r||同(r,b)||新.记录.some(x=>x.编号===r.编号))delete 新.草稿[键];continue;}
    if(新.记录.some(x=>x.编号===l.编号)){
      if(!同(l,b))保留(l,'另一标签页已交卷，本页迟到的修改保存在副本中。');continue;
    }
    if(!r||r.编号!==l.编号){
      if(r&&!同(r,b))保留(r,'同时开始了同一试卷的不同练习。');
      新.草稿[键]={...复制(l),修改来源:写入来源};continue;
    }
    let 冲突=false;const out={...r};
    for(const 字段 of ['作答','自评','截图','判题理由','_ai建议']){
      out[字段]={...(r[字段]||{})};
      for(const id of new Set([...Object.keys(l[字段]||{}),...Object.keys(b?.[字段]||{})])){
        const lv=l[字段]?.[id],bv=b?.[字段]?.[id],rv=r[字段]?.[id];
        if(同(lv,bv))continue;
        if(!同(rv,bv)&&!同(lv,rv)&&r.修改来源!==写入来源)冲突=true;
        if(lv===undefined)delete out[字段][id];else out[字段][id]=lv;
      }
    }
    if(冲突)保留(r,'同一道题在另一标签页有不同修改，两个版本均已保留。');
    for(const 字段 of Object.keys(l))if(!['作答','自评','截图','判题理由','_ai建议'].includes(字段)&&!同(l[字段],b?.[字段]))out[字段]=复制(l[字段]);
    out.修改来源=写入来源;新.草稿[键]=out;
  }
  for(const [k,s] of Object.entries(新.草稿))if(新.记录.some(r=>r.编号===s.编号))delete 新.草稿[k];
  for(const k of ['旧本机摘要','旧本机基线'])if(本[k]!==undefined&&!同(本[k],基线[k]))新[k]=复制(本[k]);
  新.冲突副本=[...副本.values()];新.更新时间=Date.now();return 新;
}
function 打开(){
  if(!数据库)数据库=new Promise((resolve,reject)=>{
    const r=indexedDB.open(数据库名,1);
    r.onupgradeneeded=()=>{for(const n of ['存档','截图'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n);};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('专业课存档被其他页面占用，请关闭旧页面后重试。'));
  }).catch(e=>{数据库=null;throw e;});return 数据库;
}
function 截图结构(s,处理){
  const v=复制(s);
  for(const r of [...Object.values(v.草稿),...v.记录,...(v.冲突副本||[]).map(x=>x.练习)]){
    for(const [id,图] of Object.entries(r.截图||{}))r.截图[id]=处理(图);
  }
  // 副本签名不包含长图片文本，防止同一截图在存档里重复占用空间。
  for(const c of v.冲突副本||[])c.内容签名=JSON.stringify([c.练习.编号,c.练习.作答,c.练习.自评,c.练习.截图]);
  return v;
}
function 抽离(s){
  const 图=new Map();
  const 数据=截图结构(s,值=>{
    if(typeof 值!=='string'||!值.startsWith('data:image'))return 值;
    if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(值)||值.length>900000)throw new Error('截图格式或大小不符合要求。');
    let 号=图到号.get(值);if(!号){号=引用前缀+crypto.randomUUID();图到号.set(值,号);号到图.set(号,值);}
    图.set(号,值);return 号;
  });return {数据,图};
}
async function 装入(s){
  const 需要=new Set();截图结构(s,值=>{if(typeof 值==='string'&&值.startsWith(引用前缀)&&!号到图.has(值))需要.add(值);return 值;});
  if(需要.size){
    const db=await 打开();await new Promise((resolve,reject)=>{
      const tr=db.transaction('截图'),st=tr.objectStore('截图');
      for(const 号 of 需要){const r=st.get(号);r.onsuccess=()=>{if(typeof r.result==='string'){号到图.set(号,r.result);图到号.set(r.result,号);}};}
      tr.oncomplete=resolve;tr.onabort=tr.onerror=()=>reject(tr.error);
    });
  }
  return 截图结构(s,值=>{
    if(typeof 值==='string'&&值.startsWith(引用前缀)){if(!号到图.has(值))throw new Error('有答题截图尚未读取成功，请重试或导出原始备份。');return 号到图.get(值);}return 值;
  });
}
export async function 读取专业课存档(账户=专业课账户()){
  const db=await 打开();
  let 数据=await new Promise((resolve,reject)=>{const r=db.transaction('存档').objectStore('存档').get(账户);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const 原文=localStorage.getItem('升本练习室_专业课进度_'+账户);
  const 摘要=原文?[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(原文)))].map(x=>x.toString(16).padStart(2,'0')).join(''):'';
  if(原文&&摘要!==数据?.旧本机摘要){
    const 旧=校验专业课存档(JSON.parse(原文)),原基线=数据?.旧本机基线?await 装入(数据.旧本机基线):空专业课存档();
    旧.旧本机基线=抽离(旧).数据;旧.旧本机摘要=摘要;
    // 保留旧数据，并接收尚未刷新的旧标签页后续保存。
    return 保存专业课存档(旧,原基线,账户,'旧本机迁移');
  }
  if(!数据)return 保存专业课存档(空专业课存档(),空专业课存档(),账户);
  return 装入(校验专业课存档(数据));
}
export async function 保存专业课存档(本,基线=空专业课存档(),账户=专业课账户(),写入来源=来源){
  校验专业课存档(本);const db=await 打开(),l=抽离(本),b=抽离(基线);let 新;
  await new Promise((resolve,reject)=>{
    const tr=db.transaction(['存档','截图'],'readwrite'),st=tr.objectStore('存档'),r=st.get(账户);
    r.onsuccess=()=>{
      try{
        新=合并专业课存档(r.result||空专业课存档(),l.数据,b.数据,写入来源);
        for(const [号,图] of l.图){const st图=tr.objectStore('截图'),r图=st图.getKey(号);r图.onsuccess=()=>{if(r图.result===undefined)st图.put(图,号);};}
        st.put(新,账户);
      }catch(e){reject(e);tr.abort();}
    };
    tr.oncomplete=resolve;tr.onabort=tr.onerror=()=>reject(tr.error||new Error('未能保存专业课存档，请保留页面并重试。'));
  });
  try{localStorage.setItem('升本练习室_专业课更新_'+账户,String(Date.now())+Math.random());}catch{}
  return 装入(新);
}
export async function 清理闲置截图(){
  const db=await 打开(),移除=[];
  await new Promise((resolve,reject)=>{
    const tr=db.transaction(['存档','截图'],'readwrite'),a=tr.objectStore('存档').getAll();
    a.onsuccess=()=>{
      const 用到=new Set();function 收集(v){if(typeof v==='string'&&v.startsWith(引用前缀))用到.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(收集);}
      a.result.forEach(收集);const cursor=tr.objectStore('截图').openCursor();
      cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(!用到.has(c.key)){c.delete();移除.push(c.key);}c.continue();};
    };
    tr.oncomplete=resolve;tr.onabort=tr.onerror=()=>reject(tr.error);
  });for(const 号 of 移除){const 图=号到图.get(号);号到图.delete(号);if(图)图到号.delete(图);}return 移除.length;
}
export async function 读取英语备份(){
  const 账户=专业课账户(),键='学习:'+(账户==='访客'?'未登录':账户);
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('升本练习室',1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('存档'))r.result.createObjectStore('存档');};
    r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('存档').objectStore('存档').get(键);q.onsuccess=()=>{db.close();resolve(q.result||null);};q.onerror=()=>{db.close();reject(q.error);};};
  });
}
export function 制作学习备份(英语,专业课){
  return {应用:'升本练习室',备份版本:2,导出时间:Date.now(),存档:英语,专业课:专业课备份内容(专业课)};
}
export function 专业课备份内容(s){
  const v=复制(校验专业课存档(s));delete v.旧本机摘要;delete v.旧本机基线;
  for(const c of v.冲突副本)delete c.内容签名;return v;
}
export function 下载学习备份(英语,专业课){
  const 数据=制作学习备份(英语,专业课);
  const url=URL.createObjectURL(new Blob([JSON.stringify(数据)],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='升本练习室三科备份-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function 校验英语备份(导入){
  if(![1,2,3].includes(导入.版本)||!Array.isArray(导入.记录)||!Array.isArray(导入.收藏))throw new Error('英语备份格式无效。');
  校验专业课存档({...空专业课存档(),英语:导入});
  const {验证练习,通用评分}=await import('./组卷.js');
  const [kr,ar]=await Promise.all([fetch('./题库.json'),fetch('./答案.json')]);if(!kr.ok||!ar.ok)throw new Error('英语备份校验资料未能加载。');
  const [库,答案]=await Promise.all([kr.json(),ar.json()]);
  const 记录=导入.记录.map(r=>{const c=验证练习(r,库);if(!Number.isFinite(c.提交时间)||!Number.isFinite(c.用时)||c.用时<0)throw new Error('英语备份时间无效。');return {...c,...通用评分(c,答案)};});
  return {...导入,记录,草稿:导入.草稿?验证练习(导入.草稿,库):null};
}
export async function 导入英语备份(导入){
  if(!导入)return;
  导入=await 校验英语备份(导入);
  const {空存档,合并并发存档}=await import('./数据.js');
  const 账户=专业课账户(),键='学习:'+(账户==='访客'?'未登录':账户);
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('升本练习室',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('存档'))r.result.createObjectStore('存档');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{await new Promise((resolve,reject)=>{
    const tr=db.transaction('存档','readwrite'),st=tr.objectStore('存档'),r=st.get(键);
    r.onsuccess=()=>{try{const 本={...空存档(),...r.result},入={...空存档(),...导入};st.put({...合并并发存档(本,入),云端版本:本.云端版本,更新时间:Math.max(Date.now(),Number(本.更新时间||0)+1),待同步:true},键);}catch(e){reject(e);tr.abort();}};
    tr.oncomplete=resolve;tr.onabort=tr.onerror=()=>reject(tr.error);
  });}finally{db.close();}
}
