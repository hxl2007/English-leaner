import {打乱} from './组卷.js';
export const 学习日期=(时间=Date.now())=>new Date(时间+8*3600000).toISOString().slice(0,10);
export function 复习计划(题库,存档,时间=Date.now()){
 const 今天=学习日期(时间),已完成=存档.记录.find(r=>r.模块==='复习'&&r.复习日期===今天);
 const 状态=new Map(),合法=new Map(题库.题目.filter(q=>q.可抽取!==false&&!q.旧版).map(q=>[q.编号,q]));
 for(const r of [...存档.记录].sort((a,b)=>a.提交时间-b.提交时间))r.题目编号.forEach((id,i)=>{
  if(!合法.has(id))return;
  const 旧=状态.get(id);
  if(!r.对错[i])状态.set(id,{id,连续:0,错误次数:(旧?.错误次数||0)+1,到期:r.提交时间,错时:r.提交时间});
  else if(旧){const 连续=旧.连续+1;状态.set(id,{...旧,连续,到期:r.提交时间+[1,3,7,14,30][Math.min(连续-1,4)]*86400000});}
 });
 // 反复答错优先；长期未复习会逐日提高优先级，避免其他错题被一直饿死。
 const 优先=x=>(x.错误次数||1)*2+Math.floor((时间-x.到期)/86400000);
 const 候选=[...状态.values()].filter(x=>x.到期<=时间).sort((a,b)=>优先(b)-优先(a)||a.到期-b.到期||a.id.localeCompare(b.id));
 return {今天,已完成,总错题:状态.size,到期:候选.length,题目:候选.slice(0,10).map(x=>合法.get(x.id))};
}
export function 生成每日复习(题库,存档,时间=Date.now()){
 const p=复习计划(题库,存档,时间);
 if(p.已完成)throw new Error('今天的复习已完成，明天再来巩固。');
 if(!p.题目.length)throw new Error('今天没有到期错题，完成练习后再来查看。');
 // 每天固定记录编号：跨设备或重复导入都只结算一次。
 return {编号:`daily-${p.今天}`,版本:2,题源:'错题',模块:'复习',复习日期:p.今天,名称:`每日错题复习 · ${p.今天}`,题目编号:p.题目.map(q=>q.编号),篇章编号:[...new Set(p.题目.map(q=>q.篇章).filter(Boolean))],单元:p.题目.map(q=>({题目:q.编号,题型:q.题型,篇章:q.篇章||null})),选项顺序:Object.fromEntries(p.题目.filter(q=>q.选项).map(q=>[q.编号,/\b(?:above|below)\b|\b[A-D]\s*(?:and|or|&|,)\s*[A-D]\b/i.test(q.选项.join(' '))?[0,1,2,3]:打乱([0,1,2,3])])),本次原创:[],作答:{},自评:{},标记:[],当前题:0,开始时间:时间,满分:100,金币:p.题目.length};
}
export function 合并练习记录(...列表){
 const m=new Map();
 for(const r of 列表.flat()){
  const 键=r.模块==='复习'?`daily-${r.复习日期}`:r.编号,旧=m.get(键);
  // 同一天多设备提交时保留首次完成的结果，防止重算额外奖励。
  if(!旧||r.模块==='复习'&&r.提交时间<旧.提交时间)m.set(键,{...r,编号:键});
 }
 return [...m.values()].sort((a,b)=>a.提交时间-b.提交时间);
}
