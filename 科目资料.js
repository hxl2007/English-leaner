import {初始化认证,是否已登录,获取当前用户} from './认证.js';
import {验证专业课题库,新建专业课练习,专业课未答题,验证专业课练习,验证专业课答案,专业课评分,验证专业课备份} from './专业课练习.js';
import {专业课奖励上限,专业课奖励金币,专业课预计修为文案} from './组卷.js';
import {数学难度,题目难度,筛选数学题,组数学专项卷,数学排版HTML,数学题记录,抽取数学题} from './数学分级.js';
import {空专业课存档,校验专业课存档,专业课备份内容,合并专业课存档,读取专业课存档,保存专业课存档,专业课账户,读取英语备份,导入英语备份,校验英语备份,下载学习备份,清理闲置截图} from './专业课存档.js';
import {是主观题,专业课AI判题HTML,绑定专业课AI判题} from './AI判题.js';

const 参数=new URLSearchParams(location.search),科目=参数.get('科目')==='C语言'?'C语言':'高等数学';
const 显示科目=科目==='C语言'?'C 语言 · 程序设计基础':'高等数学 · 应用数学基础';
const $=选择=>document.querySelector(选择);
const 转义=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const 年份说明=卷=>卷.年份?`${卷.年份} 年`:卷.类型==='模拟套题'?`模拟套题 · 依据联大大纲${卷.文献年份?' · '+卷.文献年份:''}`:卷.类型==='官方样题'?`官方样题 · ${卷.文献年份} 年发布`:卷.类型==='照片试题'?'照片整理 · 年份未注明':卷.类型==='同型练习'?'按考点练习':`教材复习${卷.文献年份?' · '+卷.文献年份+' 版':''}`;

function 套题完成过(编号){
  return 本机.记录.some(x=>x.试卷===编号&&x.阶段==='完成');
}
function 下一套轮刷编号(卷列表){
  if(!卷列表.length)return '';
  const 未完成草稿=卷列表.find(v=>本机.草稿[v.编号]);
  if(未完成草稿)return 未完成草稿.编号;
  const 未做过=卷列表.find(v=>!套题完成过(v.编号));
  if(未做过)return 未做过.编号;
  // 全部做过：按最近完成时间，取下一套轮换
  const 完成序=卷列表.map(v=>{
    const r=本机.记录.find(x=>x.试卷===v.编号&&x.阶段==='完成');
    return {编号:v.编号,时间:r?.完成时间||0};
  }).sort((a,b)=>b.时间-a.时间);
  const 最近=完成序[0]?.编号;
  const i=卷列表.findIndex(v=>v.编号===最近);
  return 卷列表[(i+1)%卷列表.length].编号;
}
function 设置套题考察(){
  if(科目!=='高等数学'||!库.数学?.套题考察){const b=$('#套题考察区');if(b)b.hidden=true;return;}
  const 区=$('#套题考察区');if(!区)return;区.hidden=false;
  const 元=库.数学.套题考察;
  const 卷列表=(元.试卷编号||[]).map(id=>库.试卷.find(v=>v.编号===id)).filter(Boolean);
  const 合计覆盖=元.套题合计覆盖数??元.本卷覆盖数??0;
  const 大纲总=元.大纲内知识点总数||0;
  $('#套题考察说明').textContent=`${元.说明} 共 ${卷列表.length} 套可轮换。统一结构：${元.结构||''}。四套合计直接考查 ${合计覆盖} / ${大纲总} 个大纲内知识点。`;
  const 结构=卷列表[0]?.结构说明||{};
  const 修为样=卷列表[0]?专业课奖励上限(卷列表[0]):80;
  $('#套题结构卡').innerHTML=`<ul class="套题结构列表">${['选择题','填空题','计算题','证明题'].map(k=>结构[k]?`<li><strong>${转义(k)}</strong><span>${转义(结构[k])}</span></li>`:'').join('')}${结构.合计?`<li><strong>合计</strong><span>${转义(结构.合计)}</span></li>`:''}</ul><p class="套题时长">每套建议 ${卷列表[0]?.建议时长分钟||150} 分钟 · 满分 ${卷列表[0]?.满分||100} 分 · 完成约 +${修为样} 修为（按得分比例）</p>`;
  const 下一=下一套轮刷编号(卷列表);
  const 下一卷=卷列表.find(v=>v.编号===下一);
  const 草稿中=卷列表.filter(v=>本机.草稿[v.编号]).length;
  const 已完成=卷列表.filter(v=>套题完成过(v.编号)).length;
  $('#套题轮刷栏').innerHTML=`<div class="轮刷状态"><span>进度：已完成 ${已完成} / ${卷列表.length} 套${草稿中?` · ${草稿中} 套未交卷`:''}</span></div><div class="轮刷动作"><button type="button" class="练习按钮" data-action="套题轮刷" ${下一?'':'disabled'}>${本机.草稿[下一]?'继续未完成套题':已完成>=卷列表.length&&卷列表.length?'下一套轮刷重练':'开始下一套轮刷'} <span aria-hidden="true">→</span></button>${下一卷?`<p class="轮刷提示">将打开：${转义(下一卷.名称)}</p>`:''}</div>`;
  $('#套题试卷入口').innerHTML=`<div class="套题卡片网格">${卷列表.map((卷,i)=>{
    const 草稿=本机.草稿[卷.编号];
    const 完成=套题完成过(卷.编号);
    const 覆盖数=(元.各卷覆盖&&元.各卷覆盖[卷.编号])||卷.题目.reduce((s,q)=>{s.add(q.知识点);return s;},new Set()).size;
    const 状态=草稿?'未交卷续做':完成?'已完成可重练':'未做';
    const 钮=草稿?'继续作答':完成?'再练本套':'开始本套';
    return `<article class="套题主卡${下一===卷.编号?' 轮刷推荐':''}"><div class="资料标签"><span>第 ${i+1} 套</span><span class="套题状态标签">${状态}</span><span class="修为标签">约 +${专业课奖励上限(卷)} 修为</span></div><h3>${转义(卷.名称)}</h3><p>${卷.题目.length} 道题 · ${卷.满分} 分 · 本套约 ${覆盖数} 个知识点</p><button class="练习按钮" data-action="开卷" data-paper="${转义(卷.编号)}">${钮} <span aria-hidden="true">→</span></button></article>`;
  }).join('')}</div>`;
  const 覆盖=new Set(元.本卷覆盖知识点||[]);
  $('#套题知识点覆盖').innerHTML=`<details><summary>四套合计知识点覆盖（${覆盖.size} / ${大纲总}）</summary><div class="套题知识点网格">${(库.数学.章节||[]).filter(ch=>ch.名称!=='最高难度拓展').map(章=>`<section><h3>${转义(章.名称)}</h3><ul>${章.考点.map(点=>`<li class="${覆盖.has(点.名称)?'已覆盖':'待补练'}"><span>${转义(点.名称)}</span><small>${覆盖.has(点.名称)?'套题已覆盖':'专项补练'}</small></li>`).join('')}</ul></section>`).join('')}</div></details>`;
}

