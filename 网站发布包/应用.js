import {打开存档, 读取, 更新, 评分, 判题, 总金币} from './数据.js';

const 根 = document.querySelector('#应用');
const 弹窗 = document.querySelector('#对话框');
const 字母 = ['A','B','C','D'];
function 新编号() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const 字节 = crypto.getRandomValues(new Uint8Array(16));
  字节[6] = (字节[6] & 15) | 64;
  字节[8] = (字节[8] & 63) | 128;
  const 十六进制 = Array.from(字节, x => x.toString(16).padStart(2, '0')).join('');
  return `${十六进制.slice(0,8)}-${十六进制.slice(8,12)}-${十六进制.slice(12,16)}-${十六进制.slice(16,20)}-${十六进制.slice(20)}`;
}
let 题库, 答案, 存档, 当前题=0, 套题筛选='全部', 搜索词='', 复盘筛选=false, 忙=false, 提示计时;
const 转义 = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const 图标 = 名称 => `<i data-lucide="${名称}" aria-hidden="true"></i>`;
const 题目表 = new Map();
const 路由 = () => decodeURIComponent(location.hash.slice(1) || '主页').split('/');
const 导航 = (路径) => { location.hash = encodeURI(路径); };
const 图标刷新 = () => globalThis.lucide?.createIcons();
const 时间 = 秒 => `${String(Math.floor(秒/60)).padStart(2,'0')}:${String(秒%60).padStart(2,'0')}`;
const 日期 = 值 => new Date(值).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const 套题名 = 编号 => `第 ${String(编号).padStart(2,'0')} 套`;
function 提示(文字) { const el=document.querySelector('#提示'); el.textContent=文字; el.classList.add('显示');clearTimeout(提示计时);提示计时=setTimeout(()=>el.classList.remove('显示'),3500); }
function 确认(标题, 内容, 命令, 文字='确定') {
  弹窗.innerHTML=`<h2>${转义(标题)}</h2><p>${转义(内容)}</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">取消</button><button class="按钮" data-action="${命令}">${转义(文字)}</button></div>`;
  弹窗.showModal();
}
function 显示错误(错误) { console.error(错误);提示(错误.message || '操作失败，请重试。'); }
async function 载入答案() { if(!答案){ const 响应=await fetch('./答案.json');if(!响应.ok)throw new Error('答案暂时无法载入，请检查网络后重试。');答案=await 响应.json(); } return 答案; }
const 导航项=[['主页','layout-dashboard','学习主页'],['选择题','list-checks','选择题练习'],['错题本','book-open-check','我的错题'],['记录','chart-no-axes-combined','练习记录'],['兑换','gift','金币兑换'],['设置','settings-2','学习存档']];
function 外壳(主体, 页面) {
  const 激活 = ['练习','结果'].includes(页面)?'选择题':页面;
  const 项 = 导航项.find(x=>x[0]===激活);
  根.innerHTML=`<div class="壳"><aside class="侧栏"><a class="标识" href="#主页"><img src="./学习图标.png" alt=""><div><strong>升本练习室</strong><small>专升本 · 英语</small></div></a><div class="导航标题">学习空间</div><nav class="导航">${导航项.map(([页,图,名],i)=>`${i===4?'<div class="导航标题">我的成长</div>':''}<a href="#${页}" class="${激活===页?'选中':''}" ${激活===页?'aria-current="page"':''}>${图标(图)}<span>${名}</span></a>`).join('')}</nav><div class="侧栏底部">专升本英语题库<br>每一次练习，都有积累。</div></aside><div class="主区"><header class="顶栏"><div class="面包屑"><span>我的学习空间</span>${图标('chevron-right')}<strong>${项?.[2] || '专项练习'}</strong></div><div class="顶栏右"><a class="金币" href="#兑换" aria-label="金币余额 ${总金币(存档)}">${图标('coins')}<strong>${总金币(存档)}</strong><span>金币</span></a><div class="头像" title="本机学习者">学</div></div></header><main class="内容" id="主内容">${主体}</main></div><nav class="手机导航" aria-label="移动导航">${导航项.slice(0,5).map(([页,图,名])=>`<a href="#${页}" class="${激活===页?'选中':''}">${图标(图)}<span>${名.replace('学习主页','主页').replace('选择题练习','练习').replace('我的错题','错题').replace('练习记录','记录').replace('金币兑换','兑换')}</span></a>`).join('')}</nav></div>`;
  图标刷新();
}
function 页头(标题, 副标题='', 右='') { return `<div class="页头"><div><h1>${标题}</h1>${副标题?`<p class="副标题">${副标题}</p>`:''}</div>${右}</div>`; }
function 错题集合() {
  const 集合=new Map();
  for(const r of 存档.记录) for(const [i,id] of r.题目编号.entries()) { if(!r.对错[i])集合.set(id,{id,作答:r.作答[id],记录:r.编号}); }
  return [...集合.values()];
}
function 最好(编号) { const 记录=存档.记录.filter(r=>r.套题===编号); return 记录.length?Math.max(...记录.map(r=>r.分数)):null; }
function 开始按钮(套题, 小=false) { const 继续=存档.草稿?.套题===套题.编号;return `<button class="按钮 ${小?'小':'次要 小'}" data-action="开始" data-id="${套题.编号}">${继续?'继续练习':最好(套题.编号)!==null?'再练一次':'开始练习'}${图标('arrow-right')}</button>`; }
function 继续条() {const c=存档.草稿;return c?`<div class="继续条"><div><p>${套题名(c.套题)} · 进行中的练习</p><small>已完成 ${Object.keys(c.作答).length} / 25 题</small></div><a class="按钮 小" href="#练习">继续练习 ${图标('arrow-right')}</a></div>`:'';}
function 主页() {
  const 总题=存档.记录.length*25, 正确=存档.记录.reduce((n,r)=>n+r.分数/4,0), 套数=new Set(存档.记录.map(r=>r.套题)).size;
  const 指标=[['clipboard-check','累计答题',总题,'道'],['target','答题正确率',总题?Math.round(正确/总题*100):0,'%'],['layers','已完成套题',套数,'/ 15 套'],['coins','我的金币',总金币(存档),'枚']];
  const 推荐=[...题库.套题].sort((a,b)=>(最好(a.编号)!==null)-(最好(b.编号)!==null)).slice(0,4);
  return `${页头('学习主页','专升本英语 · 今天，从一套练习开始。',`<div class="日期">${图标('calendar-days')}${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</div>`)}<section class="概况">${指标.map(([图,名,值,单位])=>`<div class="指标"><div class="指标标题">${图标(图)}${名}</div><div class="指标值">${值}<small>${单位}</small></div></div>`).join('')}</section>${继续条()}<section><div class="分区头"><h2>专项练习</h2><small>选择你的练习内容</small></div><div class="分类网格">${[['选择题','list-checks','360 道题 · 15 套练习'],['完形填空','text-cursor-input','题目整理中'],['阅读理解','book-open','题目整理中'],['翻译','languages','题目整理中']].map(([名,图,说明],i)=>`<a class="分类项 ${i===0?'主分类':''}" href="#${名}" aria-label="${名}"><div class="分类图标">${图标(图)}</div><span class="分类箭头">${i===0?图标('arrow-up-right'):'<span class="徽标 灰">待开放</span>'}</span><h3>${名}</h3><p>${说明}</p></a>`).join('')}</div></section><div class="练习布局"><section><div class="分区头"><h2>推荐练习</h2><a class="按钮 轻" href="#选择题">全部套题 ${图标('arrow-right')}</a></div><table class="表格"><thead><tr><th>练习套题</th><th class="手机隐藏">题量 / 满分</th><th>完成奖励</th><th></th></tr></thead><tbody>${推荐.map(s=>`<tr><td><span class="序列">${String(s.编号).padStart(2,'0')}</span><strong>选择题 · ${s.名称}</strong><small>${s.复习数?'10 道新题 + 15 道复习题':'词汇与语法综合练习'}</small></td><td class="手机隐藏">25 题 / 100 分</td><td><span class="徽标 金">+25 金币</span></td><td>${开始按钮(s,true)}</td></tr>`).join('')}</tbody></table></section><aside class="首页侧"><div class="分区头"><h2>本次题库</h2><span class="徽标">已整理</span></div><img class="来源图片" src="./题库封面.jpg" alt="本次专升本英语题库的纸质教材照片"><h3 class="来源标题">历年真题与模拟练习</h3><p class="来源数字">48 张原始照片 · 360 道选择题<br>中文解析已收录</p><div class="知识标签"><span>词汇辨析</span><span>时态语态</span><span>从句</span><span>非谓语</span></div><a class="按钮 轻 小" href="#选择题">进入题库 ${图标('arrow-right')}</a></aside></div><div class="奖励条">${图标('award')}<div><h3>完成一套，积累 25 金币</h3><p>每次完成并提交均可获得，重复练习同样计入。</p></div></div><p class="文末">升本练习室 · 专注每一道题</p>`;
}
function 选择题页() {
  const 列表=题库.套题.filter(s=>{const 分=最好(s.编号);return (套题筛选==='全部'||(套题筛选==='未完成'?分===null:分!==null))&&(!搜索词||`${s.名称} ${s.编号} ${s.题目编号.map(id=>题目表.get(id).来源).join(' ')}`.includes(搜索词));});
  return `${页头('选择题练习','360 道选择题 · 每套 25 道 · 每题 4 分 · 满分 100 分')} ${继续条()}<div class="工具栏"><div class="分段" role="tablist" aria-label="套题筛选">${['全部','未完成','已完成'].map(x=>`<button role="tab" aria-selected="${套题筛选===x}" class="${套题筛选===x?'当前':''}" data-action="筛选" data-value="${x}">${x}${x==='全部'?' 15':''}</button>`).join('')}</div><label class="搜索">${图标('search')}<span class="无障碍">搜索套题或年份</span><input id="搜索套题" value="${转义(搜索词)}" placeholder="搜索套题或年份"></label></div><div class="套题列表">${列表.map(s=>{const 分=最好(s.编号); const 来自=[...new Set(s.题目编号.slice(0,s.新题数).map(id=>题目表.get(id).来源))];return `<article class="套题项"><div class="套题项头"><h3>${s.名称}</h3><span class="徽标 ${分===null?'灰':''}">${分===null?'未完成':'已完成'}</span></div><p class="套题来源">${来自.join(' / ')}</p><div class="套题信息"><span>25 道选择题</span><span>满分 100 分</span><span class="对">+25 金币</span></div>${s.复习数?'<div class="警告">10 道新题 + 15 道复习题</div>':''}<div class="套题项脚"><small>${分===null?'尚未提交':`最高 ${分} 分`}</small>${开始按钮(s)}</div></article>`;}).join('')}</div>${列表.length?'':'<div class="空状态"><h2>暂无匹配的套题</h2></div>'}`;
}
function 答题卡(草稿, 记录) {
  const 数=Object.keys(草稿.作答).length;
  return `<aside class="答题卡"><h3>答题卡 <small>${记录?'25 / 25':`${数} / 25`}</small></h3><div class="进度条"><div style="width:${数*4}%"></div></div><div class="题号网格">${草稿.题目编号.map((id,i)=>{const 状态=记录?(记录.对错[i]?'正确':'错误'):(草稿.作答[id]?'已答':'未答');return `<button class="题号 ${状态} ${i===当前题?'当前':''} ${(草稿.标记||[]).includes(id)?'标记':''}" data-action="跳题" data-index="${i}" aria-label="第 ${i+1} 题，${状态}${i===当前题?'，当前题':''}" ${i===当前题?'aria-current="step"':''}>${i+1}</button>`;}).join('')}</div><div class="图例">${记录?'<span><b class="色点 绿"></b>正确</span><span><b class="色点 红"></b>错误</span>':'<span><b class="色点 选"></b>已答</span><span><b class="色点"></b>未答</span>'}<span>描边：当前题</span></div>${记录?`<button class="按钮 次要 满" data-action="再练" data-id="${记录.套题}">${图标('rotate-ccw')}再练一套</button><a class="按钮 轻 满" href="#选择题">返回套题</a>`:`<button class="按钮 满" data-action="提交检查">${图标('send')}提交试卷</button><p class="侧说明">已作答 ${数} 题 · 还剩 ${25-数} 题<br>完成提交后获得 25 金币</p>`}</aside>`;
}
function 练习页(记录) {
  const c=记录||存档.草稿;
  if(!c)return `<div class="空状态">${图标('notebook-pen')}<h2>还没有进行中的练习</h2><p>选择一套题，开始本次练习。</p><a class="按钮" href="#选择题">选择套题</a></div>`;
  当前题=Math.max(0,Math.min(24,当前题));
  const q=题目表.get(c.题目编号[当前题]), a=答案?.[q.编号], 已选=c.作答[q.编号], 收藏=存档.收藏.includes(q.编号);
  return `<div class="练习头"><div><a class="按钮 轻 小" href="#选择题">${图标('arrow-left')}选择题练习</a><h1>${套题名(c.套题)}${记录?' · 答题报告':''}</h1></div><div class="计时">${图标('clock-3')}<span id="计时">${时间(记录?记录.用时:Math.floor((Date.now()-c.开始时间)/1000))}</span></div></div>${记录?`<section class="成绩条"><div class="成绩数字">${记录.分数}<small> / 100 分</small></div><div class="成绩概述"><strong>答对 ${记录.分数/4} 题，答错 ${25-记录.分数/4} 题</strong><p>${日期(记录.提交时间)} · 每题 4 分</p></div><div class="成绩奖励">${图标('coins')}本次已获得 25 金币</div></section><div class="工具栏"><div class="分段"><button class="${!复盘筛选?'当前':''}" data-action="复盘筛选" data-value="全部">全部题目</button><button class="${复盘筛选?'当前':''}" data-action="复盘筛选" data-value="错题">只看错题 · ${25-记录.分数/4}</button></div><a class="按钮 轻 小" href="#记录">全部记录 ${图标('arrow-right')}</a></div>`:''}<div class="答题布局"><article class="试题"><div class="题目头"><strong>第 ${String(当前题+1).padStart(2,'0')} 题 / 25</strong><span>单项选择 · 4 分</span></div><p class="题干" lang="en">${转义(q.题干)}</p><div class="选项组" role="group" aria-label="答案选项">${q.选项.map((选项,i)=>{const 字=字母[i], 正确=记录&&a.正确选项.includes(字), 错=记录&&已选===字&&!正确;return `<button class="选项 ${已选===字?'已选':''} ${正确?'正确':''} ${错?'错误':''}" data-action="选答案" data-value="${字}" aria-pressed="${已选===字}" ${记录?'disabled':''}><span class="选项字母">${字}</span><span class="选项内容" lang="en">${转义(选项)}</span>${记录&&正确?`<small>正确答案</small>${图标('check')}`:错?`<small>你的答案</small>${图标('x')}`:已选===字?图标('check'):''}</button>`;}).join('')}</div>${记录?`<section class="解析"><h3>答案与解析</h3><div class="答案对照"><span class="${记录.对错[当前题]?'对':'错'}">你的答案：<strong>${已选}</strong></span><span class="对">正确答案：<strong>${a.正确选项.join(' 或 ')}</strong></span></div><span class="徽标">${转义(a.考点)}</span><p>${转义(a.解析)}</p><p><small>出处：${转义(q.来源)} · 原题 ${q.原题号}</small></p></section>`:''}<div class="题目操作"><button class="按钮 次要" data-action="翻题" data-step="-1" ${当前题===0?'disabled':''}>${图标('chevron-left')}上一题</button><div class="按钮组"><button class="图标按钮" data-action="收藏" aria-label="${收藏?'取消收藏':'收藏本题'}" title="${收藏?'取消收藏':'收藏本题'}" aria-pressed="${收藏}">${图标('bookmark')}</button>${!记录?`<button class="图标按钮" data-action="标记" aria-label="标记稍后检查" title="标记稍后检查" aria-pressed="${c.标记.includes(q.编号)}">${图标('flag')}</button>`:''}</div><button class="按钮 ${当前题===24?'次要':''}" data-action="${当前题===24&&!记录?'提交检查':'翻题'}" data-step="1" ${当前题===24&&记录?'disabled':''}>${当前题===24&&!记录?'提交试卷':'下一题'}${图标('chevron-right')}</button></div></article>${答题卡(c,记录)}</div>`;
}
function 记录页() {
  return `${页头('练习记录','每次提交都保留分数、作答和详细解析。')}${存档.记录.length?`<div class="表格容器"><table class="表格"><thead><tr><th>套题</th><th>分数</th><th class="手机隐藏">用时</th><th>金币</th><th>提交时间</th><th></th></tr></thead><tbody>${[...存档.记录].reverse().map(r=>`<tr><td><strong>${套题名(r.套题)}</strong></td><td class="${r.分数>=60?'对':'错'}"><strong>${r.分数}</strong></td><td class="手机隐藏">${时间(r.用时)}</td><td>+25</td><td><small>${日期(r.提交时间)}</small></td><td><a class="按钮 轻 小" href="#结果/${r.编号}">查看 ${图标('arrow-right')}</a></td></tr>`).join('')}</tbody></table></div>`:`<div class="空状态">${图标('chart-no-axes-combined')}<h2>第一份成绩，等待你的完成</h2><p>完成一套选择题后，成绩会记录在这里。</p><a class="按钮" href="#选择题">开始练习 ${图标('arrow-right')}</a></div>`}`;
}
function 错题页() {
  const 错题=错题集合(), 收藏=路由()[1]==='收藏', 列表=收藏?存档.收藏.map(id=>({id})):错题;
  return `${页头('我的错题','回到不熟悉的知识点，把每一次错误变成积累。')}<div class="工具栏"><div class="分段"><button class="${!收藏?'当前':''}" data-action="错题筛选" data-value="错题">错题 ${错题.length}</button><button class="${收藏?'当前':''}" data-action="错题筛选" data-value="收藏">收藏 ${存档.收藏.length}</button></div></div>${列表.length?列表.map(item=>{const q=题目表.get(item.id);return `<article class="错题行"><div class="错题行头"><span class="徽标 ${收藏?'':'红'}">${收藏?'已收藏':'曾答错'}</span><span>${转义(q.来源)} · 第 ${q.原题号} 题</span></div><p class="题干">${转义(q.题干)}</p><button class="按钮 轻 小" data-action="展开解析" data-id="${q.编号}">查看答案解析 ${图标('chevron-down')}</button>${item.记录?`<a class="按钮 轻 小" href="#结果/${item.记录}/${q.编号}">回看作答 ${图标('arrow-up-right')}</a>`:''}<div id="解析-${q.编号}"></div></article>`;}).join(''):`<div class="空状态">${图标(收藏?'bookmark':'book-open-check')}<h2>${收藏?'还没有收藏的题目':'暂时没有错题'}</h2><p>${收藏?'练习时可收藏需要反复复习的题目。':'提交练习后，答错的题目会汇总到这里。'}</p><a class="按钮" href="#选择题">前往练习</a></div>`}`;
}
function 兑换页() {return `${页头('金币兑换','把练习的积累，留给下一份奖励。')}<section class="余额区">${图标('coins')}<div><div class="余额数">${总金币(存档)}</div><small>可用金币</small></div><div style="margin-left:auto"><span class="徽标 金">每次完成 +25</span></div></section><div class="分区头"><h2>兑换物品</h2><span class="徽标 灰">待上架</span></div><div class="兑换空">${图标('gift')}<h3>物品正在准备中</h3><p>金币会保留，物品确定后即可兑换。</p></div><div class="分区头"><h2>金币明细</h2><small>${存档.记录.length} 笔奖励</small></div>${存档.记录.length?`<table class="表格"><tbody>${[...存档.记录].reverse().slice(0,20).map(r=>`<tr><td><strong>完成${套题名(r.套题)}</strong><small>${日期(r.提交时间)}</small></td><td class="对" style="text-align:right">+25 金币</td></tr>`).join('')}</tbody></table>`:'<p class="副标题">还没有金币记录，完成一套练习即可获得第一笔金币。</p>'}`;}
function 设置页() {return `${页头('学习存档','管理你的答题进度、练习记录和收藏。')}<div class="设置行"><div><h3>当前存档</h3><p>${存档.记录.length} 次练习 · ${总金币(存档)} 金币 · ${存档.收藏.length} 道收藏</p></div><span class="徽标">云端同步</span></div><div class="设置行"><div><h3>备份与迁移</h3><p>登录同一账号后，答题进度、记录、收藏和金币会在不同设备间同步；导出存档可作为额外备份。</p></div><div class="按钮组"><button class="按钮 次要" data-action="导出">${图标('download')}导出存档</button><button class="按钮 次要" data-action="导入">${图标('upload')}导入存档</button><input type="file" id="导入文件" accept=".json,application/json" class="隐"></div></div><div class="设置行"><div><h3>练习奖励</h3><p>每次答完 25 题并提交，奖励 25 金币。同一次提交只入账一次；开始新一轮练习后可以再次获得。</p></div></div><div class="设置行"><div><h3>题库说明</h3><p>48 张照片整理为 360 道题，原手写答案与批注已移除。答案和中文解析按语法语义重新编写。<br>最后一套含 10 道新题和 15 道复习题；有歧义的原题在解析中说明，合理答案均可得分。</p></div></div><div class="警告">退出账号后，本机仍会保留当前账号的离线缓存；重新登录同一账号会读取云端较新的存档。</div>`;}
let 渲染序号=0;
async function 渲染() {
  const 序号=++渲染序号,[页,id,qid]=路由();
  try {
    if(页==='结果') await 载入答案();
    if(序号!==渲染序号)return;
    let 主体;
    if(页==='主页')主体=主页();
    else if(页==='选择题')主体=选择题页();
    else if(页==='练习')主体=练习页();
    else if(页==='结果'){const r=存档.记录.find(r=>r.编号===id);if(qid&&r)当前题=Math.max(0,r.题目编号.indexOf(qid));主体=r?练习页(r):'<div class="空状态"><h2>没有找到这份答题记录</h2><p>记录可能位于另一个设备或浏览器。</p><a class="按钮" href="#记录">返回记录</a></div>';}
    else if(页==='记录')主体=记录页();else if(页==='错题本')主体=错题页();else if(页==='兑换')主体=兑换页();else if(页==='设置')主体=设置页();
    else if(['完形填空','阅读理解','翻译'].includes(页))主体=`${页头(页)}<div class="空状态">${图标(页==='翻译'?'languages':'book-open')}<h2>${页} · 待开放</h2><p>本次先开放选择题练习，此分类的题目还在准备中。</p><a class="按钮" href="#选择题">练习选择题 ${图标('arrow-right')}</a></div>`;
    else {导航('主页');return;}
    外壳(主体,页);document.title=`${页==='结果'?'答题报告':页} · 升本练习室`;
  } catch(e){显示错误(e);外壳(`<div class="空状态"><h2>页面暂时无法打开</h2><p>${转义(e.message)}</p><button class="按钮" data-action="重试">重新载入</button><a class="按钮 轻" href="#主页">返回主页</a></div>`,页);}
}
async function 开始(编号, 强制=false) {
  const 套=题库.套题.find(s=>s.编号===Number(编号));if(!套)return;
  if(存档.草稿?.套题===套.编号&&!强制){当前题=存档.草稿.当前题||0;导航('练习');return;}
  if(存档.草稿&&!强制){确认('开始另一套练习？','当前未提交的作答将被新练习替换，已提交的成绩和金币会保留。',`替换-${编号}`,'开始新练习');return;}
  const 新草稿={编号:新编号(),套题:套.编号,题目编号:套.题目编号,作答:{},标记:[],当前题:0,开始时间:Date.now()};
  存档=await 更新(s=>({...s,草稿:新草稿}));当前题=0;复盘筛选=false;导航('练习');await 渲染();
}
async function 提交() {
  if(忙)return;忙=true;
  const c=存档.草稿;
  try {
    if(!c)throw new Error('没有可提交的练习。');
    await 载入答案();const 成绩=评分(c.题目编号,c.作答,答案);
    const 记录={...c,...成绩,用时:Math.max(0,Math.floor((Date.now()-c.开始时间)/1000)),提交时间:Date.now()};
    存档=await 更新(s=>{if(s.记录.some(r=>r.编号===c.编号))return s;if(s.草稿?.编号!==c.编号)throw new Error('练习已在另一个页面更新，请重新打开。');if(JSON.stringify(s.草稿.作答)!==JSON.stringify(c.作答))throw new Error('作答已在另一个页面更改，请刷新后再提交。');return {...s,记录:[...s.记录,记录],草稿:null};});
    弹窗.close();当前题=0;复盘筛选=false;导航(`结果/${c.编号}`);提示('提交成功，已获得 25 金币。');
  } catch(e){显示错误(e);} finally{忙=false;}
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
  const 行为=b.dataset.action;
  try{
    if(行为==='关闭'){弹窗.close();return;}
    if(行为==='开始'||行为==='再练'){await 开始(b.dataset.id);return;}
    if(行为.startsWith('替换-')){弹窗.close();await 开始(行为.split('-')[1],true);return;}
    if(行为==='筛选'){套题筛选=b.dataset.value;await 渲染();return;}
    if(行为==='错题筛选'){导航(b.dataset.value==='收藏'?'错题本/收藏':'错题本');return;}
    if(行为==='重试'){await 渲染();return;}
    if(行为==='提交确认'){await 提交();return;}
    if(行为==='提交检查'){
      const c=存档.草稿;if(!c)return;const 漏题=c.题目编号.map((id,i)=>c.作答[id]?null:i).filter(i=>i!==null);
      if(漏题.length){当前题=漏题[0];提示(`还剩 ${漏题.length} 道题未作答，已跳到第 ${当前题+1} 题。`);await 渲染();document.querySelector('.试题')?.scrollIntoView({block:'start'});return;}
      确认('提交这套试卷？','25 道题已全部完成。提交后查看分数、正确答案与解析，并获得 25 金币。','提交确认','提交并评分');return;
    }
    const [页,记录id]=路由(),r=页==='结果'?存档.记录.find(x=>x.编号===记录id):null,c=r||存档.草稿;
    if(行为==='选答案'&&页==='练习'&&c){const id=c.题目编号[当前题],值=b.dataset.value;if(!字母.includes(值))return;存档=await 更新(s=>{if(s.草稿?.编号!==c.编号)throw new Error('这轮练习已结束，请重新打开。');return {...s,草稿:{...s.草稿,作答:{...s.草稿.作答,[id]:值},当前题}};});await 渲染();return;}
    if(行为==='跳题'||行为==='翻题'||行为==='复盘筛选'){
      if(!c)return;
      if(行为==='复盘筛选'){if(b.dataset.value==='错题'&&r.分数===100){提示('本套全部答对，没有错题。');return;}复盘筛选=b.dataset.value==='错题';当前题=复盘筛选?r.对错.indexOf(false):0;}
      else if(行为==='跳题'){当前题=Number(b.dataset.index);if(r&&复盘筛选&&r.对错[当前题])复盘筛选=false;}
      else {const 步=Number(b.dataset.step);let 下一个=当前题+步;while(r&&复盘筛选&&下一个>=0&&下一个<25&&r.对错[下一个])下一个+=步;if(下一个<0||下一个>24){提示(步>0?'已经是最后一道题':'已经是第一道题');return;}当前题=下一个;}
      if(页==='练习')存档=await 更新(s=>s.草稿?.编号===c.编号?{...s,草稿:{...s.草稿,当前题}}:s);
      if(页==='结果'&&路由()[2])history.replaceState(null,'',`#结果/${r.编号}`);
      await 渲染();if(innerWidth<681)document.querySelector('.试题')?.scrollIntoView({block:'start'});return;
    }
    if(行为==='收藏'&&c){const id=c.题目编号[当前题];存档=await 更新(s=>({...s,收藏:s.收藏.includes(id)?s.收藏.filter(x=>x!==id):[...s.收藏,id]}));await 渲染();return;}
    if(行为==='标记'&&页==='练习'&&c){const id=c.题目编号[当前题];存档=await 更新(s=>{if(s.草稿?.编号!==c.编号)return s;const 标记=s.草稿.标记;return {...s,草稿:{...s.草稿,标记:标记.includes(id)?标记.filter(x=>x!==id):[...标记,id]}};});await 渲染();return;}
    if(行为==='展开解析'){const id=b.dataset.id,el=document.getElementById(`解析-${id}`);if(el.innerHTML){el.innerHTML='';return;}await 载入答案();const a=答案[id],q=题目表.get(id);el.innerHTML=`<div class="错题行详情"><p class="对">正确答案：${a.正确选项.map(x=>`${x}. ${转义(q.选项[字母.indexOf(x)])}`).join(' 或 ')}</p><p>${转义(a.解析)}</p></div>`;return;}
    if(行为==='导出'){const 数据=await 读取(),url=URL.createObjectURL(new Blob([JSON.stringify({应用:'升本练习室',导出时间:Date.now(),存档:数据},null,2)],{type:'application/json;charset=utf-8'}));const 链接=document.createElement('a');链接.href=url;链接.download=`升本练习室存档-${new Date().toISOString().slice(0,10)}.json`;链接.click();setTimeout(()=>URL.revokeObjectURL(url),1000);提示('存档已导出。');return;}
    if(行为==='导入'){document.querySelector('#导入文件').click();return;}
    if(行为==='导入确认'){await 执行导入();return;}
  }catch(错误){显示错误(错误);}
});
let 搜索计时, 待导入;
document.addEventListener('input',e=>{if(e.target.id==='搜索套题'){搜索词=e.target.value;clearTimeout(搜索计时);搜索计时=setTimeout(async()=>{await 渲染();const el=document.querySelector('#搜索套题');el?.focus();el?.setSelectionRange(搜索词.length,搜索词.length);},250);}});
document.addEventListener('change',async e=>{
  if(e.target.id!=='导入文件'||!e.target.files[0])return;
  try {const f=e.target.files[0];if(f.size>20000000)throw new Error('备份文件过大。');const 数据=JSON.parse(await f.text());if(数据.应用!=='升本练习室'||数据.存档?.版本!==1||!Array.isArray(数据.存档.记录)||!Array.isArray(数据.存档.收藏))throw new Error('不是有效的升本练习室备份。');待导入=数据.存档;确认('导入学习存档？','将合并历史练习与收藏，相同记录不会重复计币。本机进行中的练习优先保留。','导入确认','合并存档');}catch(错误){显示错误(错误);}finally{e.target.value='';}
});
async function 执行导入(){
  if(!待导入||忙)return;忙=true;
  try{
    await 载入答案();const 有效记录=[];
    for(const r of 待导入.记录){const 套=题库.套题.find(s=>s.编号===r.套题);if(!套||typeof r.编号!=='string'||!r.编号.match(/^[a-zA-Z0-9-]{8,80}$/)||!r.作答||!Number.isFinite(r.提交时间)||!Number.isFinite(r.用时)||r.用时<0)throw new Error('备份中的练习记录不完整。');if(JSON.stringify(r.题目编号)!==JSON.stringify(套.题目编号))throw new Error('备份题目与当前题库不一致。');有效记录.push({编号:r.编号,套题:r.套题,题目编号:套.题目编号,作答:Object.fromEntries(套.题目编号.map(id=>[id,r.作答[id]])),提交时间:r.提交时间,用时:r.用时,...评分(套.题目编号,r.作答,答案)});}
    const 收藏=待导入.收藏.filter(id=>题目表.has(id));let 草稿=null;const d=待导入.草稿;
    if(d){const 套=题库.套题.find(s=>s.编号===d.套题);if(!套||!d.作答||!Number.isFinite(d.开始时间))throw new Error('备份草稿不完整。');草稿={编号:新编号(),套题:套.编号,题目编号:套.题目编号,作答:Object.fromEntries(Object.entries(d.作答).filter(([id,a])=>套.题目编号.includes(id)&&字母.includes(a))),标记:(d.标记||[]).filter(id=>套.题目编号.includes(id)),当前题:0,开始时间:Math.min(Date.now(),d.开始时间)};}
    存档=await 更新(s=>({...s,记录:[...new Map([...有效记录,...s.记录].map(r=>[r.编号,r])).values()].sort((a,b)=>a.提交时间-b.提交时间),收藏:[...new Set([...s.收藏,...收藏])],草稿:s.草稿||草稿}));待导入=null;弹窗.close();await 渲染();提示('存档合并完成。');
  }catch(e){显示错误(e);}finally{忙=false;}
}
window.addEventListener('hashchange',()=>{当前题=路由()[0]==='练习'?(存档.草稿?.当前题||0):0;复盘筛选=false;渲染();window.scrollTo(0,0);});
window.addEventListener('focus',async()=>{if(!存档||忙)return;try{存档=await 读取();await 渲染();}catch(e){显示错误(e);}});
setInterval(()=>{const el=document.querySelector('#计时');if(el&&路由()[0]==='练习'&&存档?.草稿)el.textContent=时间(Math.max(0,Math.floor((Date.now()-存档.草稿.开始时间)/1000)));},1000);
try{
  const 响应=await fetch('./题库.json');if(!响应.ok)throw new Error('题库加载失败。');题库=await 响应.json();题库.题目.forEach(q=>题目表.set(q.编号,q));存档=await 打开存档();当前题=存档.草稿?.当前题||0;await 渲染();
}catch(错误){根.innerHTML=`<div class="空状态"><h1>练习室暂时无法打开</h1><p>${转义(错误.message)}<br>请通过网站地址访问，并允许浏览器保存网站数据。</p><button class="按钮" onclick="location.reload()">重新加载</button></div>`;}
