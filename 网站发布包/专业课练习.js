import {新编号} from './组卷.js';
import {数学难度,验证数学树} from './数学分级.js';
export function 验证专业课题库(库){
  if(库?.版本!==1||!Array.isArray(库.院校)||!库.院校.every(x=>typeof x==='string')||!Array.isArray(库.试卷))throw new Error('专业课题库格式无效。');
  const 卷号=new Set(),题号=new Set();
  for(const 卷 of 库.试卷){
    const 年份有效=['原卷转载','照片试题'].includes(卷.类型)?(卷.类型==='照片试题'&&卷.年份===null)||Number.isInteger(卷.年份)&&卷.年份>=1990&&卷.年份<=2100:卷.年份===null;
    const 样题年代有效=卷.类型!=='官方样题'||Number.isInteger(卷.文献年份)&&卷.文献年份>=1990&&卷.文献年份<=2100;
    if(typeof 卷.编号!=='string'||卷号.has(卷.编号)||!库.院校.includes(卷.院校)||!['高等数学','C语言'].includes(卷.科目)||!['原卷转载','复习题','官方样题','照片试题','同型练习'].includes(卷.类型)||!年份有效||!样题年代有效||!Array.isArray(卷.题目)||!卷.题目.length)throw new Error('试卷的院校、年份或题目不完整。');
    卷号.add(卷.编号);
    for(const q of 卷.题目){
      if(typeof q.编号!=='string'||题号.has(q.编号)||!q.题干||!['单选','填空','计算','证明','简答','编程'].includes(q.题型)||!Number.isInteger(q.分值)||q.分值<=0)throw new Error('试卷题目或分值无效。');
      if(q.题型==='单选'&&(!Array.isArray(q.选项)||q.选项.length!==4||q.选项.some(x=>typeof x!=='string')))throw new Error('单选题选项不完整。');
      if(q.难度!==undefined&&!数学难度.includes(q.难度)||q.联大难度!==undefined&&!数学难度.includes(q.联大难度))throw new Error('数学难度无效。');
      if(q.大纲内===false&&q.难度!=='最高难度题')throw new Error('拓展内容仅限最高难度题。');
      if(q.数学排版){if(!Array.isArray(q.数学排版.式子)||!q.数学排版.式子.length)throw new Error('数学公式缺失。');q.数学排版.式子.forEach(x=>验证数学树(x));}
      题号.add(q.编号);
    }
    if(卷.题目.reduce((n,q)=>n+q.分值,0)!==卷.满分)throw new Error('试卷分值合计与满分不一致。');
  }
  return 库;
}
export function 新建专业课练习(卷,现在=Date.now()){
  return {版本:1,编号:新编号(),试卷:卷.编号,阶段:'作答',作答:{},自评:{},截图:{},判题理由:{},当前题:0,开始时间:现在};
}
export function 专业课已作答(q,练习){
  if(q.题型==='单选')return /^[ABCD]$/.test(练习.作答?.[q.编号]||'');
  const 文=typeof 练习.作答?.[q.编号]==='string'&&练习.作答[q.编号].trim().length>0;
  const 图=typeof 练习.截图?.[q.编号]==='string'&&练习.截图[q.编号].startsWith('data:image');
  return 文||图;
}
export function 专业课未答题(卷,练习){
  return 卷.题目.flatMap((q,i)=>专业课已作答(q,练习)?[]:[i]);
}
export function 验证专业课练习(练习,卷){
  if(练习?.版本!==1||练习.试卷!==卷.编号||!['作答','自评','完成'].includes(练习.阶段)||typeof 练习.编号!=='string'||!Number.isFinite(练习.开始时间)||!Number.isInteger(练习.当前题)||练习.当前题<0||练习.当前题>=卷.题目.length||!练习.作答||!练习.自评)throw new Error('专业课进度格式无效，原进度仍保留在浏览器中。');
  if(练习.截图===undefined)练习.截图={};
  if(练习.判题理由===undefined)练习.判题理由={};
  if(typeof 练习.截图!=='object'||Array.isArray(练习.截图)||typeof 练习.判题理由!=='object'||Array.isArray(练习.判题理由))throw new Error('专业课截图存档无效。');
  for(const q of 卷.题目){
    const 值=练习.作答[q.编号];
    if(值!==undefined&&(typeof 值!=='string'||值.length>6000||q.题型==='单选'&&值!==''&&!/^[ABCD]$/.test(值)))throw new Error('专业课作答格式无效。');
    const 图=练习.截图[q.编号];
    if(图!==undefined&&(typeof 图!=='string'||图.length>900000||图&&!图.startsWith('data:image')))throw new Error('专业课截图格式无效。');
    const 分=练习.自评[q.编号];
    if(分!==undefined&&(!Number.isInteger(分)||分<0||分>q.分值||q.题型==='单选'))throw new Error('专业课自评分无效。');
  }
  if(练习.阶段!=='作答'&&专业课未答题(卷,练习).length)throw new Error('已交卷进度存在未作答题目。');
  return 练习;
}
export function 验证专业课答案(卷,答案){
  for(const q of 卷.题目){
    const a=答案[q.编号];
    if(!a?.参考答案||!a.解析||q.题型==='单选'&&!/^[ABCD]$/.test(a.正确选项||'')||q.题型!=='单选'&&(!Array.isArray(a.评分要点)||!a.评分要点.length))throw new Error('参考答案或评分要点缺失，暂时无法交卷。');
    if(a.数学排版){if(!Array.isArray(a.数学排版.式子)||!a.数学排版.式子.length)throw new Error('答案公式缺失。');a.数学排版.式子.forEach(x=>验证数学树(x));}
  }
  return 答案;
}
export function 专业课评分(卷,练习,答案){
  验证专业课练习(练习,卷);验证专业课答案(卷,答案);
  if(专业课未答题(卷,练习).length)throw new Error('请先完成全部题目。');
  let 单选得分=0,主观得分=0;
  const 单题得分=卷.题目.map(q=>{
    if(q.题型==='单选'){const 分=练习.作答[q.编号]===答案[q.编号].正确选项?q.分值:0;单选得分+=分;return 分;}
    const 分=练习.自评[q.编号];
    if(!Number.isInteger(分)||分<0||分>q.分值)throw new Error('请对照评分要点完成全部主观题自评。');
    主观得分+=分;return 分;
  });
  return {分数:单选得分+主观得分,满分:卷.满分,单选得分,主观得分,单题得分,含自评:卷.题目.some(q=>q.题型!=='单选')};
}