function 来源地址(值){try{const u=new URL(值);return ['https:','http:'].includes(u.protocol)?转义(u.href):'';}catch{return '';}}
function 原卷地址(值){return typeof 值==='string'&&值.startsWith('北京专升本资料/')&&!值.includes('..')?转义(encodeURI('./'+值)):'';}
function 查卷(编号,存档=本机.草稿[编号]){
  const 卷=[...库.试卷,...(库.兼容试卷||[])].find(x=>x.编号===编号&&x.科目===科目);if(卷)return 卷;
  if(科目==='高等数学'&&编号?.startsWith('数学专项-')&&存档?.试卷===编号)return 组数学专项卷(库,存档.数学题号,存档.数学标题,编号);
}
function 当前数学记录(){const s=数学题记录(库,本机.记录);for(const g of Object.values(本机.草稿))for(const id of g.数学题号||[])s.已练.add(库.题号映射?.[id]||id);return s;}
function 数学条件(){return {知识点:$('#数学知识点').value,难度:$('#数学难度').value,档位:$('#数学档位').value,题源:$('#数学题源').value,院校:$('#数学专项院校').value};}
function 新专项进度(卷,条件){
  const 新=新建专业课练习(卷);新.数学题号=卷.题目.map(q=>q.编号);新.数学标题=卷.名称;新.数学条件=条件;return 新;
}
function 设置数学入口(){
  if(科目!=='高等数学'||!库.数学){$('#考点快捷入口').hidden=true;return;}
  $('#数学专项区').hidden=false;
  $('#数学大纲链接').href=原卷地址(库.数学.大纲存档);
  const 考点=库.数学.章节.flatMap(x=>x.考点);
  $('#数学知识点').innerHTML+='<optgroup label="大纲内知识点">'+考点.filter(x=>x.范围==='大纲内').map(x=>`<option>${转义(x.名称)}</option>`).join('')+'</optgroup><optgroup label="最高难度拓展"><option>适度拓展</option></optgroup>';
  $('#数学专项院校').innerHTML+=库.院校.filter(x=>x!=='北京联合大学').map(x=>`<option>${转义(x)}</option>`).join('');
  const 有差别=库.试卷.some(v=>v.科目==='高等数学'&&v.题目.some(q=>q.联大难度&&q.联大难度!==q.难度));
  $('#数学档位标签').hidden=!有差别;
  const 同型=筛选数学题(库,{题源:'练习',院校:'全部'}).length;
  $('#数学覆盖说明').textContent=`覆盖 ${考点.filter(x=>x.范围==='大纲内').length} 个大纲内知识点；同型练习 ${同型} 道，均标为练习。联大照片整理题 80 道，未注明年份。`;
  $('#数学难度说明').textContent=库.数学.难度说明+' '+库.数学.档位说明;
  $('#考点核对依据').textContent=库.数学.核对依据;
  $('#数学考点对照').innerHTML=库.数学.章节.map(章=>`<section><h3>${转义(章.名称)}</h3><ul>${章.考点.map(点=>`<li><strong>${转义(点.名称)}</strong><span>${转义(点.对应大纲)}</span><small>${转义(点.范围)} · ${筛选数学题(库,{知识点:点.名称,题源:'练习'}).length} 道同型题</small></li>`).join('')}</ul></section>`).join('');
  const 待核=库.数学.待核照片题||[];$('#照片待核区').hidden=!待核.length;$('#待核题标题').textContent=`照片中缺少条件的题目（${待核.length} 道）`;
  $('#照片待核清单').innerHTML=待核.map(q=>{const v=库.试卷.find(v=>v.编号===q.试卷);return `<article><h3>${转义(v?.名称||'')} · 原题 ${转义(q.题号)}</h3><p>${转义(q.题干)}</p><p>${转义(q.原因)}</p><a href="${原卷地址(q.原卷)}#page${q.照片页}" target="_blank" rel="noopener noreferrer">查看照片第 ${q.照片页} 页 ↗</a></article>`;}).join('');
  渲染数学入口();
}
function 渲染数学入口(){
  if(科目!=='高等数学'||!库.数学)return;
  const 条件=数学条件(),学习=当前数学记录();let 池=筛选数学题(库,条件);if($('#数学练习方式').value==='错题')池=池.filter(x=>学习.错题.has(x.题.编号));
  $('#数学筛选统计').textContent=`当前条件可练 ${池.length} 道题（未练 ${池.filter(x=>!学习.已练.has(x.题.编号)).length}）；本次抽取 ${Math.min(Number($('#数学题数').value),池.length)} 道，不重复。`;
  $('#开始数学专项').disabled=!池.length;
  const 计数池=筛选数学题(库,{...条件,知识点:'全部'}).filter(x=>$('#数学练习方式').value!=='错题'||学习.错题.has(x.题.编号)),计数=new Map();for(const x of 计数池)计数.set(x.题.知识点,(计数.get(x.题.知识点)||0)+1);
  $('#数学知识点按钮').innerHTML=库.数学.章节.map(章=>`<details class="知识点章节"><summary>${转义(章.名称)}</summary><div class="知识点网格">${章.考点.map(点=>{const 数=计数.get(点.名称)||0;return `<button type="button" class="知识点按钮" data-action="考点刷题" data-point="${转义(点.名称)}" ${数?'':'disabled'} ${条件.知识点===点.名称?'aria-current="true"':''}><span>${转义(点.名称)}</span><small>${数} 道可练${点.范围==='适度超纲'?' · 超纲':''}</small></button>`;}).join('')}</div></details>`).join('');
  const 草稿=Object.values(本机.草稿).filter(x=>{try{return 查卷(x.试卷,x);}catch{return false;}});
  $('#数学专项草稿').innerHTML=草稿.length?`<h3>继续未完成的专项</h3>${草稿.map(x=>`<div class="专项草稿行"><span>${转义(x.数学标题||'数学专项')}</span><button class="次按钮" data-action="开卷" data-paper="${转义(x.试卷)}">继续作答</button></div>`).join('')}`:'';
}
async function 开始数学专项(点){
  if(点)$('#数学知识点').value=点;
  const 条件=数学条件(),学习=当前数学记录();let 池=筛选数学题(库,条件);if($('#数学练习方式').value==='错题')池=池.filter(x=>学习.错题.has(x.题.编号));
  if(!池.length)throw new Error('当前知识点与难度没有可用题目，请调整条件。');
  const 抽题=抽取数学题(池,Number($('#数学题数').value),学习.已练);
  const 题号=抽题.题.map(x=>x.题.编号);
  const 编号='数学专项-'+crypto.randomUUID(),标题=`${条件.知识点==='全部'?'数学综合':条件.知识点} · ${条件.难度==='全部'?'混合难度':条件.难度} · ${条件.档位==='联大'?'联大备考':'题库通用'}`;
  const 卷=组数学专项卷(库,题号,标题,编号);本机.草稿[编号]=新专项进度(卷,条件);本机.草稿[编号].抽题说明=`本组新题 ${抽题.新题数} 道、复习题 ${抽题.复习数} 道。${抽题.复习数?'当前条件未练题不足，已补入复习题。':''}`;await 开卷(编号);
}
let 库,答案,当前卷,练习,只读=false,正在交卷=false,可以保存=true;
let 本机=空专业课存档(),基线=空专业课存档(),当前账户=专业课账户(),保存队列=Promise.resolve(),未保存=0,存档就绪=false;
let 路由恢复=false;
const 筛选字段=['试卷院校','试卷年份','搜索试卷','数学知识点','数学难度','数学档位','数学题源','数学专项院校','数学题数','数学练习方式'];
document.title=显示科目+'在线答题 · 升本练习室';$('#科目标题').textContent=显示科目;
$(`[data-subject="${科目}"]`).setAttribute('aria-current','page');

