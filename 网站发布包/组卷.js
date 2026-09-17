export const 模块列表 = ['单选', '阅读', '完形', '翻译'];
export const 奖励规则 = {单选:25, 阅读:40, 完形:30, 翻译:25, 整卷:100, 复习:10, 专项:25};
export {境界商品 as 兑换物品} from './修行商城.js';
export const 修为等级 = [
  {名称:'凡人',金币:0}, {名称:'练气期',金币:25}, {名称:'筑基期',金币:250},
  {名称:'金丹期',金币:750}, {名称:'元婴期',金币:1500}, {名称:'化神期',金币:3000},
  {名称:'炼虚期',金币:6000}, {名称:'合体期',金币:10000}, {名称:'大乘期',金币:16000}
];
export function 修为信息(金币) {
  const 级别 = 修为等级.findLastIndex(x => 金币 >= x.金币);
  const 当前 = 修为等级[Math.max(0,级别)], 下一 = 修为等级[级别+1];
  return {当前, 下一, 进度:下一?Math.max(0,Math.min(100,(金币-当前.金币)/(下一.金币-当前.金币)*100)):100};
}
export function 奖励金币(练习,分数) {
  const 满分=练习.模块==='整卷'?85:100;
  if(练习.模块==='复习')return Math.round(分数/100*练习.题目编号.length);
  return Math.max(0,Math.min(奖励规则[练习.模块]||0,Math.round((分数/满分)*(奖励规则[练习.模块]||0))));
}
export function 新编号() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const 字节 = crypto.getRandomValues(new Uint8Array(16));
  字节[6]=(字节[6]&15)|64; 字节[8]=(字节[8]&63)|128;
  const x=Array.from(字节,n=>n.toString(16).padStart(2,'0')).join('');
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;
}
export function 随机整数(上限) {
  if(!Number.isInteger(上限)||上限<1||上限>0xffffffff) throw new Error('随机范围无效。');
  const 字节=new Uint32Array(1), 截点=0x100000000-(0x100000000%上限);
  do {crypto.getRandomValues(字节);} while(字节[0]>=截点);
  return 字节[0]%上限;
}
export function 打乱(列表, 随机=随机整数) {
  const 结果=[...列表];
  for(let i=结果.length-1;i>0;i--){const j=随机(i+1);[结果[i],结果[j]]=[结果[j],结果[i]];}
  return 结果;
}
export const 文字指纹 = 文本 => 文本.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function 内容去重(列表, 取文字) {
  const 已有=new Set();
  return 列表.filter(q=>{const key=文字指纹(取文字(q));if(已有.has(key))return false;已有.add(key);return true;});
}
export function 建立题库索引(题库) {
  return {题目:new Map(题库.题目.map(q=>[q.编号,q])),篇章:new Map((题库.篇章||[]).map(p=>[p.编号,p]))};
}
export function 可抽内容(题库, 题源, 已抽=[]) {
  const 已用=new Set(题源==='原创'?已抽:[]);
  const 题=题库.题目.filter(q=>q.可抽取!==false&&(q.题源||'原题')===题源&&!已用.has(q.编号));
  const 合格题=new Set(题.map(q=>q.编号));
  const 文=(题库.篇章||[]).filter(p=>p.可抽取!==false&&p.题源===题源&&!已用.has(p.编号)&&p.题目编号.every(id=>合格题.has(id)));
  return {
    单选:内容去重(题.filter(q=>(q.题型||'单选')==='单选'),q=>q.题干),
    翻译:内容去重(题.filter(q=>q.题型==='翻译'),q=>q.题干),
    阅读:内容去重(文.filter(p=>p.题型==='阅读'),p=>p.段落.join('\n')),
    完形:内容去重(文.filter(p=>p.题型==='完形'),p=>p.段落.join('\n'))
  };
}
export function 检查库存(题库, 题源, 模块, 已抽=[]) {
  if(!['原题','原创'].includes(题源)||![...模块列表,'整卷'].includes(模块))throw new Error('练习类型无效。');
  const 库存=可抽内容(题库,题源,已抽), 需求={单选:25,阅读:3,完形:1,翻译:5};
  const 缺少=(模块==='整卷'?模块列表:[模块]).filter(k=>库存[k].length<需求[k]);
  return {库存, 缺少, 可开始:缺少.length===0};
}
export function 生成练习(题库, 题源, 模块, 已抽=[], 随机=随机整数) {
  const {库存,缺少}=检查库存(题库,题源,模块,已抽);
  if(缺少.length)throw new Error(题源==='原创'?`未抽过的${缺少.join('、')}题目不足，请补充原创题库。`:`${缺少.join('、')}原题尚未补齐。`);
  const 题目表=建立题库索引(题库).题目;
  const 题目编号=[],篇章编号=[],单元=[],本次原创=[];
  const 加题=(编号, 类型, 篇章=null)=>{题目编号.push(编号);单元.push({题目:编号,题型:类型,篇章});};
  for(const 类型 of (模块==='整卷'?模块列表:[模块])) {
    if(类型==='单选'||类型==='翻译') {
      for(const q of 打乱(库存[类型],随机).slice(0,类型==='单选'?25:5))加题(q.编号,类型);
    } else {
      for(const p of 打乱(库存[类型],随机).slice(0,类型==='阅读'?3:1)) {
        if(类型==='完形'&&p.题目编号.length!==20)throw new Error('完形必须包含完整的 20 个空。');
        篇章编号.push(p.编号);
        // 阅读题可打乱；完形空号必须保持与正文中的空格一致。
        const 题序=类型==='阅读'?打乱(p.题目编号,随机):p.题目编号;
        for(const id of 题序)加题(id,类型,p.编号);
      }
    }
  }
  if(题源==='原创')本次原创.push(...题目编号,...篇章编号);
  const 选项顺序=Object.fromEntries(题目编号.filter(id=>题目表.get(id).选项?.length).map(id=>{
    const q=题目表.get(id), 关联选项=/\b(?:above|below)\b|\b[A-D]\s*(?:and|or|&|,)\s*[A-D]\b/i.test(q.选项.join(' '));
    return [id,关联选项?[0,1,2,3]:打乱([0,1,2,3],随机)];
  }));
  return {编号:新编号(),版本:2,题源,模块,名称:`${题源==='原创'?'原创模拟':'原题随机'} · ${模块==='整卷'?'全套卷':模块}`,题目编号,篇章编号,单元,选项顺序,本次原创,作答:{},自评:{},标记:[],当前题:0,开始时间:Date.now(),满分:模块==='整卷'?85:100,金币:奖励规则[模块]};
}
export function 补齐旧练习(记录,题库) {
  if(记录.版本===2)return 记录;
  return {...记录,版本:2,模块:'单选',题源:'原题',名称:`原选择题第 ${记录.套题} 套`,满分:100,金币:25,篇章编号:[],单元:记录.题目编号.map(id=>({题目:id,题型:'单选',篇章:null})),选项顺序:{},本次原创:[],自评:{},标记:记录.标记||[]};
}
export function 题目分值(练习,索引) {
  const 题=练习.单元[索引];
  if(练习.模块!=='整卷')return 100/练习.题目编号.length;
  if(题.题型==='单选')return 1;
  if(题.题型==='完形')return 0.5;
  if(题.题型==='翻译')return 4;
  return 30/练习.单元.filter(x=>x.题型==='阅读').length;
}
export function 未答题(练习) {
  return 练习.单元.flatMap((q,i)=>{
    const 值=练习.作答[q.题目];
    return (q.题型==='翻译'?typeof 值==='string'&&值.trim().length>0:/^[ABCD]$/.test(值||''))?[]:[i];
  });
}
export function 通用评分(练习,答案) {
  if(未答题(练习).length&&!(练习.考试&&练习.交卷时间))throw new Error('请完成全部题目后再提交。');
  const 单题得分=[],对错=[];
  for(const [i,q] of 练习.单元.entries()) {
    if(!答案[q.题目])throw new Error('题目答案缺失，请更新题库。');
    const 满分=题目分值(练习,i);
    let 比例;
    if(q.题型==='翻译') {
      if(练习.考试&&练习.交卷时间&&!String(练习.作答[q.题目]||'').trim()){单题得分.push(0);对错.push(false);continue;}
      const 分=练习.自评?.[q.题目];
      if(!Number.isInteger(分)||分<0||分>4)throw new Error('请对照评分要点完成每道翻译的自评。');
      比例=分/4;
    } else 比例=答案[q.题目].正确选项.includes(练习.作答[q.题目])?1:0;
    单题得分.push(满分*比例);对错.push(比例===1);
  }
  const 分数=Math.round(单题得分.reduce((n,x)=>n+x,0)*100)/100,满分=练习.模块==='整卷'?85:100;
  return {分数,满分,金币:['复习','专项'].includes(练习.模块)?对错.filter(Boolean).length:奖励金币(练习,分数),修为:['复习','专项'].includes(练习.模块)?对错.filter(Boolean).length:奖励金币(练习,分数),单题得分,对错,含自评:练习.单元.some(q=>q.题型==='翻译')};
}
export function 验证练习(练习,题库) {
  const 索引=建立题库索引(题库);
  if(!练习||typeof 练习.编号!=='string'||!/^[\w-]{8,80}$/.test(练习.编号)||!Array.isArray(练习.题目编号)||new Set(练习.题目编号).size!==练习.题目编号.length||!练习.题目编号.every(id=>索引.题目.has(id)))throw new Error('存档包含无效的题目。');
  const c=补齐旧练习(练习,题库);
  const 复习=c.模块==='复习',专项=c.模块==='专项',部分=复习||专项;
  if(!(复习?c.题源==='错题':专项?c.题源==='混合':['原题','原创'].includes(c.题源))||![...模块列表,'整卷','复习','专项'].includes(c.模块)||!Array.isArray(c.单元)||c.单元.length!==c.题目编号.length)throw new Error('存档的练习结构无效。');
  const 数={单选:0,阅读:0,完形:0,翻译:0};
  const 篇章=new Map();
  for(const [i,u] of c.单元.entries()) {
    const q=索引.题目.get(u.题目);
    if(u.题目!==c.题目编号[i]||u.题型!==(q.题型||'单选')||!部分&&(q.题源||'原题')!==c.题源||u.篇章!==(q.篇章||null))throw new Error('存档题目与题库不一致。');
    数[u.题型]++;
    if(u.篇章){const 集=篇章.get(u.篇章)||new Set();集.add(u.题目);篇章.set(u.篇章,集);}
    const 顺序=c.选项顺序?.[u.题目];
    if(顺序&&(!Array.isArray(顺序)||顺序.length!==4||[...顺序].sort().join('')!=='0123'))throw new Error('存档选项顺序无效。');
  }
  const 阅读数=[...篇章.keys()].filter(id=>索引.篇章.get(id)?.题型==='阅读').length;
  const 完形数=[...篇章.keys()].filter(id=>索引.篇章.get(id)?.题型==='完形').length;
  if(!部分)for(const [id,题] of 篇章){const p=索引.篇章.get(id);if(!p||p.题目编号.length!==题.size||!p.题目编号.every(q=>题.has(q)))throw new Error('存档文章或小题不完整。');}
  if(!Array.isArray(c.篇章编号)||c.篇章编号.length!==篇章.size||new Set(c.篇章编号).size!==篇章.size||!c.篇章编号.every(id=>篇章.has(id)))throw new Error('存档篇章目录无效。');
  const 需求=c.模块==='整卷'?{单选:25,阅读:3,完形:1,翻译:5}:{单选:0,阅读:0,完形:0,翻译:0,[c.模块]:{单选:25,阅读:3,完形:1,翻译:5}[c.模块]};
  if(!部分&&(数.单选!==需求.单选||数.翻译!==需求.翻译||阅读数!==需求.阅读||完形数!==需求.完形||数.完形!==需求.完形*20))throw new Error('存档题量不符合组卷规则。');
  if(复习&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.复习日期||'')||c.编号!==`daily-${c.复习日期}`||c.题目编号.length<1||c.题目编号.length>10))throw new Error('每日复习记录无效。');
  if(专项&&(!['单选','阅读'].includes(c.专项类型)||!c.题目编号.length||c.题目编号.some(id=>{const q=索引.题目.get(id);return q.题型!==c.专项类型||q.知识点!==c.知识点;})||c.专项类型==='单选'&&c.题目编号.length>25||c.专项类型==='阅读'&&(阅读数<1||阅读数>3)))throw new Error('专项题目或知识点不匹配。');
  if(c.考试&&(c.模块!=='整卷'||!Number.isFinite(c.考试截止)||c.考试截止-c.开始时间!==70*60000||c.交卷时间!==undefined&&(!Number.isFinite(c.交卷时间)||c.交卷时间<c.开始时间)))throw new Error('考试计时记录无效。');
  if(!c.作答||typeof c.作答!=='object'||!Number.isFinite(c.开始时间??c.提交时间))throw new Error('存档进度无效。');
  return c;
}
