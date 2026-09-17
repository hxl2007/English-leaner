// 解析以题库中已有的逐题判断为依据；不把词面相似度当作答案证据。
const 字母='ABCD';
const 词义={can:'表示能力或条件允许',could:'可表示过去的能力、委婉语气或较弱的可能性',must:'表示必须或较有把握的推断',should:'表示应该或预期',might:'表示不太确定的可能性',may:'表示许可或可能性',"mustn't":'表示禁止',"needn't":'表示没有必要',"couldn't":'表示不能或不可能',"won't":'表示将不会或不愿意',because:'引出原因',although:'引出让步关系',though:'引出让步关系',unless:'表示除非，相当于 if not',until:'表示直到某时',since:'可以表示自从或因为',while:'可以表示同时发生或对比',if:'引出条件或表示是否',whether:'表示是否',but:'表示转折',and:'表示并列',so:'表示结果',or:'表示选择或否则',however:'表示然而，是连接副词',therefore:'表示因此，是连接副词',either:'表示两者中的任意一个',neither:'表示两者都不',both:'表示两者都',all:'表示全部，通常用于三者及以上',each:'强调每一个个体',every:'强调范围中的每一个，需修饰名词',few:'修饰可数名词复数，含几乎没有的否定意义',little:'表示数量时修饰不可数名词，含几乎没有的否定意义',many:'修饰可数名词复数',much:'修饰不可数名词',a:'不定冠词，用于泛指的单数可数名词',an:'不定冠词，用在元音音素前',the:'定冠词，常用于特指',who:'关系代词或疑问词，指人',whom:'指人，通常在从句中作宾语',whose:'表示所属关系',which:'可以指事物或限定范围中的选择',where:'表示地点',when:'表示时间',why:'表示原因',how:'表示方式或程度',that:'可引出某些名词性从句和限制性定语从句',what:'可表示所……的事物，在名词性从句中充当成分',"made off":'表示匆忙离开',"made up":'可表示编造、组成或弥补',"made out":'可表示辨认出或理解',"made for":'表示朝某处前进',train:'名词可表示火车，动词可表示训练',room:'表示房间，也可表示空间',cave:'表示洞穴',hole:'表示洞或孔'};
function 形式(选项,q){
 const x=选项.trim().toLowerCase();if(词义[x])return 词义[x];
 if(/^(?:will|shall) have been \w+ing$/.test(x))return '这是将来完成进行时结构';
 if(/^will be \w+ing$/.test(x))return '这是将来进行时，强调将来某时正在发生的动作';
 if(/^(?:has|have) been \w+ing$/.test(x))return '这是现在完成进行时';
 if(/^(?:was|were) \w+ing$/.test(x))return '这是过去进行时，强调过去某时正在发生的动作';
 if(/^(?:am|is|are) \w+ing$/.test(x))return '这是现在进行时';
 if(/^had (?:been )?\w+/.test(x))return '这是过去完成时结构，需要过去的参照点';
 if(/^(?:has|have) been \w+/.test(x))return '这是现在完成时的被动结构';
 if(/^(?:has|have) \w+/.test(x))return '这是现在完成时结构';
 if(/^will (?:be )?\w+/.test(x))return '这是含 will 的将来时结构';
 if(/^to have /.test(x))return '这是不定式的完成式，强调先于谓语发生';
 if(/^to be /.test(x))return '这是不定式结构，需继续区分主动或被动关系';
 if(/^to \w+$/.test(x))return '这是 to 加动词原形的不定式';
 if(/^having /.test(x))return '这是分词的完成式，常强调动作先后关系';
 if(/^[a-z]+ing$/.test(x)&&q.选项.some(o=>[x.slice(0,-3),x.slice(0,-3)+'e',x.slice(0,-4)].includes(o.toLowerCase())))return '这是 -ing 形式，需判断动名词或现在分词的语法位置';
 if(/^[a-z]+ly$/.test(x))return '本项通常为副词，需检查修饰对象和句意';
 if(/^(?:a|an|the)(?:;\s*(?:a|an|the))+$/.test(x))return x.split(/;\s*/).map((w,i)=>`第${i+1}空：${词义[w]}`).join('；');
 return '';
}
export function 对照解析(q,a,p,答案={}){
 const 正确文本=(a.正确选项||[]).map(x=>q.选项[字母.indexOf(x)]),原文=p?.段落||[];
 const 还原=s=>s.replace(/\{\{(\d+)\}\}/g,(_,n)=>{const id=p?.题目编号[Number(n)-1],答=答案[id];return 答?.正确选项?.length?`〔${Number(n)===q.原题号?'本空：':''}${答.选项文本?.[0]||答.填空文本||`第${n}空`}〕`:`(${n}) ____`;});
 let 引文=[],引用=[];
 if(q.题型==='阅读'){
  // 解析中明确引用的英文短语优先定位；没有引文时保留全文供核对，避免猜测证据。
  引用=[...(a.解析.match(/[a-zA-Z][a-zA-Z0-9'’ ,—-]+[a-zA-Z]/g)||[]),...正确文本].map(s=>s.trim()).filter(s=>s.split(/\s+/).length>=3);
  const 匹配=原文.map((文本,i)=>({文本,段:i+1})).filter(x=>引用.some(引=>x.文本.toLowerCase().includes(引.toLowerCase())));
  引文=匹配.length?匹配:原文.map((文本,i)=>({文本,段:i+1}));
 }
 if(q.题型==='完形'){
  const i=原文.findIndex(s=>s.includes(`{{${q.原题号}}}`));
  引文=原文.map((文本,段)=>({文本:还原(文本),段:段+1})).filter((_,j)=>Math.abs(j-i)<=1);
 }
 const 选项=(q.选项||[]).map((文本,i)=>{
  const 正确=(a.正确选项||[]).includes(字母[i]),特征=形式(文本,q),自写=a.选项解析?.[字母[i]];
  let 理由=自写||'';
  if(!理由&&正确)理由=`本项符合题意。${a.解析}`;
  if(!理由&&!正确){
   if(特征)理由=`${特征}。本题需要“${正确文本.join(' / ')}”：${a.解析}`;
   else if(q.题型==='阅读')理由=`将本项“${文本}”与原文及正确项“${正确文本.join(' / ')}”比较。排除依据：${a.解析}`;
   else 理由=`把“${文本}”代入后，需核对${a.考点||'句意与语法'}。本题要求使用“${正确文本.join(' / ')}”：${a.解析}`;
  }
  let 代入='';
  if(q.题型==='单选'){const 空=文本.split(/\s*;\s*/),数=(q.题干.match(/____/g)||[]).length;let j=0;代入=q.题干.replace(/____/g,()=>数===空.length?空[j++]:文本);}
  if(q.题型==='完形'){const s=原文.find(s=>s.includes(`{{${q.原题号}}}`))||'',位置=s.indexOf(`{{${q.原题号}}}`);代入=s.slice(Math.max(0,位置-95),位置+120).replace(`{{${q.原题号}}}`,`〔${文本}〕`).replace(/\{\{(\d+)\}\}/g,'($1) ____');}
  return {原字母:字母[i],文本,正确,理由,代入};
 });
 return {依据:a.解析,引文,选项,引用};
}
