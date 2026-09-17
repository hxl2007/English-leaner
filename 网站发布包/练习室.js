import {打开存档,读取,更新,总金币,累计修为,等待云端同步,获取同步状态,同步存档} from './数据.js';
import {模块列表,奖励规则,修为等级,修为信息,兑换物品,生成练习,检查库存,可抽内容,建立题库索引,补齐旧练习,通用评分,题目分值,未答题,验证练习,新编号} from './组卷.js';
import {初始化认证,是否已登录,获取当前用户,退出登录,是管理员,获取所有用户,更新用户状态,管理员手机号,获取管理日志,修改账户密码,退出其他设备,注销当前账户} from './认证.js';

import {读取选区,绘制标记} from './文章标记.js';
import {复习计划,生成每日复习,合并练习记录} from './每日复习.js';
import {对照解析} from './学习解析.js';
import {商品状态,合并境界小段} from './修行商城.js';
import {应用显示设置,保存显示设置,显示设置控件} from './学习设置.js';
import {单选知识点,阅读知识点,专项库存,生成专项,计算学习报告} from './专项训练.js';
import {考试时长,设置考试,考试剩余,已到考试时间,锁定试卷} from './考试模式.js';
import {反馈按钮,反馈页面,反馈动作,提交反馈表单} from './题目反馈.js';
let 组卷模式='练习',待专项=null,到时处理中=false;
let 商城境界='',管理操作=[],管理日志页=0,管理日志错误='';
let 文章选区=null,面板收起=false,面板观察器,上次同步检查=0;
const 根=document.querySelector('#应用'),弹窗=document.querySelector('#对话框'),字母=['A','B','C','D'];
const 主题列表=[['青绿','清爽青绿'],['夜间','夜间深色'],['靛蓝','安静靛蓝'],['暖橙','温暖暖橙']];
const 转义=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const 图标=x=>`<i data-lucide="${x}" aria-hidden="true"></i>`;
const 数值=n=>Number(n.toFixed(2));
const 时长=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const 日期=n=>new Date(n).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const 路由=()=>decodeURIComponent(location.hash.slice(1)||'主页').split('/');
const 导航=x=>{location.hash=encodeURI(x);};
let 管理员已加载=false,管理员加载中=false,管理员错误='';
let 题库,索引,存档,答案,管理员用户=[],当前题=0,忙=false,只看错题=false,渲染序=0,提示计时,待开始,待导入,写入队列=Promise.resolve(),操作队列=Promise.resolve(),主题=localStorage.getItem('升本练习室主题')||'青绿';
const 菜单=[['主页','layout-dashboard','学习主页'],['选择题','list-checks','选择题练习'],['阅读理解','book-open','阅读理解'],['单块模拟题','notebook-pen','单块模拟题'],['全套卷子模拟题','files','全套卷子模拟题'],['知识点专项','target','知识点专项'],['每日复习','calendar-check','每日复习'],['错题本','book-open-check','我的错题'],['记录','chart-no-axes-combined','练习记录'],['修为','award','修为与金币'],['设置','settings-2','学习存档']];
function 提示(文字){const el=document.querySelector('#提示');el.textContent=文字;el.classList.add('显示');clearTimeout(提示计时);提示计时=setTimeout(()=>el.classList.remove('显示'),4000);}
function 应用主题(){应用显示设置();if(!主题列表.some(([id])=>id===主题))主题='青绿';document.documentElement.dataset.主题=主题;}
function 可用金币(){return Math.max(0,总金币(存档)-(Number(存档.消费金币)||0));}
function 当前小段(s=存档){const 期=修为信息(累计修为(s)).当前.名称;return Math.max(1,Math.min(9,Number(s.境界小段?.[期])||(!s.境界小段?Number(s.小段):1)||1));}
function 当前战力(){const 修为=修为信息(累计修为(存档)),境界战力=修为等级.findIndex(x=>x.名称===修为.当前.名称)*100;const 物品战力=Object.entries(存档.背包||{}).reduce((n,[id,数量])=>n+(兑换物品.find(x=>x.编号===id)?.战力||0)*Number(数量||0),0);return 境界战力+(当前小段()-1)*10+物品战力;}
function 错误提示(e){console.error(e);提示(e.message||'操作失败，请重试。');}
function 确认(标题,正文,行为,按钮='确定'){弹窗.innerHTML=`<h2>${转义(标题)}</h2><p>${转义(正文)}</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">取消</button><button class="按钮" data-action="${行为}">${转义(按钮)}</button></div>`;if(!弹窗.open)弹窗.showModal();}
function 页头(标题,说明='',右=''){return `<div class="页头"><div><h1>${转义(标题)}</h1>${说明?`<p class="副标题">${转义(说明)}</p>`:''}</div>${右}</div>`;}
async function 载入答案(){if(!答案){const r=await fetch('./答案.json',{cache:'no-cache'});if(!r.ok)throw new Error('答案加载失败，请检查网络。');答案=await r.json();for(const q of 题库.题目){const a=答案[q.编号];if(a?.正确选项&&q.选项)a.选项文本=a.正确选项.map(x=>q.选项[字母.indexOf(x)]);}}return 答案;}
function 外壳(内容,页){
  const 修为=修为信息(累计修为(存档)),激活=['练习','结果'].includes(页)?(当前练习()?.题源==='原创'?'单块模拟题':当前练习()?.模块==='阅读'?'阅读理解':'选择题'):页;
  const 原文章=根.querySelector('#文章正文')?.dataset.passage,滚动位置=window.scrollY;
  根.innerHTML=`<div class="壳"><aside class="侧栏"><a class="标识" href="#主页"><img src="./学习图标.png" alt=""><div><strong>升本练习室</strong><small>专升本 · 英语</small></div></a><nav class="导航">${菜单.map(([url,icon,name])=>`<a href="#${url}" class="${激活===url?'选中':''}" ${激活===url?'aria-current="page"':''}>${图标(icon)}<span>${name}</span></a>`).join('')}</nav><a class="侧栏底部" href="#设置">${图标('database-backup')} 学习存档 · <span data-sync-state></span></a></aside><div class="主区"><header class="顶栏"><div class="面包屑"><span>我的学习空间</span>${图标('chevron-right')}<strong>${转义(页==='结果'?'答题报告':页)}</strong></div><div class="顶栏右"><a class="修为徽记" href="#修为">${图标('award')}${修为.当前.名称}</a><a class="战力徽记" href="#兑换" title="当前战力">${图标('swords')}${当前战力()} 战力</a><a class="金币" href="#兑换" aria-label="可用金币 ${可用金币()}">${图标('coins')}<strong>${可用金币()}</strong><span>金币</span></a><a class="图标按钮" href="#设置" aria-label="学习存档" title="学习存档">${图标('settings-2')}</a></div></header><main class="内容" id="主内容">${内容}</main></div><nav class="手机导航" aria-label="移动导航">${[['主页','layout-dashboard','主页'],['选择题','list-checks','原题'],['单块模拟题','notebook-pen','单块'],['全套卷子模拟题','files','整卷'],['修为','award','修为'],['设置','settings-2','存档']].map(([url,icon,name])=>`<a href="#${url}" class="${激活===url?'选中':''}" aria-label="${name}">${图标(icon)}<span>${name}</span></a>`).join('')}</nav></div>`;
  globalThis.lucide?.createIcons();
  if(页==='设置'&&是管理员()&&!管理员已加载&&!管理员加载中)刷新管理员();
  const 面板=根.querySelector('.阅读答题窗'),文章=根.querySelector('#文章正文');
  document.body.classList.toggle('文章练习中',!!面板);
  面板观察器?.disconnect();
  if(面板){面板.classList.toggle('已收起',面板收起);面板观察器=new ResizeObserver(()=>document.documentElement.style.setProperty('--答题窗高度',面板.getBoundingClientRect().height+'px'));面板观察器.observe(面板);}
  if(文章){绘制标记(文章,当前练习()?.文章标记?.[文章.dataset.passage]);if(原文章===文章.dataset.passage)window.scrollTo(0,滚动位置);}
  文章选区=null;刷新同步显示();
}
async function 刷新管理员(){if(管理员加载中)return;管理员加载中=true;管理员错误='';try{管理员用户=await 获取所有用户();await 刷新日志();}catch(e){管理员错误=e.message;}finally{管理员已加载=true;管理员加载中=false;if(路由()[0]==='设置')await 渲染();}}
function 刷新同步显示(){const s=获取同步状态();document.querySelectorAll('[data-sync-state]').forEach(el=>{el.textContent=s.状态;el.dataset.state=s.状态;el.title=s.说明;});document.querySelectorAll('[data-sync-detail]').forEach(el=>el.textContent=s.说明);}
window.addEventListener('同步状态变化',刷新同步显示);
function 当前练习(){const [页,id]=路由();return 页==='结果'?存档.记录.find(r=>r.编号===id):存档.草稿;}
function 继续条(){const c=存档.草稿;return c?`<div class="继续条"><div><p>${转义(c.名称)}</p><small>${c.阶段==='自评'?'翻译自评中':`已作答 ${c.题目编号.length-未答题(c).length} / ${c.题目编号.length}`}</small></div><a class="按钮 小" href="#练习">继续练习 ${图标('arrow-right')}</a></div>`:'';}
function 原题入口(){return `<div class="分类网格">${[['选择题','单选','list-checks'],['阅读理解','阅读','book-open'],['完形填空','完形','text-cursor-input'],['翻译','翻译','languages']].map(([名,类型,icon])=>{const n=可抽内容(题库,'原题')[类型].length;return `<a class="分类项 ${n?'主分类':''}" href="#${名}"><div class="分类图标">${图标(icon)}</div><span class="分类箭头">${n?图标('arrow-up-right'):'<span class="徽标 灰">待补充</span>'}</span><h3>${名}</h3><p>${n?`${n} ${['阅读','完形'].includes(类型)?'篇':'道'}原题`:'等待题目照片'}</p></a>`;}).join('')}</div>`;}
function 主页(){
  const 总题=存档.记录.reduce((n,r)=>n+r.题目编号.length,0),对=存档.记录.reduce((n,r)=>n+r.对错.filter(Boolean).length,0),修为=修为信息(累计修为(存档));
  const 指标=[['clipboard-check','累计答题',总题,'道'],['target','答题正确率',总题?Math.round(对/总题*100):0,'%'],['layers','完成练习',存档.记录.length,'次'],['coins','累计金币',总金币(存档),'枚']];
  const 用户=获取当前用户();
  return `<section class="学习欢迎"><div><p class="首页问候">你好，${转义(用户?.名称||'学习者')}</p><h1>把每一题，学明白。</h1><p>从一次练习开始，给每一个进步留下记录。</p><a class="按钮" href="${存档.草稿?'#练习':'#选择题'}">${存档.草稿?'继续上次练习':'开始今天的练习'} ${图标('arrow-right')}</a></div><div class="欢迎书签"><span>${修为.当前.名称}</span>${图标('book-open')}<strong>日积一题，学有所成</strong><a href="#记录">查看学习足迹</a></div></section><section class="概况">${指标.map(([图,名,值,单位])=>`<div class="指标"><div class="指标标题">${图标(图)}${名}</div><div class="指标值">${值}<small>${单位}</small></div></div>`).join('')}</section>${继续条()}${复习任务条()}<section><div class="分区头"><h2>原题练习</h2><a class="按钮 轻 小" href="#错题本">错题与收藏 ${图标('arrow-right')}</a></div>${原题入口()}</section><section class="专项入口"><div><h2>知识点专项训练</h2><p>时态、非谓语、从句、虚拟语气；阅读细节、推断、主旨与词义。</p></div><a class="按钮 次要" href="#知识点专项">选择专项</a></section><section><div class="分区头"><h2>模拟考场</h2><a class="按钮 轻 小" href="#记录">练习记录 ${图标('arrow-right')}</a></div><div class="模拟入口"><a href="#单块模拟题"><div>${图标('notebook-pen')}<h3>单块模拟题</h3></div><p>单选 · 阅读 · 完形 · 翻译</p><strong>每次抽取未练原创题 ${图标('arrow-right')}</strong></a><a href="#全套卷子模拟题"><div>${图标('files')}<h3>全套卷子模拟题</h3></div><p>四个模块 · 不含作文</p><strong>原题 / 原创 ${图标('arrow-right')}</strong></a></div></section><section class="成长横栏"><img src="./题库封面.jpg" alt="本次练习使用的纸质教材"><div><span class="徽标">${修为.当前.名称}</span><h2>${修为.下一?`距离${修为.下一.名称}还差 ${修为.下一.金币-累计修为(存档)} 修为`:'已达大乘期'}</h2><div class="进度条"><div style="width:${修为.进度}%"></div></div></div><a class="按钮 次要" href="#修为">修为进度 ${图标('arrow-right')}</a></section>`;
}
function 复习任务条(){const p=复习计划(题库,存档);return `<section class="每日任务"><div><span class="徽标">每日复习</span><h2>${p.已完成?'今天的错题已复习':p.到期?`今天巩固 ${p.题目.length} 道错题`:'今天暂无到期错题'}</h2><p>${p.已完成?`答对 ${p.已完成.对错.filter(Boolean).length} 道，已获得 ${p.已完成.金币} 金币。`:p.到期?'每答对1题获得1金币与1点修为，每天仅结算一次。':'完成练习后，错题会按掌握情况安排复习。'}</p></div><a class="按钮 次要" href="#每日复习">${p.已完成?'查看复习结果':'查看今日任务'}</a></section>`;}
function 每日复习页(){const p=复习计划(题库,存档);return `${页头('每日错题复习','按北京时间每天一份任务，最多10道。答对后按1、3、7、14、30天安排巩固。')}${继续条()}${复习任务条()}${p.已完成?`<a class="按钮" href="#结果/${p.已完成.编号}">查看今天的复习解析</a>`:p.题目.length?`<div class="复习题目预览">${p.题目.map((q,i)=>`<p><span class="徽标">${q.题型}</span> 第 ${i+1} 题 · ${转义(q.来源)}</p>`).join('')}</div><button class="按钮" data-action="开始复习">开始复习 ${p.题目.length} 道题</button>`:'<p class="副标题">已停止抽取的旧版题不会再进入每日复习。你可以继续原题练习或查看错题本。</p>'}`;}
function 组卷项(题源,模块){
  const 检=检查库存(题库,题源,模块,存档.已抽原创||[]),规则={单选:'25 道题',阅读:'3 篇完整阅读',完形:'1 篇 · 20 个空',翻译:'5 道翻译',整卷:'25 单选 · 20 空完形 · 5 翻译 · 3 篇阅读'};
  const 图={单选:'list-checks',阅读:'book-open',完形:'text-cursor-input',翻译:'languages',整卷:'files'}[模块];
  return `<article class="套题项"><div class="套题项头"><h3>${图标(图)}${模块==='整卷'?`${题源}整卷`:模块==='单选'?'单项选择':模块==='完形'?'完形填空':模块==='阅读'?'阅读理解':'翻译'}</h3><span class="徽标 ${检.可开始?'':'灰'}">${检.可开始?'可练习':'待补充'}</span></div><p class="套题来源">${规则[模块]}</p><div class="套题信息"><span>满分 ${模块==='整卷'?85:100} 分</span><span class="对">最高 ${奖励规则[模块]} 金币</span></div><p class="库存说明">${模块==='整卷'?模块列表.map(k=>`${k} ${检.库存[k].length}`).join(' · '):`${题源==='原创'?'剩余未抽':'可用原题'} ${检.库存[模块].length} ${['阅读','完形'].includes(模块)?'篇':'道'}`}</p>${检.缺少.length?`<p class="警告">${题源==='原创'?'未抽题量不足：':'原题尚未补齐：'}${检.缺少.join('、')}</p>`:''}<div class="套题项脚"><span class="副标题">${题源==='原创'?'原创题库':'照片原题'}</span><button class="按钮 小" data-action="开始" data-source="${题源}" data-module="${模块}" ${检.可开始?'':'disabled'}>随机组卷 ${图标('shuffle')}</button></div></article>`;
}
function 专项页(){
 const 类型=路由()[1]==='阅读'?'阅读':'单选',点=类型==='单选'?单选知识点:阅读知识点;
 return `${页头('知识点专项','按弱项选择练习。单选最多25题，阅读最多3篇，只抽取对应知识点的小题。')}${继续条()}<div class="分段"><a href="#知识点专项/单选" class="${类型==='单选'?'当前':''}">单选知识点</a><a href="#知识点专项/阅读" class="${类型==='阅读'?'当前':''}">阅读知识点</a></div><div class="专项网格">${点.map(知识点=>{const 量=专项库存(题库,类型,知识点).length;return `<article class="专项卡"><h2>${知识点}</h2><p>${量} ${类型==='单选'?'道题':'篇相关原文'}可练习</p><small>${类型==='单选'?`每套 ${Math.min(25,量)} 题`:`每套 ${Math.min(3,量)} 篇，仅练本类题目`} · 满分100分</small><button class="按钮 次要" data-action="开始专项" data-type="${类型}" data-topic="${知识点}" ${量?'':'disabled'}>开始专项</button></article>`;}).join('')}</div><p class="副标题">专项用于针对性复习，会从原题和原创的可用题目中随机抽取，可以重复练习；每答对一题获得1金币与1点修为。</p>`;
}
async function 开始专项(类型,知识点,强制=false){
 if(忙)return;await 写入队列;
 if(存档.草稿&&!强制){待专项={类型,知识点};确认('开始知识点专项？','当前草稿将被替换，已提交记录保留。','替换专项','开始专项');return;}
 忙=true;try{存档=await 更新(s=>({...s,草稿:生成专项(题库,类型,知识点)}));当前题=0;导航('练习');await 渲染();}finally{忙=false;}
}
function 学习报告区(){
 const r=计算学习报告(题库,存档);
 return `<section class="学习报告"><div class="分区头"><div><h2>我的学习报告</h2><p class="副标题">近30天，根据实际作答统计</p></div><a class="按钮 次要 小" href="#每日复习">复习到期错题</a></div><div class="报告指标"><div><strong>${r.正确率===null?'—':r.正确率+'%'}</strong><span>答题正确率</span></div><div><strong>${r.总题}</strong><span>累计作答题数</span></div><div><strong>${r.平均每题秒===null?'—':r.平均每题秒+'秒'}</strong><span>平均每题用时</span></div><div><strong>${r.平均每套秒===null?'—':时长(r.平均每套秒)}</strong><span>平均每套用时</span></div></div><p class="学习建议">${转义(r.建议)}</p>${r.薄弱.length?`<div class="薄弱列表">${r.薄弱.map(x=>`<div><strong>${x.知识点}</strong><span>答错 ${x.错误} / ${x.次数} 次</span>${['单选','阅读'].includes(x.类型)?`<button class="按钮 轻 小" data-action="开始专项" data-type="${x.类型}" data-topic="${转义(x.知识点)}">练习此知识点</button>`:'<a class="按钮 轻 小" href="#每日复习">复习错题</a>'}</div>`).join('')}</div>`:''}<small class="副标题">平均用时按试卷总用时分摊，含翻译自评；单题停留时间不单独追踪。</small></section>`;
}
function 原题页(模块){const 名={单选:'选择题练习',阅读:'阅读理解',完形:'完形填空',翻译:'翻译'}[模块];return `${页头(名,模块==='阅读'?'随机抽取 3 篇完整文章，文章与小题始终对应。':模块==='单选'?'从原题库随机抽取 25 道，满分 100 分。':'照片原题练习')}${继续条()}<div class="分段 原题切换">${[['选择题','单选'],['阅读理解','阅读'],['完形填空','完形'],['翻译','翻译']].map(([url,k])=>`<a class="${模块===k?'当前':''}" href="#${url}">${url}</a>`).join('')}</div><div class="套题列表 单模块">${组卷项('原题',模块)}</div>`;}
function 模拟页(整卷=false){return `${页头(整卷?'全套卷子模拟题':'单块模拟题',整卷?'单选 25 分 · 完形 10 分 · 阅读 30 分 · 翻译 20 分 · 不含作文':'原创题库随机抽题，已抽过的题不会再次作为新题抽取。')}${继续条()}${整卷?`<section class="考试入口"><div><h2>选择答题方式</h2><p>考试限时70分钟，10分钟、5分钟、1分钟时提醒，到时锁定作答。</p></div><div class="分段"><button data-action="组卷模式" data-value="练习" class="${组卷模式==='练习'?'当前':''}">练习模式</button><button data-action="组卷模式" data-value="考试" class="${组卷模式==='考试'?'当前':''}">70分钟考试</button></div></section>`:''}<div class="套题列表">${整卷?['原题','原创'].map(s=>组卷项(s,'整卷')).join(''):模块列表.map(m=>组卷项('原创',m)).join('')}</div>${整卷?'<p class="副标题">翻译完成后对照参考答案和评分要点自评，计入整卷总分。</p>':''}`;}
function 显示字母(c,id,原字){return 字母[(c.选项顺序?.[id]||[0,1,2,3]).indexOf(字母.indexOf(原字))];}
function 篇章内容(p){
  const 表格=p.表格?`<div class="文章表格"><table>${p.表格.列?`<thead><tr>${p.表格.列.map(x=>`<th>${转义(x)}</th>`).join('')}</tr></thead>`:''}<tbody>${p.表格.行.map(row=>`<tr>${row.map(x=>`<td>${转义(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  return p.段落.map((s,i)=>`${i===(p.表格位置??1)?表格:''}<p>${转义(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\{\{(\d+)\}\}/g,'<button class="完形空" data-action="定位空" data-blank="$1" aria-label="作答第 $1 空">($1) ____</button>')}</p>`).join('')+(p.表格位置===p.段落.length?表格:'');
}
function 解析内容(c,q,a,i){
  if(q.题型==='翻译')return `<div class="答案对照"><span>你的译文</span></div><p class="译文">${转义(c.作答[q.编号])}</p><p class="对"><strong>参考译文</strong></p><p class="译文">${转义(a.参考答案)}</p><ol class="评分要点">${a.评分要点.map(x=>`<li>${转义(x)}</li>`).join('')}</ol><p>${转义(a.解析)}</p>`;
  return `<div class="答案对照"><span class="${c.对错?.[i]?'对':'错'}">你的答案：<strong>${显示字母(c,q.编号,c.作答[q.编号])||'未作答'}</strong></span><span class="对">${q.可抽取===false?'原卷参考（待核）':'正确答案'}：<strong>${a.正确选项.map(x=>显示字母(c,q.编号,x)).join(' 或 ')}</strong></span></div>${学习解析区(c,q,a)}`;
}
function 学习解析区(c,q,a){
 const p=q.篇章?索引.篇章.get(q.篇章):null,d=对照解析(q,a,p,答案);
 const 换标=文本=>String(文本).replace(/(?<![a-zA-Z])([A-D])(?=\s*(?:[、，]|项|与|不|未|错|对|为|是|则|中|的|和))/g,(_,a)=>显示字母(c,q.编号,a));
 const 引文标记=文本=>{let 位置=[];for(const 引 of d.引用){let i=文本.toLowerCase().indexOf(引.toLowerCase());if(i>=0)位置.push([i,i+引.length]);}位置.sort((a,b)=>a[0]-b[0]);let last=0,html='';for(const [a,b] of 位置){if(a<last)continue;html+=转义(文本.slice(last,a))+'<mark class="原文证据">'+转义(文本.slice(a,b))+'</mark>';last=b;}return html+转义(文本.slice(last));};
 return `<div class="学习解析"><span class="徽标">${转义(a.考点)}</span><h4>作答依据</h4><p>${转义(换标(d.依据))}</p>${d.引文.length?`<details class="原文核对" open><summary>${q.题型==='完形'?'上下文联系（答案代回原文）':'核对原文与解析'}</summary>${d.引文.map(x=>`<p class="参考提示">第 ${x.段} 段</p><blockquote lang="en">${引文标记(x.文本)}</blockquote>`).join('')}${p?.表格?`<p class="参考提示">本篇另含表格，请同时核对上方原文表格。</p>`:''}</details>`:''}<details open><summary>逐项对照</summary>${(c.选项顺序?.[q.编号]||[0,1,2,3]).map(i=>{const x=d.选项[i];return `<div class="解析选项"><strong class="${x.正确?'对':''}">${显示字母(c,q.编号,x.原字母)}. ${转义(x.文本)} ${x.正确?'✓':''}</strong><p>${转义(换标(x.理由))}</p>${x.代入?`<p class="代入句" lang="en">${转义(x.代入)}</p>`:''}</div>`;}).join('')}</details></div>`;
}
function 答题卡(c,记录){
  const 数=c.题目编号.length-未答题(c).length,总=c.题目编号.length;
  return `<aside class="答题卡"><h3>答题卡 <small>${数} / ${总}</small></h3><div class="进度条"><div style="width:${数/总*100}%"></div></div>${[...new Set(c.单元.map(x=>x.题型))].map(类型=>`<p class="卡片模块名">${类型}</p><div class="题号网格">${c.单元.map((u,i)=>{if(u.题型!==类型)return '';const 状态=记录?(记录.对错[i]?'正确':'错误'):c.阶段==='自评'&&u.题型==='翻译'?(Number.isInteger(c.自评?.[u.题目])?'已答':'未答'):(String(c.作答[u.题目]||'').trim()?'已答':'未答');return `<button class="题号 ${状态} ${当前题===i?'当前':''} ${(c.标记||[]).includes(u.题目)?'标记':''}" data-action="跳题" data-index="${i}" aria-label="第 ${i+1} 题，${状态}" ${当前题===i?'aria-current="step"':''}>${i+1}</button>`;}).join('')}</div>`).join('')}<div class="图例"><span><b class="色点 绿"></b>${记录?'正确 / 满分':'已答'}</span><span><b class="色点 ${记录?'红':''}"></b>${记录?'错误 / 未满分':'未答'}</span></div>${记录?`<button class="按钮 次要 满" data-action="${c.模块==='复习'?'查看每日复习':c.模块==='专项'?'开始专项':'开始'}" data-type="${c.专项类型||''}" data-topic="${转义(c.知识点||'')}" data-source="${c.题源}" data-module="${c.模块}">${图标('shuffle')}${c.模块==='复习'?'今日复习任务':'再抽一套'}</button><a class="按钮 轻 满" href="#记录">全部记录</a>`:`<button class="按钮 满" data-action="提交检查">${图标('send')}${c.阶段==='自评'?'完成自评并计分':'提交试卷'}</button><p class="侧说明">按正确率奖励，最高 ${['复习','专项'].includes(c.模块)?c.题目编号.length:奖励规则[c.模块]} 金币</p>`}</aside>`;
}
function 练习页(记录){
  const c=记录||存档.草稿;
  if(!c)return `${页头('开始一轮练习')}<div class="空状态"><h2>暂无进行中的练习</h2><a class="按钮" href="#主页">返回主页</a></div>`;
  const 总=c.题目编号.length;当前题=Math.max(0,Math.min(总-1,当前题));
  const q=索引.题目.get(c.题目编号[当前题]),p=q.篇章?索引.篇章.get(q.篇章):null,a=答案?.[q.编号],已选=c.作答[q.编号],锁定=!!记录||c.阶段==='自评'||!!c.交卷时间;
  const 对数=记录?.对错.filter(Boolean).length;

  // 文章标记工具栏
  const 标记工具=p&&!记录&&!c.考试?`<div class="文章标记工具"><button class="图标按钮小" data-action="标记文本" data-type="重点" title="标记重点">${图标('highlighter')}重点</button><button class="图标按钮小" data-action="标记文本" data-type="疑问" title="标记疑问">${图标('help-circle')}疑问</button><button class="图标按钮小" data-action="清除标记" title="清除本文标记">${图标('eraser')}清除</button><span class="标记说明">选中文字后标记，随草稿保存</span></div>`:'';

  const 文=p?`<section class="阅读原文 ${q.题型==='完形'?'完形原文':''}" lang="en">${标记工具}<div class="原文标题"><span class="徽标">${q.题型==='阅读'?`阅读 ${c.篇章编号.filter(id=>索引.篇章.get(id).题型==='阅读').indexOf(p.编号)+1}`:'完形原文'}</span><h2>${转义(p.标题)}</h2></div><div class="文章正文" id="文章正文" data-passage="${转义(p.编号)}">${篇章内容(p)}</div></section>`:'';
  const 作答区=q.题型==='翻译'?`<label class="翻译输入标签" for="翻译作答">你的译文</label><textarea id="翻译作答" class="翻译作答" maxlength="4000" ${锁定?'readonly':''} placeholder="输入译文">${转义(已选||'')}</textarea>`:`<div class="选项组" role="group" aria-label="答案选项">${(c.选项顺序?.[q.编号]||[0,1,2,3]).map((原,i)=>{const v=字母[原],正确=记录&&a.正确选项.includes(v),错=记录&&已选===v&&!正确;return `<button class="选项 ${已选===v?'已选':''} ${正确?'正确':''} ${错?'错误':''}" data-action="选答案" data-value="${v}" aria-pressed="${已选===v}" ${锁定?'disabled':''}><span class="选项字母">${字母[i]}</span><span class="选项内容" lang="en">${转义(q.选项[原])}</span>${正确?`<small>正确答案</small>${图标('check')}`:错?`<small>你的答案</small>${图标('x')}`:已选===v?图标('check'):''}</button>`;}).join('')}</div>`;
  const 题目头=`<div class="题目头"><strong>第 ${String(当前题+1).padStart(2,'0')} 题 / ${总}</strong><span>${q.题型||'单选'} · ${数值(题目分值(c,当前题))} 分</span>${p?`<button class="按钮 轻 小" data-action="面板伸缩" aria-expanded="${!面板收起}">${面板收起?'展开答题':'收起答题'} ${图标(面板收起?'chevron-up':'chevron-down')}</button>`:''}</div>`;
  const 解析区=记录||c.阶段==='自评'&&q.题型==='翻译'?`<section class="解析"><h3>${q.题型==='翻译'?'参考答案与评分':'答案与解析'}</h3>${解析内容(c,q,a,当前题)}${q.题型==='翻译'?记录?`<p class="徽标">自评 ${c.自评[q.编号]} / 4 · 折合 ${数值(c.单题得分[当前题])} 分</p>`:`<fieldset class="自评控件" ${c.考试&&!String(c.作答[q.编号]||'').trim()?'disabled':''}><legend>自评得分（每个要点 1 分）</legend>${[0,1,2,3,4].map(n=>`<label><input type="radio" name="自评" value="${n}" ${c.自评[q.编号]===n?'checked':''}>${n} 分</label>`).join('')}</fieldset>`:''}<p><small>出处：${转义(q.来源)} · 原题 ${q.原题号}</small></p></section>`:'';
  const 操作区=`<div class="题目操作"><button class="按钮 次要" data-action="翻题" data-step="-1" ${当前题===0?'disabled':''}>${图标('chevron-left')}上一题</button><div class="按钮组"><button class="图标按钮" data-action="收藏" aria-label="${存档.收藏.includes(q.编号)?'取消收藏':'收藏本题'}" title="收藏本题" aria-pressed="${存档.收藏.includes(q.编号)}">${图标('bookmark')}</button><button class="图标按钮" data-action="题目反馈" data-id="${转义(q.编号)}" title="反馈题目" aria-label="反馈题目">${图标('message-square')}</button>${!记录&&!c.考试?`<button class="图标按钮" data-action="标记" aria-label="标记稍后检查" title="标记稍后检查" aria-pressed="${(c.标记||[]).includes(q.编号)}">${图标('flag')}</button>`:''}</div><button class="按钮" data-action="${当前题===总-1&&!记录?'提交检查':'翻题'}" data-step="1" ${当前题===总-1&&记录?'disabled':''}>${当前题===总-1&&!记录?'提交':'下一题'}${图标('chevron-right')}</button></div>`;
  const 题目内容=p&&q.题型!=='翻译'?`${文}<article class="阅读答题窗" aria-label="文章答题面板">${题目头}<div class="面板设置入口"><button class="按钮 轻 小" data-action="显示设置">字号 / 面板高度</button></div><div class="答题窗滚动区"><p class="题干" lang="en">${转义(q.题干)}</p>${作答区}${解析区}</div>${操作区}</article>`:`<article class="试题">${题目头}<p class="题干" lang="en">${转义(q.题干)}</p>${作答区}${解析区}${操作区}</article>`;
  return `<div class="练习头"><div><a class="按钮 轻 小" href="#主页">${图标('arrow-left')}学习主页</a><h1>${转义(c.名称)}${记录?' · 答题报告':''}</h1></div><div class="计时">${图标('clock-3')}<span>${c.考试&&!记录?'剩余时间':''}</span><span id="计时">${时长(记录?记录.用时:c.考试?考试剩余(c):Math.max(0,Math.floor((Date.now()-c.开始时间)/1000)))}</span></div></div>${!记录?`<div class="作答进度条"><span>${c.考试?'考试模式 · 提交后统一查看解析':'练习模式'}</span><strong>剩余 ${未答题(c).length} / ${总} 题未答</strong></div>`:''}${记录?`<section class="成绩条"><div class="成绩数字">${记录.分数}<small> / ${记录.满分} 分</small></div><div class="成绩概述"><strong>${对数} 题满分 · ${总-对数} 题待巩固</strong><p>${日期(记录.提交时间)}${记录.含自评?' · 含翻译自评分':''}</p></div><div class="成绩奖励">${图标('coins')}本次已获得 ${记录.金币} 金币</div></section><div class="工具栏"><div class="分段"><button class="${只看错题?'':'当前'}" data-action="复盘筛选" data-value="全部">全部题目</button><button class="${只看错题?'当前':''}" data-action="复盘筛选" data-value="错题">只看错题 · ${总-对数}</button></div></div>`:c.阶段==='自评'?'<div class="继续条"><p>翻译自评：对照每题的 4 项评分要点，选择所得分数。客观题作答已锁定。</p></div>':''}<div class="答题布局 ${p?'含阅读':''}"><div class="题文区">${题目内容}</div>${答题卡(c,记录)}</div>`;
}
function 错题集合(){const m=new Map();for(const r of 存档.记录)r.题目编号.forEach((id,i)=>{if(!r.对错[i])m.set(id,{id,记录:r.编号});});return [...m.values()];}
function 错题页(){const 收藏=路由()[1]==='收藏',项=收藏?存档.收藏.map(id=>({id})):错题集合();return `${页头('我的错题','回看作答，整理尚未掌握的知识点。')}${学习报告区()}<div class="分段"><a class="${收藏?'':'当前'}" href="#错题本">错题 ${错题集合().length}</a><a class="${收藏?'当前':''}" href="#错题本/收藏">收藏 ${存档.收藏.length}</a></div>${项.length?项.map(x=>{const q=索引.题目.get(x.id);return `<article class="错题行"><div class="错题行头"><span class="徽标">${q.题型||'单选'}</span><span>${转义(q.来源)}</span></div><p class="题干">${转义(q.题干)}</p><button class="按钮 轻 小" data-action="展开解析" data-id="${q.编号}">查看原文与解析 ${图标('chevron-down')}</button>${x.记录?`<a class="按钮 轻 小" href="#结果/${x.记录}/${q.编号}">回看作答 ${图标('arrow-right')}</a>`:''}${反馈按钮(q.编号)}<div id="解析-${q.编号}"></div></article>`;}).join(''):'<div class="空状态"><h2>暂无题目</h2><a class="按钮" href="#主页">开始练习</a></div>'}`;}
function 记录页(){return `${页头('练习记录',`共 ${存档.记录.length} 次练习`)}${存档.记录.length?`<div class="表格容器"><table class="表格"><thead><tr><th>练习</th><th>分数</th><th class="手机隐藏">用时</th><th>金币</th><th></th></tr></thead><tbody>${[...存档.记录].reverse().map(r=>`<tr><td><strong>${转义(r.名称)}</strong><small>${日期(r.提交时间)}${r.含自评?' · 含自评':''}</small></td><td><strong>${r.分数}</strong><small>/ ${r.满分}</small></td><td class="手机隐藏">${时长(r.用时)}</td><td>+${r.金币}</td><td><a class="按钮 轻 小" href="#结果/${r.编号}">查看 ${图标('arrow-right')}</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="空状态"><h2>暂无练习记录</h2><a class="按钮" href="#主页">开始练习</a></div>'}`;}
function 修为页(){const 金币=累计修为(存档),修为=修为信息(金币);return `${页头('修为与战力','累计修为决定大境界，金币用于兑换；消费金币不会降低境界。',`<a class="按钮 次要" href="#兑换">${图标('gift')}金币兑换</a>`)}<section class="境界概况"><div>${图标('award')}<h2>${修为.当前.名称} · ${当前小段()}段</h2><p>累计修为 ${金币} 点 · 可用 ${可用金币()} 金币</p></div><div><p>当前战力：<strong>${当前战力()}</strong>${修为.下一?` · 距离${修为.下一.名称}还需 ${修为.下一.金币-金币} 修为`:''}</p><div class="进度条"><div style="width:${修为.进度}%"></div></div></div></section><div class="分区头"><h2>修为境界</h2></div><ol class="修为阶梯">${修为等级.map(x=>`<li class="${金币>=x.金币?'已达':''}">${图标(金币>=x.金币?'check-circle-2':'circle')}<strong>${x.名称}</strong><span>${x.金币} 修为</span>${修为.当前===x?'<span class="徽标">当前</span>':''}</li>`).join('')}</ol><div class="分区头"><h2>完成奖励上限</h2></div><div class="奖励列表">${Object.entries(奖励规则).map(([k,n])=>`<div><span>${k==='整卷'?'全套卷子':k}</span><strong>最高 ${n} 金币</strong></div>`).join('')}</div>`;}
function 兑换页(){
 const 当前=修为信息(累计修为(存档)).当前.名称;
 if(!修为等级.some(x=>x.名称===商城境界))商城境界=当前;
 const 分组=['功法','装备','法器','丹药'],物品卡=x=>{
  const 数量=Number(存档.背包?.[x.编号]||0),状态=商品状态(x,存档,当前,可用金币());
  return `<article class="境界商品 ${数量?'已拥有':''}"><div><span class="徽标">${x.类别}</span><small>${x.境界}</small></div><h3>${转义(x.名称)}</h3><p>${x.类别==='丹药'?'服用后提升当前境界一小段，最高九段。':`永久增加 ${x.战力} 战力，同件限购一次。`}</p><strong class="商品属性">${x.战力?`+${x.战力} 战力`:'小段 +1'}</strong><footer><span>${x.价格} 金币 ${数量?`<small>已拥有 ${数量}</small>`:''}</span><button class="按钮 小" data-action="兑换物品" data-id="${x.编号}" ${状态.可买?'':'disabled'}>${状态.原因}</button></footer>${x.类别==='丹药'&&数量?`<button class="按钮 次要 小 满" data-action="服用丹药" data-id="${x.编号}" ${当前!==x.境界||当前小段()>=9?'disabled':''}>${当前!==x.境界?'仅对应境界可服用':当前小段()>=9?'当前境界已达九段':'服用一枚'}</button>`:''}</article>`;
 };
 const 背包=兑换物品.filter(x=>Number(存档.背包?.[x.编号])>0);
 return `${页头('修行坊市','选择当前境界的修行之物。金币用于兑换，累计修为只增不减。',`<a class="按钮 次要" href="#修为">查看修为</a>`)}
 <section class="商城账本"><div><span>可用金币</span><strong>${可用金币()}</strong><small>累计获得 ${总金币(存档)}，已用 ${存档.消费金币||0}</small></div><div><span>累计修为</span><strong>${累计修为(存档)}</strong><small>消费不会降低境界</small></div><div><span>当前境界</span><strong>${当前}</strong><small>第 ${当前小段()} 段 · 战力 ${当前战力()}</small></div></section>
 <nav class="境界标签" aria-label="商城境界">${修为等级.map(x=>`<button class="${商城境界===x.名称?'当前':''}" data-action="商城境界" data-value="${x.名称}" aria-pressed="${商城境界===x.名称}">${x.名称}${x.名称===当前?'<small>当前境界</small>':''}</button>`).join('')}</nav>
 ${商城境界!==当前?`<p class="警告">你当前为${当前}，本区商品仅供${商城境界}兑换。已经拥有的物品继续保留。</p>`:''}
 ${分组.map(类=>`<section class="商城分区"><div class="分区头"><h2>${类}</h2><span class="副标题">${类==='丹药'?'可重复兑换，按境界服用':'限购一次，永久保留战力'}</span></div><div class="境界商品网格">${兑换物品.filter(x=>x.境界===商城境界&&x.类别===类).map(物品卡).join('')}</div></section>`).join('')}
 <details class="背包总览"><summary>我的背包 · ${背包.length} 种物品</summary><div class="背包清单">${背包.length?背包.map(x=>`<p><strong>${转义(x.名称)}</strong><span>${x.境界} · ${存档.背包[x.编号]} 件</span></p>`).join(''):'<p>完成练习获得金币后，就可以兑换第一件物品。</p>'}</div></details>`;
}
async function 刷新日志(){try{管理操作=await 获取管理日志(管理日志页);管理日志错误='';}catch(e){管理日志错误=e.message;}}
function 日志区域(){return `<section class="管理员面板 管理日志"><div class="分区头"><h2>管理员操作记录</h2><button class="按钮 次要 小" data-action="刷新管理日志">刷新记录</button></div>${管理日志错误?`<p class="警告">${转义(管理日志错误)}</p>`:''}<div class="管理员表格包"><table class="表格"><thead><tr><th>时间</th><th>操作人</th><th>目标账户</th><th>操作</th></tr></thead><tbody>${管理操作.map(x=>`<tr><td>${日期(x.时间)}</td><td>${转义(x.操作人)}</td><td>${转义(x.目标)}</td><td>${转义(x.动作)}</td></tr>`).join('')||'<tr><td colspan="4">此页暂无操作记录。</td></tr>'}</tbody></table></div><div class="按钮组"><button class="按钮 次要 小" data-action="刷新管理日志" data-step="-1" ${管理日志页?'':'disabled'}>上一页</button><span>第 ${管理日志页+1} 页</span><button class="按钮 次要 小" data-action="刷新管理日志" data-step="1" ${管理操作.length===50?'':'disabled'}>下一页</button></div></section>`;}
function 设置页(){
 const 用户=获取当前用户();
 const 管理员区=是管理员()?`<section class="管理员面板"><div class="分区头"><div><h2>账户管理</h2><p class="副标题">云端共 ${管理员用户.length} 个账户</p></div><button class="按钮 次要 小" data-action="刷新管理员" ${管理员加载中?'disabled':''}>${图标('refresh-cw')}${管理员加载中?'加载中':'刷新账户列表'}</button></div>${管理员错误?`<p class="警告" role="alert">${转义(管理员错误)}，请点击刷新重试。</p>`:''}<div class="管理员表格包"><table class="表格 管理员表格"><thead><tr><th>用户</th><th>手机号</th><th>注册时间</th><th>最后登录</th><th>状态</th><th>操作</th></tr></thead><tbody>${管理员用户.map(x=>`<tr><td>${转义(x.名称)}</td><td>${转义(x.手机号)}</td><td>${日期(x.注册时间)}</td><td>${x.最后登录?日期(x.最后登录):'未登录'}</td><td><span class="徽标 ${x.禁用?'红':''}">${x.禁用?'已禁用':'正常'}</span></td><td>${x.手机号===管理员手机号?'管理员':`<button class="按钮 小 次要" data-action="切换用户状态" data-phone="${x.手机号}" data-disabled="${x.禁用?'true':'false'}">${x.禁用?'启用':'禁用'}</button>`}</td></tr>`).join('')}</tbody></table></div></section>`:'';
 return `${页头('学习存档','在不同设备上，接着上一次的进度。',`<a class="按钮 次要" href="#题目反馈">${是管理员()?'管理题目反馈':'我的题目反馈'}</a>`)}<div class="设置行"><div><h3>登录账号</h3><p>${转义(用户?.名称)} · ${转义(用户?.手机号)}</p></div><button class="按钮 次要" data-action="退出登录">${图标('log-out')}退出账户</button></div><div class="设置行"><div><h3>当前存档 <span class="同步状态" data-sync-state></span></h3><p>${存档.记录.length} 次练习 · ${总金币(存档)} 金币 · ${存档.收藏.length} 道收藏</p><p data-sync-detail></p></div><button class="按钮 次要" data-action="立即同步">${图标('refresh-cw')}立即同步</button></div>${管理员区}${是管理员()?日志区域():''}<div class="设置行"><div><h3>账户安全</h3><p>修改密码后，所有设备都需要重新登录。</p></div><div class="按钮组"><button class="按钮 次要" data-action="修改密码">修改密码</button><button class="按钮 次要" data-action="退出其他设备">退出其他设备</button></div></div><div class="设置行"><div><h3>阅读与答题显示</h3><p>调整字号与答题面板高度，设置在本设备持续生效。</p></div>${显示设置控件()}</div><div class="设置行"><div><h3>备份与迁移</h3><p>登录同一账号并完成同步，即可在其他设备继续。导出文件可作为额外备份。</p></div><div class="按钮组"><button class="按钮 次要" data-action="导出">${图标('download')}导出存档</button><button class="按钮 次要" data-action="导入">${图标('upload')}导入存档</button><input id="导入文件" type="file" class="隐" accept="application/json,.json"></div></div><div class="设置行"><div><h3>页面风格</h3><p>选择舒服的阅读颜色。</p></div><div class="主题选择" role="group" aria-label="页面风格">${主题列表.map(([id,名])=>`<button class="${主题===id?'当前':''}" data-action="主题" data-value="${id}" aria-pressed="${主题===id}"><span class="主题色 ${id}"></span>${名}</button>`).join('')}</div></div><div class="设置行"><div><h3>原创题库</h3><p>${模块列表.map(k=>`${可抽内容(题库,'原创')[k].length} ${['阅读','完形'].includes(k)?'篇':'道'}${k}`).join('、')}。这是去重后的可用题量；单块与整卷共享题库，每轮抽取未练题目。</p></div></div><div class="设置行"><div><h3>完形校订</h3><p>14 篇照片原题保留原卷 10 空，在原文中再增加 10 空；20 篇原创文章独立编写。旧版题目停止抽取，已获得的成绩与金币保留。</p></div></div><p class="警告">换设备前请确认“已同步”。两台设备同时答题时，会合并已提交记录；建议同一时间使用一台设备作答。</p>`;
}
async function 渲染(){const 序=++渲染序,[页,id,qid]=路由();try{应用主题();if(页==='结果'||页==='练习'&&存档.草稿?.阶段==='自评')await 载入答案();if(序!==渲染序)return;let 内容;const 原题模块={选择题:'单选',阅读理解:'阅读',完形填空:'完形',翻译:'翻译'};if(页==='主页')内容=主页();else if(原题模块[页])内容=原题页(原题模块[页]);else if(页==='单块模拟题')内容=模拟页();else if(页==='全套卷子模拟题')内容=模拟页(true);else if(页==='练习')内容=练习页();else if(页==='结果'){const r=存档.记录.find(x=>x.编号===id);if(qid&&r)当前题=Math.max(0,r.题目编号.indexOf(qid));内容=r?练习页(r):'<div class="空状态"><h2>未找到记录</h2><a href="#记录">返回记录</a></div>';}else if(页==='知识点专项')内容=专项页();else if(页==='题目反馈')内容=await 反馈页面();else if(页==='每日复习')内容=每日复习页();else if(页==='记录')内容=记录页();else if(页==='错题本')内容=错题页();else if(页==='修为')内容=修为页();else if(页==='兑换')内容=兑换页();else if(页==='设置')内容=设置页();else{导航('主页');return;}外壳(内容,页);}catch(e){错误提示(e);外壳(`<div class="空状态"><h2>页面加载失败</h2><p>${转义(e.message)}</p><button class="按钮" data-action="重试">重新加载</button></div>`,页);}document.title=`${页} · 升本练习室`;}
async function 开始复习(强制=false){
 if(忙)return;await 写入队列;await 同步存档();存档=await 读取();
 if(存档.草稿?.模块==='复习'&&存档.草稿.复习日期===复习计划(题库,存档).今天){导航('练习');return;}
 if(存档.草稿&&!强制){确认('开始今日错题复习？','当前未提交草稿将被替换，已提交的练习记录保留。','替换复习','开始复习');return;}
 忙=true;try{存档=await 更新(s=>({...s,草稿:生成每日复习(题库,s)}));当前题=0;导航('练习');await 渲染();}finally{忙=false;}
}
async function 开始(题源,模块,强制=false){
  if(忙)return;await 写入队列;
  if(存档.草稿&&!强制){待开始={题源,模块};确认('开始新的随机练习？','当前草稿将被替换，已提交的成绩和金币会保留。','替换确认','开始新练习');return;}
  忙=true;try{存档=await 更新(s=>{let c=生成练习(题库,题源,模块,s.已抽原创||[]);if(模块==='整卷'&&组卷模式==='考试')c=设置考试(c);return {...s,草稿:c,已抽原创:[...new Set([...(s.已抽原创||[]),...c.本次原创])]};});当前题=0;只看错题=false;导航('练习');await 渲染();}finally{忙=false;}
}
async function 修改草稿(编号,修改){存档=await 更新(s=>{if(s.草稿?.编号!==编号)throw new Error('练习已在另一页面改变，请刷新后重试。');return {...s,草稿:修改(s.草稿)};});}
async function 兑换(编号){const 物=兑换物品.find(x=>x.编号===编号);if(!物)throw new Error('物品不存在。');存档=await 更新(s=>{const 状态=商品状态(物,s,修为信息(累计修为(s)).当前.名称,Math.max(0,总金币(s)-(Number(s.消费金币)||0)));if(!状态.可买)throw new Error(状态.原因);return {...s,版本:3,消费金币:(Number(s.消费金币)||0)+物.价格,背包:{...s.背包,[编号]:Number(s.背包?.[编号]||0)+1}};});await 渲染();提示(`已兑换${物.名称}，${物.类别==='丹药'?'可在背包服用':`战力增加 ${物.战力}`}，累计修为不变。`);}
async function 服用(编号){const 物=兑换物品.find(x=>x.编号===编号);if(!物||物.类别!=='丹药')throw new Error('丹药不存在。');存档=await 更新(s=>{const 期=修为信息(累计修为(s)).当前.名称,段=当前小段(s);if(期!==物.境界)throw new Error(`此丹药仅适用于${物.境界}。`);if(!(Number(s.背包?.[编号])>0))throw new Error('背包中没有这枚丹药。');if(段>=9)throw new Error('当前境界已达九段，无需服药。');return {...s,境界小段:{...s.境界小段,[期]:段+1},小段:段+1,背包:{...s.背包,[编号]:Number(s.背包[编号])-1}};});await 渲染();提示(`已服用${物.名称}，当前为第 ${当前小段()} 段。`);}
async function 提交检查(){
  await 写入队列;const c=存档.草稿;if(!c||忙)return;const 漏=未答题(c);
  if(c.考试&&!c.交卷时间){弹窗.innerHTML=`<h2>确认交卷？</h2><p>还有 ${漏.length} 道未答题，${(c.标记||[]).length} 道标记题。交卷后作答锁定，未答题计零分。</p>${漏.length?`<div class="未答题列表">${漏.map(i=>`<button class="按钮 次要 小" data-action="补答题" data-index="${i}">第 ${i+1} 题</button>`).join('')}</div>`:''}<div class="按钮组"><button class="按钮 次要" data-action="关闭">继续检查</button><button class="按钮" data-action="考试交卷">确认交卷</button></div>`;弹窗.showModal();return;}
  if(漏.length&&!c.考试){当前题=漏[0];await 渲染();弹窗.innerHTML=`<h2>还有 ${漏.length} 道题未作答</h2><p>点击题号回到相应题目，补齐后再提交。</p><div class="未答题列表">${漏.map(i=>`<button class="按钮 次要 小" data-action="补答题" data-index="${i}">第 ${i+1} 题</button>`).join('')}</div><button class="按钮" data-action="关闭">继续作答</button>`;弹窗.showModal();return;}
  const 翻译=c.单元.filter(q=>q.题型==='翻译');
  if(翻译.length&&c.阶段!=='自评'){确认('进入翻译自评？','作答将被锁定。对照参考译文和评分要点完成自评后，生成成绩并发放金币。','进入自评','确认并自评');return;}
  if(翻译.length){const 未评=c.单元.findIndex(q=>q.题型==='翻译'&&!Number.isInteger(c.自评[q.题目]));if(未评>=0){当前题=未评;提示('请完成每道翻译的自评。');await 渲染();return;}}
  确认('提交并生成成绩？',`已完成 ${c.题目编号.length} 道题。提交后按得分比例获得金币，最高 ${['复习','专项'].includes(c.模块)?c.题目编号.length:奖励规则[c.模块]} 金币。`,'提交确认','提交并评分');
}
async function 交考试卷(){
 const c=存档.草稿;if(!c?.考试||到时处理中)return;到时处理中=true;
 try{await 写入队列;await 修改草稿(c.编号,d=>锁定试卷(d));弹窗.close();if(存档.草稿.阶段==='自评'){当前题=存档.草稿.单元.findIndex(u=>u.题型==='翻译'&&String(存档.草稿.作答[u.题目]||'').trim());导航('练习');await 渲染();提示('考试作答已锁定，请对已作答翻译进行自评。');}else await 提交();}finally{到时处理中=false;}
}
async function 查看反馈题目(id){
 const q=索引.题目.get(id);if(!q){提示('当前题库中没有这道题，请按反馈题号核对题库。');return;}await 载入答案();const a=答案[id],p=q.篇章?索引.篇章.get(q.篇章):null;
 弹窗.innerHTML=`<h2>题目 ${转义(id)}</h2><p>${转义(q.题干)}</p><div class="反馈题文">${p?`<div class="文章正文">${篇章内容(p)}</div>`:''}${q.题型==='翻译'?`<p>${转义(a.参考答案)}</p><p>${转义(a.解析)}</p>`:学习解析区({选项顺序:{}},q,a)}</div><button class="按钮" data-action="关闭">关闭</button>`;弹窗.showModal();
}
async function 提交(){if(忙)return;忙=true;try{await 写入队列;await 载入答案();const c=存档.草稿;if(!c)throw new Error('没有可提交的练习。');const 分=通用评分(c,答案);let 旧金币,新增=false;const r={...c,...分,用时:Math.max(0,Math.floor(((c.考试?Math.min(c.交卷时间||Date.now(),c.考试截止):Date.now())-c.开始时间)/1000)),提交时间:Date.now()};存档=await 更新(s=>{旧金币=累计修为(s);if(s.记录.some(x=>x.编号===c.编号))return s;if(s.草稿?.编号!==c.编号||JSON.stringify(s.草稿.作答)!==JSON.stringify(c.作答)||JSON.stringify(s.草稿.自评)!==JSON.stringify(c.自评))throw new Error('其他页面已更改作答，请刷新后提交。');新增=true;return {...s,记录:合并练习记录(s.记录,[r]),草稿:null};});弹窗.close();当前题=0;只看错题=false;导航(`结果/${c.编号}`);await 渲染();const 前=修为信息(旧金币).当前,后=修为信息(累计修为(存档)).当前;if(新增&&前.名称!==后.名称){弹窗.innerHTML=`<div class="升级提示">${图标('award')}<p>修为提升</p><h2>${后.名称}</h2><p>${前.名称} ${图标('arrow-right')} ${后.名称}</p><p>累计修为 ${累计修为(存档)} 点</p><button class="按钮 满" data-action="关闭">继续修行</button></div>`;弹窗.showModal();globalThis.lucide?.createIcons();}else 提示(`提交成功，获得 ${分.金币} 金币。`);}finally{忙=false;}}
async function 处理点击(b){if(!b||b.disabled)return;const 行=b.dataset.action;try{
  if(await 反馈动作(b,{弹窗,题目:索引.题目,提示,渲染,查看题目:查看反馈题目}))return;
  if(行==='组卷模式'){组卷模式=b.dataset.value;await 渲染();return;}
  if(行==='开始专项'){await 开始专项(b.dataset.type,b.dataset.topic);return;}
  if(行==='替换专项'){弹窗.close();await 开始专项(待专项.类型,待专项.知识点,true);return;}
  if(行==='考试交卷'){await 交考试卷();return;}
  if(['选答案','翻题','进入自评'].includes(行)&&已到考试时间(存档.草稿)){await 交考试卷();return;}
  if(行==='补答题'){弹窗.close();当前题=Number(b.dataset.index);await 渲染();return;}if(行==='关闭'){弹窗.close();return;}if(行==='重试'){await 渲染();return;}if(行==='开始'){await 开始(b.dataset.source,b.dataset.module);return;}if(行==='替换确认'){弹窗.close();await 开始(待开始.题源,待开始.模块,true);return;}if(行==='提交检查'){await 提交检查();return;}if(行==='提交确认'){await 提交();return;}if(行==='兑换物品'){await 兑换(b.dataset.id);return;}if(行==='服用丹药'){await 服用(b.dataset.id);return;}
  if(行==='退出登录'){await 写入队列;const ok=await 同步存档();if(!ok){确认('仍有进度待同步','本机进度已保留。现在退出会暂时无法在其他设备读取这部分进度，确定退出？','确认退出','保留本机进度并退出');return;}await 注销当前账户();location.href='./login.html';return;}
  if(行==='确认退出'){try{await 注销当前账户();}catch{退出登录();}location.href='./login.html';return;}
  if(行==='查看每日复习'){导航('每日复习');return;}
  if(行==='开始复习'){await 开始复习();return;}
  if(行==='替换复习'){弹窗.close();await 开始复习(true);return;}
  if(行==='商城境界'){商城境界=b.dataset.value;await 渲染();return;}
  if(行==='显示设置'){弹窗.innerHTML=`<h2>阅读与答题显示</h2>${显示设置控件()}<button class="按钮" data-action="关闭">完成</button>`;弹窗.showModal();return;}
  if(行==='退出其他设备'){确认('退出其他设备？','其他设备需要重新登录，当前设备继续使用。','确认退出其他设备','退出其他设备');return;}
  if(行==='确认退出其他设备'){await 退出其他设备();弹窗.close();提示('其他设备已退出，当前设备保持登录。');return;}
  if(行==='修改密码'){弹窗.innerHTML='<h2>修改密码</h2><form id="修改密码表单" class="安全表单"><label>当前密码<input name="旧密码" type="password" autocomplete="current-password" required maxlength="256"></label><label>新密码（至少8位）<input name="新密码" type="password" autocomplete="new-password" required minlength="8" maxlength="256"></label><label>确认新密码<input name="确认密码" type="password" autocomplete="new-password" required minlength="8" maxlength="256"></label><p>修改后，所有设备都需要用新密码重新登录。</p><p id="密码错误" role="alert"></p><div class="按钮组"><button type="button" class="按钮 次要" data-action="关闭">取消</button><button class="按钮" type="submit">保存新密码</button></div></form>';弹窗.showModal();return;}
  if(行==='刷新管理日志'){管理日志页=Math.max(0,管理日志页+Number(b.dataset.step||0));await 刷新日志();await 渲染();return;}
  if(行==='切换用户状态'){
    if(!是管理员())throw new Error('只有管理员可以管理账户');
    const 手机号=b.dataset.phone,禁用=b.dataset.disabled!=='true';
    await 更新用户状态(手机号,禁用);
    管理员用户=await 获取所有用户();await 刷新日志();
    await 渲染();
    提示(禁用?'已禁用该账号。':'已启用该账号。');
    return;
  }
  if(行==='刷新管理员'){管理员已加载=false;await 刷新管理员();return;}
  if(行==='立即同步'){await 写入队列;const ok=await 同步存档();存档=await 读取();当前题=存档.草稿?.当前题||0;await 渲染();提示(ok?'同步完成，可在其他设备继续学习。':'已保留本机进度，云端暂未同步，请重试。');return;}
  if(行==='面板伸缩'){面板收起=!面板收起;await 渲染();return;}
  if(行==='标记文本'){
    const 文章=document.querySelector('#文章正文'),范围=文章选区||读取选区(文章),c=存档.草稿;
    if(!范围||!文章||!c){提示('先在文章里选中需要标记的文字，再点击重点或疑问。');return;}
    const id=文章.dataset.passage;await 修改草稿(c.编号,d=>({...d,文章标记:{...d.文章标记,[id]:[...(d.文章标记?.[id]||[]),{...范围,类型:b.dataset.type}].slice(-100)}}));getSelection()?.removeAllRanges();await 渲染();return;
  }
  if(行==='清除标记'){
    const id=document.querySelector('#文章正文')?.dataset.passage,c=存档.草稿;if(!id||!c)return;
    await 修改草稿(c.编号,d=>({...d,文章标记:{...d.文章标记,[id]:[]}}));await 渲染();提示('已清除本文标记');return;
  }
  if(行==='主题'){主题=b.dataset.value;localStorage.setItem('升本练习室主题',主题);应用主题();await 渲染();提示(`已切换为${主题列表.find(x=>x[0]===主题)?.[1]||'新风格'}。`);return;}
  if(行==='进入自评'){await 写入队列;await 载入答案();const c=存档.草稿;if(!c)return;await 修改草稿(c.编号,d=>{if(未答题(d).length)throw new Error('还有未作答题目，请完成后再进入自评。');return {...d,阶段:'自评'};});当前题=c.单元.findIndex(q=>q.题型==='翻译');弹窗.close();await 渲染();return;}
  if(行==='导出'){await 写入队列;await 等待云端同步();const s=await 读取(),url=URL.createObjectURL(new Blob([JSON.stringify({应用:'升本练习室',导出时间:Date.now(),存档:s},null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`升本练习室存档-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(行==='导入'){document.querySelector('#导入文件').click();return;}if(行==='导入确认'){await 执行导入();return;}
  if(行==='展开解析'){await 载入答案();const q=索引.题目.get(b.dataset.id),a=答案[q.编号],el=document.getElementById(`解析-${q.编号}`);if(el.innerHTML){el.innerHTML='';return;}const p=q.篇章?索引.篇章.get(q.篇章):null;el.innerHTML=`<div class="错题行详情">${p?`<div class="文章正文">${篇章内容(p)}</div>`:''}${q.题型==='翻译'?`<p class="译文">${转义(a.参考答案)}</p><ol>${a.评分要点.map(x=>`<li>${转义(x)}</li>`).join('')}</ol>`:`<div>${q.选项.map((x,i)=>`<p>${字母[i]}. ${转义(x)}</p>`).join('')}</div><p class="对">正确答案：${a.正确选项.join(' 或 ')}</p>`}${q.题型==='翻译'?`<p>${转义(a.解析)}</p>`:学习解析区({选项顺序:{}},q,a)}</div>`;return;}
  await 写入队列;const c=当前练习();if(!c)return;const 记录=路由()[0]==='结果',id=c.题目编号[当前题];
  if(行==='定位空'){const p=索引.题目.get(id)?.篇章,目标=c.单元.findIndex(u=>u.篇章===p&&索引.题目.get(u.题目)?.原题号===Number(b.dataset.blank));if(目标<0){提示('这道题不在本次错题复习任务中。');return;}当前题=目标;面板收起=false;if(!记录)await 修改草稿(c.编号,d=>({...d,当前题}));await 渲染();return;}
  if(行==='选答案'&&!记录&&c.阶段!=='自评'&&!c.交卷时间){if(!字母.includes(b.dataset.value))return;await 修改草稿(c.编号,d=>({...d,作答:{...d.作答,[id]:b.dataset.value},当前题}));await 渲染();return;}
  if(行==='收藏'){存档=await 更新(s=>({...s,收藏:s.收藏.includes(id)?s.收藏.filter(x=>x!==id):[...s.收藏,id]}));await 渲染();return;}
  if(行==='标记'&&!记录){await 修改草稿(c.编号,d=>({...d,标记:d.标记.includes(id)?d.标记.filter(x=>x!==id):[...d.标记,id]}));await 渲染();return;}
  if(['跳题','翻题','复盘筛选'].includes(行)){if(行==='跳题'){当前题=Number(b.dataset.index);if(记录&&c.对错[当前题])只看错题=false;}else if(行==='复盘筛选'){只看错题=b.dataset.value==='错题';if(只看错题&&c.对错.every(Boolean)){只看错题=false;提示('本次全部满分，没有错题。');return;}当前题=只看错题?c.对错.indexOf(false):0;}else{const 步=Number(b.dataset.step);let i=当前题+步;while(记录&&只看错题&&i>=0&&i<c.题目编号.length&&c.对错[i])i+=步;if(i<0||i>=c.题目编号.length){提示('已到达题目边界。');return;}当前题=i;}if(!记录)await 修改草稿(c.编号,d=>({...d,当前题}));if(记录&&路由()[2])history.replaceState(null,'',`#结果/${c.编号}`);await 渲染();document.querySelector('.试题')?.scrollIntoView({block:'start'});}
}catch(err){错误提示(err);}}
document.addEventListener('submit',async e=>{if(['修改密码表单','题目反馈表单','反馈处理表单'].includes(e.target.id))e.preventDefault();if(await 提交反馈表单(e,{弹窗,提示,渲染}))return;if(e.target.id!=='修改密码表单')return;e.preventDefault();const f=e.target,b=f.querySelector('[type="submit"]'),错误=f.querySelector('#密码错误');if(b.disabled)return;b.disabled=true;错误.textContent='';try{const v=new FormData(f);if(v.get('新密码')!==v.get('确认密码'))throw new Error('两次新密码不一致。');await 写入队列;if(!await 同步存档())throw new Error('请先完成云端同步，再修改密码。');await 修改账户密码(v.get('旧密码'),v.get('新密码'),v.get('确认密码'));退出登录();sessionStorage.setItem('账户提示','密码已修改，请重新登录。');location.replace('./login.html');}catch(err){错误.textContent=err.message;b.disabled=false;}});
window.addEventListener('账户失效',()=>{退出登录();sessionStorage.setItem('账户提示','登录已失效，请重新登录；本机学习进度已保留。');location.replace('./login.html');});
document.addEventListener('selectionchange',()=>{const r=读取选区(document.querySelector('#文章正文'));if(r)文章选区=r;});
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-action="标记文本"]')&&e.pointerType==='mouse')e.preventDefault();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;操作队列=操作队列.then(()=>处理点击(b)).catch(错误提示);});
document.addEventListener('input',e=>{if(e.target.dataset.display){const s=保存显示设置(e.target.dataset.display,e.target.value);document.querySelectorAll('[data-display-output]').forEach(el=>el.textContent=s[el.dataset.displayOutput]);return;}if(e.target.id!=='翻译作答'||!存档.草稿||存档.草稿.阶段==='自评')return;const c=存档.草稿,题序=当前题,id=c.题目编号[题序],值=e.target.value;写入队列=写入队列.then(()=>修改草稿(c.编号,d=>{if(d.阶段==='自评'||d.交卷时间||已到考试时间(d))throw new Error('作答已锁定。');return {...d,作答:{...d.作答,[id]:值},当前题:题序};})).catch(错误提示);});
document.addEventListener('change',async e=>{try{if(e.target.name==='自评'){const c=存档.草稿;if(c?.阶段!=='自评')return;const id=c.题目编号[当前题],分=Number(e.target.value);写入队列=写入队列.then(()=>修改草稿(c.编号,d=>({...d,自评:{...d.自评,[id]:分}}))).then(渲染).catch(错误提示);await 写入队列;return;}if(e.target.id!=='导入文件'||!e.target.files[0])return;const f=e.target.files[0];if(f.size>40000000)throw new Error('存档文件过大。');const v=JSON.parse(await f.text()),导出数据=v.存档||v;if(v.应用&&v.应用!=='升本练习室')throw new Error('存档格式无效。');if(![1,2,3].includes(导出数据.版本)||!Array.isArray(导出数据.记录)||!Array.isArray(导出数据.收藏))throw new Error('存档格式无效。');待导入=导出数据;确认('合并学习存档？','相同记录不会重复计币；导入草稿将替换当前草稿，金币、背包和已抽题记录同时合并。','导入确认','合并存档');}catch(err){错误提示(err);}finally{if(e.target.id==='导入文件')e.target.value='';}});
async function 执行导入(){if(!待导入||忙)return;忙=true;try{await 载入答案();const 导入数据=待导入;const 记录=导入数据.记录.map(r=>{const c=验证练习(r,题库);if(!Number.isFinite(c.提交时间)||!Number.isFinite(c.用时)||c.用时<0)throw new Error('存档时间无效。');return {...c,...通用评分(c,答案)};});let 草稿=导入数据.草稿?验证练习(导入数据.草稿,题库):null;if(草稿&&草稿.模块!=='复习')草稿={...草稿,编号:新编号()};const 合法=new Set([...题库.题目.filter(q=>q.题源==='原创').map(q=>q.编号),...题库.篇章.filter(p=>p.题源==='原创').map(p=>p.编号)]),已抽=(导入数据.已抽原创||[]).filter(id=>合法.has(id));for(const c of [...记录,...(草稿?[草稿]:[])])if(c.题源==='原创')已抽.push(...c.题目编号,...c.篇章编号);存档=await 更新(s=>{const 合并记录=合并练习记录(s.记录,记录);const 记录金币=合并记录.reduce((n,r)=>n+Number(r.金币||0),0);return {...s,版本:3,记录:合并记录.sort((a,b)=>a.提交时间-b.提交时间),收藏:[...new Set([...s.收藏,...(导入数据.收藏||[]).filter(id=>索引.题目.has(id))])],草稿:草稿||s.草稿,已抽原创:[...new Set([...(s.已抽原创||[]),...已抽])],消费金币:Math.min(记录金币,Math.max(0,Number(s.消费金币)||0,Number(导入数据.消费金币)||0)),背包:Object.fromEntries([...new Set([...Object.keys(s.背包||{}),...Object.keys(导入数据.背包||{})])].map(id=>[id,Math.max(0,Number(s.背包?.[id])||0,Number(导入数据.背包?.[id])||0)])),境界小段:合并境界小段(s,导入数据,修为信息(累计修为(s)).当前.名称,修为信息(累计修为(导入数据)).当前.名称),小段:Math.max(Number(s.小段)||1,Number(导入数据.小段)||1)};});待导入=null;弹窗.close();const 已同步=await 等待云端同步();sessionStorage.setItem('升本练习室导入提示',已同步?'导入成功，已同步云端，页面已刷新。':'导入成功，已保存到本机，云端待同步。页面已刷新。');location.reload();}finally{忙=false;}}
window.addEventListener('hashchange',async()=>{await 写入队列;当前题=路由()[0]==='练习'?(存档?.草稿?.当前题||0):0;只看错题=false;await 渲染();window.scrollTo(0,0);});
window.addEventListener('focus',async()=>{if(!存档||忙)return;try{await 写入队列;if(Date.now()-上次同步检查>15000){上次同步检查=Date.now();await 同步存档();}存档=await 读取();if(路由()[0]==='练习')当前题=存档.草稿?.当前题??0;await 渲染();}catch(e){错误提示(e);}});
window.addEventListener('云端存档更新',async()=>{if(!存档)return;try{存档=await 读取();if(路由()[0]==='练习')当前题=存档.草稿?.当前题??0;await 渲染();提示('已同步其他设备的最新进度。');}catch(e){错误提示(e);}});
const 已提醒=new Set();
setInterval(()=>{
 const c=存档?.草稿,el=document.querySelector('#计时');if(!c)return;
 if(已到考试时间(c)||c.考试&&c.阶段==='已交卷'){if(!到时处理中&&!忙)交考试卷().catch(错误提示);return;}
 if(el&&路由()[0]==='练习'){const 秒=c.考试?考试剩余(c):Math.max(0,Math.floor((Date.now()-c.开始时间)/1000));el.textContent=时长(秒);el.classList.toggle('即将结束',!!c.考试&&秒<=600);
 if(c.考试&&!c.交卷时间){const 门槛=[60,300,600].find(n=>秒<=n),键=c.编号+':'+门槛;if(门槛&&!已提醒.has(键)){已提醒.add(键);提示(`考试还剩 ${Math.ceil(秒/60)} 分钟，请检查未答题。`);}}}
},1000);
try{
  // 初始化认证系统
  await 初始化认证();

  // 检查登录状态
  if(!是否已登录()){
    // 未登录，标记并跳转到登录页
    sessionStorage.setItem('刚从主页跳转', 'true');
    location.replace('./login.html');
  }else{
  const r=await fetch('./题库.json',{cache:'no-cache'});if(!r.ok)throw new Error('题库加载失败。');题库=await r.json();索引=建立题库索引(题库);存档=await 打开存档();if(存档.版本!==3||存档.记录.some(r=>r.版本!==2)||存档.草稿&&存档.草稿.版本!==2){await 载入答案();存档=await 更新(s=>({...s,版本:3,消费金币:Number(s.消费金币)||0,背包:s.背包||{},小段:Math.max(1,Math.min(9,Number(s.小段)||1)),已抽原创:s.已抽原创||[],记录:s.记录.map(r=>{if(r.版本===2)return r;const c=补齐旧练习(r,题库);return {...c,...通用评分(c,答案)};}),草稿:s.草稿?补齐旧练习(s.草稿,题库):null}));}if(存档.草稿?.单元?.some(u=>索引.题目.get(u.题目)?.旧版)){存档=await 更新(d=>({...d,草稿:null}));sessionStorage.setItem('升本练习室导入提示','完形题库已校订，请重新抽取一套；历史成绩与金币已保留。');}if(!存档.境界小段)存档=await 更新(d=>({...d,境界小段:{[修为信息(累计修为(d)).当前.名称]:Math.max(1,Math.min(9,Number(d.小段)||1))}}));当前题=存档.草稿?.当前题||0;await 渲染();const 导入提示=sessionStorage.getItem('升本练习室导入提示');if(导入提示){sessionStorage.removeItem('升本练习室导入提示');提示(导入提示);}}
}catch(e){根.innerHTML=`<div class="空状态"><h1>练习室暂时无法打开</h1><p>${转义(e.message)}</p><button class="按钮" onclick="location.reload()">重新加载</button></div>`;}
