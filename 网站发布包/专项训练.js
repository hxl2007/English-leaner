import {可抽内容,打乱,新编号,文字指纹} from './组卷.js';
import {单选知识点,阅读知识点} from './知识点分类.js';
export {单选知识点,阅读知识点};
export function 专项库存(库,类型,知识点){
 const 合并=['原题','原创'].flatMap(s=>可抽内容(库,s)[类型]||[]),题=new Map(库.题目.map(q=>[q.编号,q])),见过=new Set();
 return 合并.filter(x=>{const key=文字指纹(类型==='单选'?x.题干:x.段落.join(' '));if(见过.has(key))return false;见过.add(key);return 类型==='单选'?x.知识点===知识点:x.题目编号.some(id=>题.get(id).知识点===知识点);});
}
export function 生成专项(库,类型,知识点){
 if(!(类型==='单选'?单选知识点:类型==='阅读'?阅读知识点:[]).includes(知识点))throw new Error('专项知识点无效。');
 const 库存=专项库存(库,类型,知识点);if(!库存.length)throw new Error('这个知识点暂时没有可用题目。');
 const 取=打乱(库存).slice(0,类型==='单选'?25:3),题表=new Map(库.题目.map(q=>[q.编号,q]));
 const 题=类型==='单选'?取:取.flatMap(p=>打乱(p.题目编号.filter(id=>题表.get(id).知识点===知识点)).map(id=>题表.get(id)));
 return {编号:新编号(),版本:2,题源:'混合',模块:'专项',专项类型:类型,知识点,名称:`${知识点} · ${类型}专项`,题目编号:题.map(q=>q.编号),篇章编号:类型==='阅读'?取.map(p=>p.编号):[],单元:题.map(q=>({题目:q.编号,题型:q.题型,篇章:q.篇章||null})),选项顺序:Object.fromEntries(题.map(q=>[q.编号,/\b(?:above|below)\b|\b[A-D]\s*(?:and|or|&|,)\s*[A-D]\b/i.test(q.选项.join(' '))?[0,1,2,3]:打乱([0,1,2,3])])),本次原创:[],作答:{},自评:{},标记:[],当前题:0,开始时间:Date.now(),满分:100,金币:题.length};
}
export function 计算学习报告(库,存档,现在=Date.now()){
 const 题表=new Map(库.题目.map(q=>[q.编号,q])),近期=存档.记录.filter(r=>r.提交时间>=现在-30*86400000&&r.提交时间<=现在),统计=new Map();let 总=0,对=0,用时=0;
 for(const r of 近期){用时+=Math.max(0,Number(r.用时)||0);r.题目编号.forEach((id,i)=>{const q=题表.get(id);if(!q)return;总++;if(r.对错[i])对++;const 点=q.知识点||'综合语法',k=q.题型+':'+点,x=统计.get(k)||{知识点:点,类型:q.题型,次数:0,错误:0};x.次数++;if(!r.对错[i])x.错误++;统计.set(k,x);});}
 const 薄弱=[...统计.values()].filter(x=>x.错误>0).sort((a,b)=>b.错误-a.错误||b.错误/b.次数-a.错误/a.次数).slice(0,5);
 return {次数:近期.length,总题:总,正确率:总?Math.round(对/总*100):null,平均每题秒:总?Math.round(用时/总):null,平均每套秒:近期.length?Math.round(用时/近期.length):null,薄弱,建议:薄弱.length?`建议优先巩固${薄弱.slice(0,2).map(x=>x.知识点).join('和')}，再完成每日错题复习。`:总?'近期练习全部答对，可以尝试70分钟整卷考试。':'完成一套练习后，这里会按你的实际作答生成建议。'};
}
