export const 考试时长=70*60;
export function 设置考试(c,现在=Date.now()){return {...c,考试:true,开始时间:现在,考试截止:现在+考试时长*1000,名称:`70分钟考试 · ${c.名称}`};}
export const 考试剩余=(c,现在=Date.now())=>Math.max(0,Math.ceil((c.考试截止-现在)/1000));
export const 已到考试时间=(c,现在=Date.now())=>!!c?.考试&&!c.交卷时间&&考试剩余(c,现在)<=0;
export function 锁定试卷(c,现在=Date.now()){
 const 自评={...c.自评};for(const u of c.单元)if(u.题型==='翻译'&&!String(c.作答[u.题目]||'').trim())自评[u.题目]=0;
 return {...c,交卷时间:c.交卷时间||现在,阶段:c.单元.some(u=>u.题型==='翻译'&&String(c.作答[u.题目]||'').trim())?'自评':'已交卷',自评};
}