function 全页错误(文字){const 节点=$('#全页错误');节点.textContent=文字;节点.hidden=false;}
async function 读取本机(){
  本机=await 读取专业课存档(当前账户);基线=structuredClone(本机);存档就绪=true;
}
function 保存提示(){const n=$('#保存提示');if(n)n.textContent=未保存?'正在保存…':可以保存?'已保存到当前浏览器':'保存失败，请重试或导出备份';}
function 保存(){
  if(练习&&!只读&&练习.阶段!=='完成')本机.草稿[练习.试卷]=structuredClone(练习);
  const 快照=structuredClone(本机),原基线=structuredClone(基线);未保存++;保存提示();
  const 任务=保存队列.then(async()=>{
    if(当前账户!==专业课账户())throw new Error('登录账号已变化，请先导出本页备份，再刷新切换账号。');
    if(!存档就绪){await 读取专业课存档(当前账户);存档就绪=true;}
    const 新=await 保存专业课存档(快照,原基线,当前账户);
    基线=structuredClone(新);本机=合并专业课存档(新,本机,快照);
    if(练习&&!只读&&练习.阶段!=='完成'&&本机.草稿[练习.试卷]?.编号===练习.编号)练习=structuredClone(本机.草稿[练习.试卷]);
    可以保存=true;
    if($('#全页错误').dataset.kind==='保存'){$('#全页错误').hidden=true;delete $('#全页错误').dataset.kind;}
    return true;
  }).catch(e=>{可以保存=false;$('#全页错误').dataset.kind='保存';全页错误(e.message+' 可点击“重试保存”或“导出三科备份”。');return false;}).finally(()=>{未保存--;保存提示();});
  保存队列=任务;return 任务;
}
function 设置路由(值){if(路由恢复)return;const h=值?'#'+encodeURIComponent(值):'';if(location.hash!==h)history.pushState(null,'',location.pathname+location.search+h);}
function 渲染副本(){
  $('#存档冲突').innerHTML=(本机.冲突副本||[]).map(x=>`<div class="记录行"><div><strong>保留的作答版本</strong><small>${转义(x.原因)}</small></div><button class="次按钮" data-action="查看副本" data-copy="${转义(x.副本编号)}">查看副本</button></div>`).join('');
}
function 更新地址(){
  const 地址=new URL(location.href);地址.searchParams.set('科目',科目);
  if($('#试卷院校').value==='全部')地址.searchParams.delete('院校');else 地址.searchParams.set('院校',$('#试卷院校').value);
  history.replaceState(null,'',地址);
  document.querySelectorAll('[data-subject]').forEach(a=>{const u=new URL(a.href);if($('#试卷院校').value==='全部')u.searchParams.delete('院校');else u.searchParams.set('院校',$('#试卷院校').value);a.href=u.href;});
}
function 更新年份(){
  const 院校=$('#试卷院校').value;
  const 池=库.试卷.filter(x=>x.科目===科目&&(院校==='全部'||x.院校===院校));
  const 年份=[...new Set(池.filter(x=>x.年份).map(x=>x.年份))].sort((a,b)=>b-a);
  const 有样题=池.some(x=>x.类型==='官方样题');
  const 有复习=池.some(x=>x.类型==='复习题'||x.类型==='教材复习');
  const 有套题=池.some(x=>x.类型==='模拟套题');
  const 有照片=池.some(x=>x.类型==='照片试题');
  $('#试卷年份').innerHTML='<option value="全部">全部试题</option>'+(有套题?'<option value="套题">套题考察（模拟整卷）</option>':'')+年份.map(x=>`<option value="${x}">${x} 年</option>`).join('')+(有样题?'<option value="样题">官方样题（非年度原卷）</option>':'')+(有照片?'<option value="照片">照片整理 / 回忆页</option>':'')+(有复习?'<option value="复习">教材复习（非年度原卷）</option>':'');
}
function 试卷卡(卷){
  const 草稿=本机.草稿[卷.编号],来源=来源地址(卷.来源),原卷=原卷地址(卷.原卷);
  const 修为提示=typeof 专业课预计修为文案==='function'?专业课预计修为文案(卷):'';
  const 完整标=卷.完整性||'';
  const 是套题=卷.类型==='模拟套题';
  const 是完整原卷=['原卷转载','照片试题'].includes(卷.类型) && (!完整标 || /完整/.test(完整标));
  const 资料标=完整标 || (是套题?'套题考察':卷.类型);
  const 整卷按钮=草稿?'继续整卷作答':(是套题?'开始套题考察':(['原卷转载','照片试题','官方样题'].includes(卷.类型)?'整卷开练':'开始答题'));
  return `<article class="试卷卡"><header><div class="资料标签"><span>${转义(卷.院校)}</span><span>${转义(年份说明(卷))}</span><span>${转义(资料标)}</span>${是完整原卷?'<span class="整卷标签">完整原卷</span>':是套题?'<span class="整卷标签">套题考察</span>':完整标&&!是完整原卷?`<span class="整卷标签">${转义(完整标)}</span>`:''}${typeof 专业课奖励上限==='function'?`<span class="修为标签" title="${转义(修为提示)}">完成约 +${专业课奖励上限(卷)} 修为</span>`:''}</div><h2>${转义(卷.名称)}</h2></header><p class="试卷题量">${卷.题目.length} 道题 · ${卷.满分} 分${卷.类型==='复习题'||卷.练习分值?' · 练习分值':''}${修为提示?` · <strong class="修为预告">${转义(修为提示)}</strong>`:''}</p>${卷.来源说明?`<p class="来源说明">${转义(卷.来源说明)}</p>`:''}<p class="整卷提示">按试卷全部题目依次作答；选择题自动判分，填空/计算等可上传截图后点「判分」自动自评。</p><div class="试卷动作"><button class="练习按钮" data-action="开卷" data-paper="${转义(卷.编号)}">${整卷按钮}<span aria-hidden="true"> →</span></button>${原卷?`<a class="首页文字链接" href="${原卷}" target="_blank" rel="noopener noreferrer">${转义(卷.对照名称||'对照原卷')} ↗</a>`:''}${来源?`<a class="首页文字链接" href="${来源}" target="_blank" rel="noopener noreferrer">试题来源 ↗</a>`:''}</div></article>`;
}
function 渲染选卷(){
  const 院校=$('#试卷院校').value,年份=$('#试卷年份').value,关键词=$('#搜索试卷').value.trim().toLowerCase();
  const 同科=库.试卷.filter(x=>x.科目===科目&&x.类型!=='同型练习'),本校=同科.filter(x=>院校==='全部'||x.院校===院校);
  const 匹配=本校.filter(x=>(年份==='全部'||(年份==='套题'&&x.类型==='模拟套题')||(年份==='复习'&&(x.类型==='复习题'||x.类型==='教材复习'))||(年份==='样题'&&x.类型==='官方样题')||(年份==='照片'&&x.类型==='照片试题')||String(x.年份)===年份)&&`${x.院校} ${x.年份||x.文献年份||''} ${x.名称}`.toLowerCase().includes(关键词));
  $('#试卷统计').textContent=`${院校==='全部'?'全部院校':院校} · ${本校.length} 套可作答试题 · ${本校.reduce((n,x)=>n+x.题目.length,0)} 道题 · 当前显示 ${匹配.length} 套`;
  $('#试卷清单').innerHTML=匹配.length?匹配.map(试卷卡).join(''):`<div class="题库空状态"><h2>${本校.length?'没有符合筛选条件的试题':'当前院校暂无已核对的试题'}</h2><p>${本校.length?'请调整年份或关键词。':`尚未找到可公开读取、能核对题目内容的${转义(院校==='全部'?'本类':院校)}${转义(科目)}历年原卷。`}</p></div>`;
  const 其他=本校.length?[]:同科.filter(x=>x.院校!==院校);
  $('#其他院校').hidden=!其他.length;$('#其他院校').innerHTML=其他.length?`<h2>其他院校已收录试题</h2><p>以下试题属于对应院校，可先选择一套练习。</p><div class="资料清单">${其他.map(试卷卡).join('')}</div>`:'';
  const 原卷年份=本校.filter(x=>x.类型==='原卷转载').map(x=>x.年份).sort((a,b)=>a-b);
  const 照片=本校.filter(x=>x.类型==='照片试题');
  $('#年份覆盖').innerHTML=`<h2>历年试题收录情况</h2><p>${转义(院校==='全部'?'当前院校':院校)}${转义(科目)}已录入的原卷转载年份：${原卷年份.length?转义([...new Set(原卷年份)].join('、')):'暂无'}。</p><p>另有 ${照片.length} 套照片整理、${本校.filter(x=>x.类型==='官方样题').length} 套官方样题、${本校.filter(x=>x.类型==='复习题').length} 套教材复习。${照片.some(x=>x.年份===null)?'联大照片只注明讲次，未推断考试年份。':''}考试大纲与同型练习均不计为历年真题。</p><p>未集齐全部年份。</p>`;
  const 记录=本机.记录.flatMap(x=>{try{const v=查卷(x.试卷,x);return v?[{x,v}]:[];}catch{return [];}});
  $('#练习记录').innerHTML=记录.length?记录.map(({x,v})=>`<div class="记录行"><div><strong>${转义(v.名称)}</strong><small>${转义(new Date(x.完成时间).toLocaleString('zh-CN'))}${x.成绩?.含自评?' · 含主观题自评分':''}</small></div><span>${转义(x.成绩?.分数)} / ${v.满分} 分</span><button class="次按钮" data-action="看记录" data-record="${转义(x.编号)}">查看作答</button></div>`).join(''):'<p class="记录空状态">完成一套试题后，成绩会显示在这里。</p>';
  渲染数学入口();渲染副本();
  const 草稿=Object.values(本机.草稿).filter(x=>{try{return 查卷(x.试卷,x);}catch{return false;}});
  $('#继续上次').innerHTML=草稿.length?`<h2>继续上次</h2>${草稿.map(x=>`<button class="次按钮" data-action="开卷" data-paper="${转义(x.试卷)}">${转义(x.数学标题||查卷(x.试卷,x)?.名称)} · 继续</button>`).join('')}`:'<p>选择整卷或知识点，开始今天的练习。</p>';
}
function 定位题目(){const h=$('#题目标题');if(h)h.focus();}
async function 读取答案(){if(!答案){const r=await fetch(科目==='高等数学'?'./数学答案.json':'./C语言答案.json',{cache:'no-cache'});if(!r.ok)throw new Error('参考答案加载失败，请保留作答并重试。');答案=await r.json();}验证专业课答案(当前卷,答案);}
async function 开卷(编号){
  const 卷=查卷(编号);if(!卷)throw new Error('这套试题尚未收录，请重新选择。');
  let 进度=本机.草稿[编号];if(进度){进度=structuredClone(进度);for(const q of 卷.题目)for(const k of ['自评','_ai建议']){const v=进度[k]?.[q.编号];if(v!==undefined&&(!Number.isInteger(v)||v<0||v>q.分值)){进度.恢复前评分={...进度.恢复前评分,[q.编号]:v};delete 进度[k][q.编号];}}验证专业课练习(进度,卷);}else 进度=新建专业课练习(卷);
  当前卷=卷;练习=structuredClone(进度);只读=false;
  if(练习.阶段!=='作答')await 读取答案();
  await 保存();
  if($('#试卷院校').value!==卷.院校){$('#试卷院校').value=卷.院校;更新年份();更新地址();}
  设置路由('试卷/'+编号);
  渲染答题();定位题目();
}
async function 查看记录(编号){
  const r=本机.记录.find(x=>x.编号===编号);if(!r)throw new Error('没有找到这条记录。');
  当前卷=查卷(r.试卷,r);if(!当前卷)throw new Error('当前科目没有这套试题。');
  验证专业课练习(r,当前卷);await 读取答案();练习=structuredClone(r);只读=true;
  设置路由('记录/'+编号);渲染答题();定位题目();
}
function 作答区(q){
  const 已交=练习.阶段!=='作答';
  if(q.题型==='单选')return `<fieldset class="专业课选项"><legend class="辅助文字">选择答案</legend>${q.选项.map((x,i)=>{const 字母='ABCD'[i];return `<label class="专业课选项行"><input type="radio" name="专业课选择" value="${字母}" ${练习.作答[q.编号]===字母?'checked':''} ${已交||只读?'disabled':''}><span class="选项字母">${字母}</span><span>${转义(x)}</span></label>`;}).join('')}</fieldset>`;
  if(已交||只读)return `<div class="我的作答"><h3>我的作答</h3><pre>${转义(练习.作答[q.编号])}</pre></div>`;
  const 文字区=`<label class="主观答案" for="专业课作答">${q.题型==='编程'?'填写 C 语言代码':'填写答案'+(q.题型==='填空'?'':'及解题过程')}</label><textarea id="专业课作答" maxlength="6000" rows="${q.题型==='填空'?3:9}" ${q.题型==='编程'?'class="程序作答" spellcheck="false"':''} placeholder="${q.题型==='编程'?'在这里填写代码':'在这里写下你的答案；也可只上传答题截图'}">${转义(练习.作答[q.编号]||'')}</textarea><p class="保存提示" id="保存提示" role="status" aria-live="polite">${可以保存?'输入后自动保存到当前浏览器':'本次进度未能保存，请保持页面打开'}</p>`;
  return 文字区+(是主观题(q.题型)?专业课AI判题HTML(q,练习,{模式:'作答'}):'');
}
function 答案区(q){
  const a=答案[q.编号],单选=q.题型==='单选',分=单选?(练习.作答[q.编号]===a.正确选项?q.分值:0):练习.自评[q.编号];
  return `<section class="参考解析" aria-label="参考答案与评分"><div class="解析标题"><h3>参考答案</h3>${单选?`<span class="${分?'作答正确':'作答错误'}">${分?'选择正确':'选择错误'} · ${分} / ${q.分值} 分</span>`:''}</div><pre>${转义(a.参考答案)}</pre>${a.数学排版?数学排版HTML(a.数学排版):''}<h3>解题说明</h3><p>${转义(a.解析)}</p>${单选?'':`<h3>自评要点</h3><ul>${a.评分要点.map(x=>`<li>${转义(x)}</li>`).join('')}</ul>${只读?`<p class="自评结果">本题自评分：${分} / ${q.分值} 分</p>`:`<label class="自评选择" for="本题自评">对照要点，给这道题评分<select id="本题自评"><option value="">请选择得分</option>${Array.from({length:q.分值+1},(_,i)=>`<option value="${i}" ${分===i?'selected':''}>${i} / ${q.分值} 分</option>`).join('')}</select></label><p class="自评说明">可手工对照要点评分，或用上方「ChatGPT 判题」粘贴结果自动写入自评分。系统不会直接登录 ChatGPT。</p>`}`}</section>`;
}
function 更新题号(){
  const 未答=new Set(专业课未答题(当前卷,练习));
  document.querySelectorAll('[data-action="跳题"]').forEach(b=>{const i=Number(b.dataset.index),q=当前卷.题目[i];const 完成=练习.阶段==='作答'?!未答.has(i):q.题型==='单选'||Number.isInteger(练习.自评[q.编号]);b.classList.toggle('已作答',完成);b.setAttribute('aria-label',`第 ${i+1} 题，${练习.阶段==='作答'?(完成?'已答':'未答'):(完成?'已评分':'待自评')}`);});
  $('#作答进度').textContent=练习.阶段==='作答'?`已答 ${当前卷.题目.length-未答.size} / ${当前卷.题目.length} 题`:`已评分 ${当前卷.题目.filter(q=>q.题型==='单选'||Number.isInteger(练习.自评[q.编号])).length} / ${当前卷.题目.length} 题`;
}
function 渲染答题(){
  $('#选卷区').hidden=true;$('#答题区').hidden=false;
  const q=当前卷.题目[练习.当前题],已交=练习.阶段!=='作答',总数=当前卷.题目.length;
  const 成绩=练习.阶段==='完成'?专业课评分(当前卷,练习,答案):null;
  const 对照名称=q.题源类别==='照片原题'?'查看原题照片':当前卷.对照名称||'对照原卷';
  const 对照路径=q.原题对照||当前卷.原卷,对照基础=原卷地址(对照路径);
  const 对照链接=对照基础+(对照基础&&q.原卷页?(对照路径.endsWith('.pdf')?'#page=':'#page')+q.原卷页:'');
  const 档位=练习.数学条件?.档位||$('#数学档位').value||'联大';
  const 数学元信息=q.知识点?`<div class="数学题标签"><span>${转义(q.知识点)}</span><span>${转义(题目难度(q,档位))}</span>${q.联大难度&&q.联大难度!==q.难度?`<span>${档位==='联大'?'通用：'+转义(q.难度):'联大：'+转义(q.联大难度)}</span>`:''}${q.题源类别==='同型练习'?'<span>同型练习 · 非历年真题</span>':''}${q.大纲内===false?'<span class="拓展标签">适度超纲</span>':''}</div>`:'';
  const 题目出处=对照基础?`<a href="${对照链接}" target="_blank" rel="noopener noreferrer">${转义(对照名称)}第 ${q.原卷页||''} 页 ↗</a>${q.原题名称?`<span>${转义(q.原题名称)}</span>`:''}`:来源地址(q.原题来源||当前卷.来源)?`<a href="${来源地址(q.原题来源||当前卷.来源)}" target="_blank" rel="noopener noreferrer">查看题目来源 ↗</a>`:'';
  $('#答题区').innerHTML=`<div class="答题页眉"><button class="返回试卷" data-action="返回列表">← 选择其他试卷</button><span class="科目状态">${只读?'作答回顾':已交?'交卷后自评':'正在作答'}</span></div><header class="试卷抬头"><p class="首页眉题">${转义(当前卷.院校)} · ${转义(年份说明(当前卷))}</p><h1>${转义(当前卷.名称)}</h1><p>${总数} 道题 · 满分 ${当前卷.满分} 分 · ${转义(当前卷.类型)}</p><p class="来源说明">${转义(当前卷.来源说明)}</p>${练习.抽题说明?`<p class="题意提示">${转义(练习.抽题说明)}</p>`:''}</header>${成绩?`<section class="成绩卡" aria-label="练习成绩"><div><span>本次成绩</span><strong>${成绩.分数}<small> / ${成绩.满分} 分</small></strong></div><p>选择题 ${成绩.单选得分} 分 · 主观题自评 ${成绩.主观得分} 分<br>含自评分，参考答案为独立推导。</p><button class="次按钮" data-action="重新练习">再练一遍</button></section>`:''}<div class="答题布局"><aside class="答题导航"><h2>题目导航</h2><p id="作答进度" role="status" aria-live="polite"></p><div class="题号网格">${当前卷.题目.map((x,i)=>`<button data-action="跳题" data-index="${i}" ${i===练习.当前题?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><p class="导航说明">绿色表示${已交?'已评分':'已作答'}，深色表示当前题。</p>${只读?'':`<button class="练习按钮 交卷按钮" data-action="交卷">${已交?'完成自评并保存成绩':'交卷并查看解析'}</button>`}<p class="本机提示">进度保存在当前浏览器</p></aside><article class="专业课试题"><div id="答题错误" class="练习错误" role="alert" tabindex="-1" hidden></div><div class="题目元信息"><span>第 ${练习.当前题+1} / ${总数} 题</span><span>${转义(q.题型)} · ${q.分值} 分</span><span>${q.题源类别==='同型练习'?'练习题':'原题'} ${转义(q.题号)}</span></div>${数学元信息}<h2 id="题目标题" tabindex="-1" aria-label="${转义(q.题干)}">${q.数学排版?数学排版HTML(q.数学排版):转义(q.题干)}</h2>${q.超纲说明?`<p class="题意提示">${转义(q.超纲说明)}</p>`:''}${q.代码?`<pre class="题目代码">${转义(q.代码)}</pre>`:''}${q.核对提示?`<p class="题意提示">${转义(q.核对提示)}</p>`:''}${作答区(q)}${已交?答案区(q):''}${已交&&是主观题(q.题型)?专业课AI判题HTML(q,练习,{模式:只读?'只读':'自评',参考答案:答案?.[q.编号]?.参考答案||'',评分要点:答案?.[q.编号]?.评分要点||[]}):''}<div class="题目翻页"><button class="次按钮" data-action="上一题" ${练习.当前题===0?'disabled':''}>← 上一题</button><button class="次按钮" data-action="下一题" ${练习.当前题===总数-1?'disabled':''}>下一题 →</button></div><div class="题目出处">${题目出处}</div></article></div>`;
  更新题号();
  绑定专业课AI判题($('#答题区'),{
    get练习:()=>练习,
    get题目:()=>当前卷.题目[练习.当前题],
    get答案:()=>答案||null,
    get只读:()=>只读,
    保存,
    刷新:()=>{渲染答题();定位题目();}
  });
  const qNow=当前卷.题目[练习.当前题];
  if(练习.阶段==='自评'&&练习._ai建议&&Number.isInteger(练习._ai建议[qNow.编号])&&练习._ai建议[qNow.编号]>=0&&练习._ai建议[qNow.编号]<=qNow.分值&&!Number.isInteger(练习.自评[qNow.编号])){
    练习.自评[qNow.编号]=练习._ai建议[qNow.编号];
    const sel=$('#本题自评');if(sel)sel.value=String(练习.自评[qNow.编号]);
    保存();更新题号();
  }
}
function 答题错误(文字,序号=[]){
  const 区=$('#答题错误');区.innerHTML=`<p>${转义(文字)}</p>${序号.length?`<div class="错误题号">${序号.map(i=>`<button class="次按钮" data-action="跳题" data-index="${i}">第 ${i+1} 题</button>`).join('')}</div>`:''}`;区.hidden=false;区.focus();
}
async function 交卷(){
  if(只读||正在交卷)return;
  if(练习.阶段==='作答'){
    const 未答=专业课未答题(当前卷,练习);if(未答.length){答题错误(`还有 ${未答.length} 道题未作答，请先完成以下题目。`,未答);return;}
    正在交卷=true;const b=$('[data-action="交卷"]');b.disabled=true;b.textContent='正在加载解析…';
    try{await 读取答案();练习.阶段='自评';练习.交卷时间=Date.now();练习.当前题=当前卷.题目.findIndex(q=>q.题型!=='单选');if(练习.当前题<0)练习.当前题=0;保存();渲染答题();定位题目();}
    catch(e){答题错误(e.message);b.disabled=false;b.textContent='交卷并查看解析';}
    finally{正在交卷=false;}
    return;
  }
  const 未评=当前卷.题目.flatMap((q,i)=>q.题型!=='单选'&&!Number.isInteger(练习.自评[q.编号])?[i]:[]);
  if(未评.length){答题错误(`还有 ${未评.length} 道主观题未自评，请对照参考答案选择得分。`,未评);return;}
  const 成绩=专业课评分(当前卷,练习,答案);练习.阶段='完成';练习.完成时间=Date.now();练习.成绩=成绩;
  delete 本机.草稿[练习.试卷];本机.记录.unshift(structuredClone(练习));await 保存();只读=true;设置路由('记录/'+练习.编号);渲染答题();$('.成绩卡').scrollIntoView({block:'start'});
}
$('#试卷筛选').addEventListener('submit',e=>e.preventDefault());
$('#试卷院校').addEventListener('change',()=>{更新年份();更新地址();渲染选卷();});
$('#试卷年份').addEventListener('change',渲染选卷);$('#搜索试卷').addEventListener('input',渲染选卷);
$('#数学专项筛选').addEventListener('change',渲染数学入口);
$('#数学专项筛选').addEventListener('submit',async e=>{e.preventDefault();try{await 开始数学专项();}catch(错误){全页错误(错误.message);}});
$('#答题区').addEventListener('input',e=>{
  if(!练习||只读)return;const q=当前卷.题目[练习.当前题];
  if(e.target.id==='专业课作答'&&练习.阶段==='作答'){练习.作答[q.编号]=e.target.value;保存();更新题号();保存提示();}
});
$('#答题区').addEventListener('change',e=>{
  if(!练习||只读)return;const q=当前卷.题目[练习.当前题];
  if(e.target.name==='专业课选择'&&练习.阶段==='作答')练习.作答[q.编号]=e.target.value;
  else if(e.target.id==='本题自评'&&练习.阶段==='自评'){if(e.target.value==='')delete 练习.自评[q.编号];else 练习.自评[q.编号]=Number(e.target.value);}
  else return;
  保存();更新题号();
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
  try{
    switch(b.dataset.action){
      case '清理截图':await 保存队列;$('#备份状态').textContent='已清理 '+await 清理闲置截图()+' 张未被任何存档引用的截图。';break;
      case '重试保存':await 保存();break;
      case '导出备份':await 保存队列;下载学习备份(await 读取英语备份(),本机);$('#备份状态').textContent='三科备份已导出，包含答题截图和冲突副本。';break;
      case '导入备份':$('#专业课导入').click();break;
      case '查看副本':{const v=本机.冲突副本.find(x=>x.副本编号===b.dataset.copy);if(!v)throw new Error('副本不存在。');当前卷=查卷(v.练习.试卷,v.练习);if(!当前卷)throw new Error('该副本的试题暂未收录，内容仍包含在备份中。');练习=structuredClone(v.练习);只读=true;if(练习.阶段!=='作答')await 读取答案();设置路由('副本/'+v.副本编号);渲染答题();定位题目();break;}
      case '套题轮刷':{const 下一=typeof 下一套题编号==='function'?下一套题编号():'';if(下一){await 开卷(下一);}break;}
      case '开卷':await 开卷(b.dataset.paper);break;
      case '考点刷题':await 开始数学专项(b.dataset.point);break;
      case '返回列表':保存();$('#选卷区').hidden=false;$('#答题区').hidden=true;设置路由('');渲染选卷();$('#科目标题').setAttribute('tabindex','-1');$('#科目标题').focus();break;
      case '跳题':case '上一题':case '下一题':练习.当前题=b.dataset.action==='跳题'?Number(b.dataset.index):练习.当前题+(b.dataset.action==='上一题'?-1:1);保存();渲染答题();定位题目();break;
      case '交卷':await 交卷();break;
      case '重新练习':if(当前卷.编号.startsWith('数学专项-')){const 条件=练习.数学条件;当前卷=组数学专项卷(库,练习.数学题号,练习.数学标题,'数学专项-'+crypto.randomUUID());练习=新专项进度(当前卷,条件);}else{if(本机.草稿[当前卷.编号]&&!confirm('这套试题还有一次未完成的作答，重新练习会替换该进度。继续吗？'))return;练习=新建专业课练习(当前卷);}只读=false;保存();设置路由('试卷/'+当前卷.编号);渲染答题();定位题目();break;
      case '看记录':await 查看记录(b.dataset.record);break;
    }
  }catch(错误){全页错误(错误.message);$('#全页错误').focus();}
});
try{
  if(!document.离线地址){
    await 初始化认证();
    if(!是否已登录()){
      sessionStorage.setItem('登录后科目', './科目资料.html' + location.search + location.hash);
      location.replace('./login.html');
      throw new Error('请先登录后再练习专业课。');
    }
    const 用户=获取当前用户();
    const 名槽=document.querySelector('#首页用户名');
    if(名槽){名槽.textContent=用户?.名称?.trim()||(用户?.手机号?`学员 ${用户.手机号.slice(-4)}`:'已登录');}
  }
  const r=await fetch(科目==='高等数学'?'./数学题库.json':'./C语言题库.json',{cache:'no-cache'});if(!r.ok)throw new Error('题库加载失败，请刷新后重试。');库=验证专业课题库(await r.json());await 读取本机();
  $('#试卷院校').innerHTML+=库.院校.map(x=>`<option value="${转义(x)}">${转义(x)}题目</option>`).join('');
  设置数学入口();
  const 请求院校=参数.get('院校');$('#试卷院校').value=库.院校.includes(请求院校)?请求院校:'北京联合大学';更新年份();恢复筛选();更新地址();渲染选卷();
  设置套题考察();
  await 恢复路由();
}catch(错误){全页错误(错误.message);$('#试卷统计').textContent='题库暂时无法打开。';}

async function 恢复路由(){
  if(!库)return;路由恢复=true;
  try{
    const 路由=decodeURIComponent(location.hash.slice(1));
    if(路由.startsWith('试卷/'))await 开卷(路由.slice(3));
    else if(路由.startsWith('记录/'))await 查看记录(路由.slice(3));
    else if(路由.startsWith('副本/')){const v=本机.冲突副本.find(x=>x.副本编号===路由.slice(3));if(v){当前卷=查卷(v.练习.试卷,v.练习);练习=structuredClone(v.练习);只读=true;if(练习.阶段!=='作答')await 读取答案();渲染答题();}}
    else{$('#选卷区').hidden=false;$('#答题区').hidden=true;渲染选卷();}
  }finally{路由恢复=false;}
}
window.addEventListener('popstate',()=>恢复路由().catch(e=>全页错误(e.message)));
window.addEventListener('hashchange',()=>恢复路由().catch(e=>全页错误(e.message)));
window.addEventListener('beforeunload',e=>{if(未保存||!可以保存){e.preventDefault();e.returnValue='';}});
async function 刷新外部存档(){
  if(!库||!存档就绪)return;await 保存队列;
  if(专业课账户()!==当前账户){全页错误('账号已切换，请先导出本页备份后刷新。');return;}
  if(!可以保存)return;
  本机=await 读取专业课存档(当前账户);基线=structuredClone(本机);
  if(练习&&!只读){const 新=本机.草稿[练习.试卷]||本机.记录.find(x=>x.编号===练习.编号);if(新?.编号===练习.编号){练习=structuredClone(新);if(练习.阶段!=='作答')await 读取答案();if(练习.阶段==='完成')只读=true;渲染答题();}}
  if(!$('#选卷区').hidden)渲染选卷();
}
window.addEventListener('storage',e=>{if(e.key==='升本练习室_专业课更新_'+当前账户||e.key==='升本练习室_当前用户'||e.key==='升本练习室_专业课进度_'+当前账户)刷新外部存档().catch(e=>全页错误(e.message));});
window.addEventListener('focus',()=>刷新外部存档().catch(e=>全页错误(e.message)));
$('#专业课导入').addEventListener('change',async e=>{
 try{
  const f=e.target.files?.[0];if(!f)return;if(f.size>100000000)throw new Error('备份超过100MB，请分次恢复。');
  const v=JSON.parse(await f.text());if(v.应用&&v.应用!=='升本练习室')throw new Error('这不是升本练习室的备份。');
  const 专=v.专业课||(v.版本===1&&!Array.isArray(v.收藏)&&v.草稿&&v.记录?v:null),英=v.存档||([1,2,3].includes(v.版本)&&Array.isArray(v.收藏)?v:null);
  if(!专&&!英)throw new Error('未找到可恢复的学习存档。');
  if(专){校验专业课存档(专);const r=await fetch('./专业课题库.json',{cache:'no-cache'});if(!r.ok)throw new Error('导入校验题库加载失败。');const 全库=验证专业课题库(await r.json());验证专业课备份(全库,专);}
  if(英)await 校验英语备份(英);
  if(!confirm('将合并这份备份。已有成绩保留，冲突的作答保留副本。继续吗？'))return;
  await 保存队列;
  if(专){本机=await 保存专业课存档(专业课备份内容(专),空专业课存档(),当前账户,'导入-'+crypto.randomUUID());基线=structuredClone(本机);}
  if(英)await 导入英语备份(英);
  $('#备份状态').textContent='备份已合并；数学与C语言已保存本机，英语下次进入练习室时同步。';渲染选卷();
 }catch(e){全页错误(e.message);}finally{e.target.value='';}
});

function 记住筛选(){try{sessionStorage.setItem('科目筛选_'+当前账户+'_'+科目,JSON.stringify(Object.fromEntries(筛选字段.map(id=>[id,$('#'+id).value]))));}catch{}}
function 恢复筛选(){
 try{
  const s=JSON.parse(sessionStorage.getItem('科目筛选_'+当前账户+'_'+科目)||'{}');
  for(const id of ['试卷院校',...Object.keys(s).filter(x=>x!=='试卷院校')]){
   if(!筛选字段.includes(id)||typeof s[id]!=='string')continue;if(id==='试卷院校'&&参数.has('院校'))continue;
   const el=$('#'+id);if(el.tagName==='SELECT'&&![...el.querySelectorAll('option')].some(x=>x.value===s[id]))continue;el.value=s[id].slice(0,100);if(id==='试卷院校')更新年份();
  }
 }catch{}
}
document.addEventListener('change',e=>{if(筛选字段.includes(e.target.id))记住筛选();});
$('#搜索试卷').addEventListener('input',记住筛选);

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')刷新外部存档().catch(e=>全页错误(e.message));});
