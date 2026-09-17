export const 单选知识点=['时态与语态','非谓语动词','定语从句','名词性从句','状语从句与连词','虚拟语气','情态动词','主谓一致','倒装与强调','代词冠词介词','比较与数量','词汇与搭配','情景交际','综合语法'];
export const 阅读知识点=['细节理解','推理判断','主旨大意','词义猜测'];
export function 归类知识点(q,a={}){
 const t=a.考点||q.考点||'',问=q.题干||'';
 if(q.题型==='阅读'){
  if(/词义|指代|语义猜|词语含义/.test(t)||/\b(?:word|phrase|underlined|refer to|means? in)\b/i.test(问))return '词义猜测';
  if(/主旨|标题|中心|大意|写作目的|作者目的/.test(t)||/\b(?:main(?:ly)?|best title|purpose of|primarily)\b/i.test(问))return '主旨大意';
  if(/推断|推理|态度|意图|推测/.test(t)||/\b(?:infer|inferred|imply|implies|implied|attitude|most likely)\b/i.test(问))return '推理判断';
  return '细节理解';
 }
 if(q.题型!=='单选')return q.题型==='完形'?'完形语境与搭配':'翻译句式与表达';
 if(/虚拟|wish|if only|过去反事实|would rather/i.test(t))return '虚拟语气';
 if(/情态|推测|必要性|不必要的已完成|had better/i.test(t))return '情态动词';
 if(/非谓语|不定式|动名词|分词|独立主格|使役|形式宾语|形式主语|宾语补足语|allow结构/.test(t))return '非谓语动词';
 if(/定语从句|关系代词|关系副词/.test(t))return '定语从句';
 if(/名词性|主语从句|宾语从句|表语从句|同位语|间接问句/.test(t))return '名词性从句';
 if(/从句|连词|让步|条件|原因关系|因果|并列|结果结构|not until|whether or|either or|转折逻辑|逻辑连接/.test(t))return '状语从句与连词';
 if(/时态|语态|完成|进行时|过去时|现在时|将来时|被动|客观规律|过去参照时间|被用于/.test(t))return '时态与语态';
 if(/一致/.test(t))return '主谓一致';
 if(/倒装|强调|省略/.test(t))return '倒装与强调';
 if(/比较|倍数|数量|量词|数词|可数|enough|同级结构/i.test(t))return '比较与数量';
 if(/代词|冠词|介词|所属|两者对应|时间范围|排除关系/.test(t))return '代词冠词介词';
 if(/交际|疑问词|反意|情景|附加问句/.test(t))return '情景交际';
 if(/词|搭配|短语|表达|句型|结构|表语/.test(t))return '词汇与搭配';
 return '综合语法';
}
