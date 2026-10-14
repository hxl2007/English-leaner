export const 数学难度=['简单题','基础题','中等题','最高难度题'];
export function 题目难度(题,档位='联大'){
  return 档位==='联大'?(题.联大难度||题.难度):题.难度;
}
export function 筛选数学题(库,{知识点='全部',难度='全部',档位='联大',题源='全部',院校='北京联合大学'}={}){
  return 库.试卷.filter(卷=>卷.科目==='高等数学'&&(院校==='全部'||卷.院校===院校)).flatMap(卷=>卷.题目.map(题=>({卷,题}))).filter(({题})=>
    (知识点==='全部'||题.知识点===知识点)&&(难度==='全部'||题目难度(题,档位)===难度)&&
    (题源==='全部'||题源==='照片'&&题.题源类别==='照片原题'||题源==='练习'&&题.题源类别==='同型练习'));
}
// 每次练习保留题号清单，刷新和查看成绩继续使用同一批题目。
export function 组数学专项卷(库,题号,标题='数学单知识点练习',编号='数学专项'){
  if(!Array.isArray(题号)||!题号.length||题号.length>50||题号.some(x=>typeof x!=='string')||new Set(题号).size!==题号.length)throw new Error('数学练习题号无效。');
  if(!/^数学专项(?:-[a-zA-Z0-9-]{1,100})?$/.test(编号))throw new Error('数学专项编号无效。');
  if(typeof 标题!=='string'||标题.length>160)throw new Error('数学专项名称无效。');
  const 索引=new Map(库.试卷.filter(x=>x.科目==='高等数学').flatMap(卷=>卷.题目.map(q=>[q.编号,{...q,原题卷号:卷.编号,原题名称:卷.名称,原题院校:卷.院校,原题年份:卷.年份,原题对照:卷.原卷,原题来源:卷.来源}])));
  const 题目=题号.map(x=>索引.get(x));
  if(题目.some(x=>!x))throw new Error('该数学练习含有未收录题目，原进度仍保留。');
  return {编号,院校:题目.every(q=>q.原题院校===题目[0].原题院校)?题目[0].原题院校:'全部',科目:'高等数学',年份:null,类型:'同型练习',名称:标题,
    来源:'',来源说明:'按所选知识点与难度组题；题目旁保留原题对照或同型练习标记。',题目,满分:题目.reduce((n,q)=>n+q.分值,0),练习分值:true};
}
const 数学标签=new Set(['mrow','mi','mn','mo','msup','msub','msubsup','mfrac','msqrt','mroot','mfenced','munder','mover','munderover','mtable','mtr','mtd','mtext']);
const 转义=文字=>String(文字??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function 验证数学树(树,深度=0){
  if(深度>35||!Array.isArray(树)||!数学标签.has(树[0])||树.length<2||树.length>100)throw new Error('数学公式结构无效。');
  for(const 子 of 树.slice(1)){
    if(typeof 子==='string'){if(子.length>500)throw new Error('数学公式文本过长。');}
    else 验证数学树(子,深度+1);
  }
  return 树;
}
export function 数学树HTML(树){
  验证数学树(树);
  function 输出(节点){return `<${节点[0]}>${节点.slice(1).map(子=>typeof 子==='string'?转义(子):输出(子)).join('')}</${节点[0]}>`;}
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${输出(树)}</math>`;
}
export function 数学排版HTML(排版){
  if(!排版)return '';
  return `${排版.引导?`<span>${转义(排版.引导)}</span>`:''}${排版.式子.map(数学树HTML).join('')}`;
}
