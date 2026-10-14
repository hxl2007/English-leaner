// 道友模块：排行榜、好友、论道（异步 PK）、切磋（实时竞技场）。论道/切磋成绩不改练习存档与金币。
import {云端请求} from './云端接口.js';
const 转义=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const 图标=x=>`<i data-lucide="${x}" aria-hidden="true"></i>`;
const 字母=['A','B','C','D'],论道题数=10,论道键='升本练习室_论道';
const 日期=n=>n?new Date(n).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const 相对活跃=n=>{
  if(!n)return '暂无活跃记录';
  const d=Date.now()-Number(n);
  if(d<5*60000)return '刚刚活跃';
  if(d<60*60000)return `${Math.floor(d/60000)} 分钟前活跃`;
  if(d<24*3600000)return `${Math.floor(d/3600000)} 小时前活跃`;
  if(d<7*24*3600000)return `${Math.floor(d/86400000)} 天前活跃`;
  return '较久未活跃';
};
const 活跃徽标=n=>{
  const d=Date.now()-Number(n||0);
  if(d<15*60000)return '<span class="状态点 在线" title="最近活跃"></span><span class="徽标 绿 小徽标">最近活跃</span>';
  if(d<24*3600000)return '<span class="状态点 今日"></span><span class="徽标 小徽标">今日活跃</span>';
  return '<span class="状态点 离线"></span><span class="徽标 灰 小徽标">暂离</span>';
};

const 时长=毫秒=>{const s=Math.max(0,Math.round(毫秒/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};

let 切磋轮询=null;
export function 停止切磋轮询(){clearInterval(切磋轮询);切磋轮询=null;}
function 启动切磋轮询(){
  停止切磋轮询();
  切磋轮询=setInterval(async()=>{
    try{
      const s=await 云端请求('/api/social');
      if(s.进行中竞技场){停止切磋轮询();location.href='./竞技场.html?id='+encodeURIComponent(s.进行中竞技场);}
    }catch{}
  },2000);
}

let 榜单类型='修为',榜单范围='全站',上次快照='',上次推送=0,论道=读取论道(),计时器;

function 读取论道(){try{const v=JSON.parse(sessionStorage.getItem(论道键)||'null');return v&&Array.isArray(v.题目编号)?v:null;}catch{return null;}}
function 保存论道(v){论道=v;if(v)sessionStorage.setItem(论道键,JSON.stringify(v));else sessionStorage.removeItem(论道键);}

// 把本机统计快照推送到云端；内容未变化或 30 秒内已推送过则跳过。
export async function 推送社交统计(快照,强制=false){
  const 串=JSON.stringify(快照);
  if(!强制&&(串===上次快照||Date.now()-上次推送<30000))return false;
  if(串===上次快照&&Date.now()-上次推送<5000)return false;
  await 云端请求('/api/social',{method:'PUT',body:JSON.stringify({统计:快照})});
  上次快照=串;上次推送=Date.now();return true;
}

export async function 社交页面(子页='排行榜',{快照,索引,出战武器}={}){
  if(子页==='答题')return 答题页(索引);
  if(快照)推送社交统计(快照).catch(()=>{});
  const 资料=await 云端请求('/api/social');
  if(资料.进行中竞技场&&子页!=='切磋'){
    // 进行中的切磋：提示条引导进竞技场（接受后也会自动跳转）
  }
  const 页签=[['排行榜','排行榜',0],['好友','好友',资料.待处理好友],['论道','论道',资料.待应战],['切磋','切磋',资料.待切磋]];
  let 正文;
  if(子页==='好友')正文=好友区(await 云端请求('/api/friends'),出战武器);
  else if(子页==='论道')正文=论道区(await 云端请求('/api/pk'));
  else if(子页==='切磋')正文=切磋区(await 云端请求('/api/arena'),出战武器);
  else 正文=排行区(await 云端请求(`/api/leaderboard?榜=${encodeURIComponent(榜单类型)}&范围=${encodeURIComponent(榜单范围)}`),资料.profile);
  if(资料.进行中竞技场){停止切磋轮询();} else if(子页==='切磋')启动切磋轮询(); else 停止切磋轮询();
  const 竞技场条=资料.进行中竞技场?`<div class="继续条 切磋条"><div><p>切磋进行中</p><small>点击进入网页 3D 竞技场继续对战</small></div><a class="按钮 小" href="./竞技场.html?id=${encodeURIComponent(资料.进行中竞技场)}">进入竞技场 ${图标('swords')}</a></div>`:'';
  return `<div class="页头"><div><h1>道友</h1><p class="副标题">与同修论道、切磋。你的道友码：<code class="道友码">${转义(资料.profile.用户键)}</code></p></div><button class="按钮 次要" data-action="道友刷新">${图标('refresh-cw')}刷新</button></div>${竞技场条}${论道?`<div class="继续条"><div><p>论道进行中 · 对阵 ${转义(论道.对手.名称)}</p><small>已作答 ${Object.keys(论道.作答).length} / ${论道题数}</small></div><a class="按钮 小" href="#道友/答题">继续答题 ${图标('arrow-right')}</a></div>`:''}<nav class="分段 道友页签">${页签.map(([k,名,数])=>`<a href="#道友/${k}" class="${子页===k?'当前':''}">${名}${数?`<span class="徽标 红 小徽标">${数}</span>`:''}</a>`).join('')}</nav>${正文}`;
}
function 排行区(榜,我){
  const 列=榜单类型;
  return `<section class="道友卡"><div class="分区头"><div class="道友切换"><div class="按钮组">${['修为','战力','金币'].map(k=>`<button class="按钮 小 ${榜单类型===k?'':'次要'}" data-action="榜单类型" data-value="${k}">${k}榜</button>`).join('')}</div><div class="按钮组">${['全站','好友'].map(k=>`<button class="按钮 小 ${榜单范围===k?'':'次要'}" data-action="榜单范围" data-value="${k}">${k}</button>`).join('')}</div></div><p class="副标题">${榜.范围==='全站'?(榜.我公开?`共 ${榜.总人数} 位公开道友，你排第 ${榜.我的名次} 名。`:'你已关闭公开排行，全站榜不显示你的名次。'):`好友榜共 ${榜.总人数} 人${榜.我的名次?`，你排第 ${榜.我的名次} 名`:''}。`}</p></div>${榜.items.length?`<div class="表格容器"><table class="表格 道友表格"><thead><tr><th>名次</th><th>道友</th><th>${列}</th><th class="手机隐藏">答题数</th><th class="手机隐藏">正确率</th><th></th></tr></thead><tbody>${榜.items.map(x=>`<tr class="${x.是我?'是我':''}"><td>${x.名次<=3?`<span class="名次 名次${x.名次}">${x.名次}</span>`:x.名次}</td><td>${转义(x.名称)} <small>· ${转义(x.尾号)}</small>${x.是我?'<span class="徽标 小徽标">我</span>':''}</td><td><strong>${x[列]}</strong></td><td class="手机隐藏">${x.答题数}</td><td class="手机隐藏">${x.正确率}%</td><td>${x.是我||x.是好友?'':`<button class="按钮 轻 小" data-action="加好友" data-target="${转义(x.用户键)}">加好友</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="空状态"><h2>榜上还没有人</h2><p>完成一次练习后，你的修为就会出现在这里。</p></div>'}</section><section class="道友卡"><div class="分区头"><div><h2>隐私设置</h2><p class="副标题">关闭公开排行后，只有好友榜能看到你；关闭好友申请后，其他人无法向你发送申请。</p></div></div><div class="道友开关组"><label class="道友开关"><input type="checkbox" data-action="隐私开关" data-key="公开排行" ${我.公开排行?'checked':''}><span>公开排行</span></label><label class="道友开关"><input type="checkbox" data-action="隐私开关" data-key="允许好友" ${我.允许好友?'checked':''}><span>允许好友申请</span></label></div></section>`;
}
function 好友区(d,出战武器){
  const 武名=出战武器?.名称||'青芒木剑';
  const 人=x=>`<div class="道友名片"><div class="道友名片头"><strong>${转义(x.名称)}</strong><small>· ${转义(x.尾号)}</small>${活跃徽标(x.更新时间)}</div><p class="道友数据">修为 ${x.修为} · 战力 ${x.战力} · 金币 ${x.金币}</p><small class="活跃说明">${相对活跃(x.更新时间)}</small></div>`;
  return `<section class="道友卡"><div class="分区头"><div><h2>添加好友</h2><p class="副标题">输入对方的手机号或道友码。成为好友后可论道（异步）或切磋（实时 3D 竞技场）。</p></div></div><form id="加好友表单" class="道友表单"><input name="目标" placeholder="手机号或 12 位道友码" required maxlength="20" autocomplete="off"><button class="按钮" type="submit">${图标('user-plus')}发送申请</button><p data-form-error role="alert"></p></form></section>
${d.收到.length?`<section class="道友卡 申请卡"><div class="分区头"><div><h2>收到的申请</h2><p class="副标题">有人想与你结为道友</p></div><span class="徽标 红">${d.收到.length}</span></div>${d.收到.map(x=>`<div class="设置行 道友行 申请行">${人(x)}<div class="按钮组"><button class="按钮 小 醒目" data-action="好友处理" data-id="${x.编号}" data-act="接受">${图标('user-check')}接受</button><button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="拒绝">拒绝</button></div></div>`).join('')}</section>`:''}
<section class="道友卡"><div class="分区头"><div><h2>我的好友</h2><p class="副标题">共 ${d.好友.length} 位 · 出战兵器：${转义(武名)}</p></div></div>
${d.好友.length?`<div class="好友网格">${d.好友.map(x=>`<article class="好友卡">${人(x)}<div class="按钮组 好友动作"><button class="按钮 小" data-action="发起论道" data-target="${转义(x.用户键)}" data-name="${转义(x.名称)}">${图标('scroll')}论道</button><button class="按钮 小 醒目" data-action="发起切磋" data-target="${转义(x.用户键)}" data-name="${转义(x.名称)}">${图标('swords')}切磋</button><button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="删除">删除</button></div></article>`).join('')}</div>`:'<div class="空状态 空状态大"><div class="空图标" aria-hidden="true">☯</div><h2>还没有好友</h2><p>在排行榜点「加好友」，或上方输入道友码发送申请。</p><a class="按钮" href="#道友/排行榜">去排行榜看看</a></div>'}
</section>
${d.发出.length?`<section class="道友卡"><div class="分区头"><div><h2>等待对方确认</h2></div></div>${d.发出.map(x=>`<div class="设置行 道友行">${人(x)}<button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="删除">撤回</button></div>`).join('')}</section>`:''}`;
}
function 切磋区(d,出战武器){
  const 武=出战武器||{名称:'青芒木剑',特效:'木剑'};
  const 行=x=>{
    const 对方=x.我是发起人?x.对手:x.发起人;
    return `<div class="设置行 道友行 切磋行"><div class="道友名片"><div class="道友名片头"><strong>${转义(对方.名称)}</strong><small>· ${转义(对方.尾号)}</small></div><small>${日期(x.更新时间||x.创建时间)} · ${x.状态==='进行中'?`血量 ${x.我的血量} : ${x.对方血量}`:x.状态}</small></div><div class="按钮组">${
      x.状态==='待接受'&&!x.我是发起人?`<button class="按钮 小 醒目" data-action="接受切磋" data-id="${x.编号}">${图标('swords')}应战切磋</button><button class="按钮 小 次要" data-action="拒绝切磋" data-id="${x.编号}">婉拒</button>`:
      x.状态==='进行中'?`<a class="按钮 小 醒目" href="./竞技场.html?id=${encodeURIComponent(x.编号)}">进入竞技场</a>`:
      x.状态==='待接受'?`<span class="徽标">等待应战</span>`:
      `<span class="徽标 ${x.胜者是我?'':x.胜者?'红':'灰'}">${x.胜者是我?'胜':x.胜者?'负':x.状态}</span>`
    }</div></div>`;
  };
  return `<section class="道友卡"><div class="分区头"><div><h2>实时切磋</h2><p class="副标题">与好友同答 ${论道题数} 道单选；答对发动兵器特效攻击。连击满 3 放大招。出战：${转义(武.名称)}。接受后自动进入 3D 竞技场。</p></div><a class="按钮" href="#道友/好友">${图标('swords')}找好友切磋</a></div></section>
${d.待接受?.length?`<section class="道友卡 申请卡"><div class="分区头"><div><h2>等你应战</h2></div><span class="徽标 红">${d.待接受.length}</span></div>${d.待接受.map(行).join('')}</section>`:''}
${d.进行中?.length?`<section class="道友卡"><div class="分区头"><div><h2>进行中</h2></div></div>${d.进行中.map(行).join('')}</section>`:''}
${d.已发出?.length?`<section class="道友卡"><div class="分区头"><div><h2>已发出邀请</h2></div></div>${d.已发出.map(行).join('')}</section>`:''}
<section class="道友卡"><div class="分区头"><div><h2>最近切磋</h2></div></div>${d.已结束?.length?d.已结束.map(行).join(''):'<div class="空状态 空状态大"><div class="空图标" aria-hidden="true">⚔</div><h2>还没有切磋记录</h2><p>从好友列表点「切磋」，对方接受后会进入网页 3D 擂台。</p></div>'}</section>`;
}
function 论道区(d){
  const 对方=x=>x.我是发起人?x.对手:x.发起人;
  const 成绩=x=>{const 我分=x.我是发起人?x.发起人分数:x.对手分数,他分=x.我是发起人?x.对手分数:x.发起人分数,我时=x.我是发起人?x.发起人用时:x.对手用时,他时=x.我是发起人?x.对手用时:x.发起人用时;return `我 ${我分}/${论道题数} · ${时长(我时)}　对方 ${他分}/${论道题数} · ${时长(他时)}`;};
  return `<section class="道友卡"><div class="分区头"><div><h2>论道</h2><p class="副标题">与好友同答 ${论道题数} 道单选：先比答对数，再比用时。对方 7 天内可应战，成绩不计金币。</p></div><a class="按钮" href="#道友/好友">${图标('swords')}找好友论道</a></div></section>${d.收到.length?`<section class="道友卡"><div class="分区头"><div><h2>等你应战</h2></div></div>${d.收到.map(x=>`<div class="设置行 道友行"><div><p>${转义(x.发起人.名称)} 向你发起论道</p><small>${日期(x.创建时间)} · 对方已完成作答</small></div><div class="按钮组"><button class="按钮 小" data-action="应战" data-id="${x.编号}">应战</button><button class="按钮 小 次要" data-action="拒绝论道" data-id="${x.编号}">婉拒</button></div></div>`).join('')}</section>`:''}${d.发出.length?`<section class="道友卡"><div class="分区头"><div><h2>等待对方应战</h2></div></div>${d.发出.map(x=>`<div class="设置行 道友行"><div><p>对阵 ${转义(x.对手.名称)}</p><small>${日期(x.创建时间)} · 你答对 ${x.发起人分数}/${论道题数}，用时 ${时长(x.发起人用时)}</small></div><span class="徽标">等待应战</span></div>`).join('')}</section>`:''}<section class="道友卡"><div class="分区头"><div><h2>最近战绩</h2></div></div>${d.已结束.length?d.已结束.map(x=>`<div class="设置行 道友行"><div><p>对阵 ${转义(对方(x).名称)} ${x.状态==='已结束'?`<span class="徽标 ${x.结果==='胜'?'':x.结果==='负'?'红':'灰'}">${x.结果}</span>`:`<span class="徽标 灰">${x.状态}</span>`}</p><small>${日期(x.更新时间)}${x.状态==='已结束'?' · '+成绩(x):''}</small></div></div>`).join(''):'<div class="空状态"><h2>还没有战绩</h2><p>从好友列表发起第一场论道吧。</p></div>'}</section>`;
}
function 答题页(索引){
  if(!论道)return '<div class="空状态"><h2>没有进行中的论道</h2><a class="按钮" href="#道友/论道">返回论道</a></div>';
  const i=论道.当前,id=论道.题目编号[i],q=索引?.题目.get(id),已答=Object.keys(论道.作答).length;
  启动计时();
  if(!q)return '<div class="空状态"><h2>题目缺失</h2><p>题库版本不一致，请刷新页面后重试。</p><button class="按钮 次要" data-action="放弃论道">放弃本局</button></div>';
  return `<div class="页头"><div><h1>论道 · 对阵 ${转义(论道.对手.名称)}</h1><p class="副标题">第 ${i+1} / ${论道题数} 题 · 已作答 ${已答} 题 · 用时 <span id="论道计时">${时长(Date.now()-论道.开始时间)}</span></p></div><button class="按钮 次要 小" data-action="放弃论道">放弃</button></div><div class="题号网格 论道题号">${论道.题目编号.map((x,n)=>`<button class="题号 ${论道.作答[x]?'已答':''} ${n===i?'当前':''}" data-action="论道跳题" data-index="${n}">${n+1}</button>`).join('')}</div><section class="论道题"><p class="题干" lang="en">${转义(q.题干)}</p><div class="论道选项">${q.选项.map((x,n)=>`<button class="选项 ${论道.作答[id]===字母[n]?'已选':''}" data-action="论道选答案" data-value="${字母[n]}" aria-pressed="${论道.作答[id]===字母[n]}"><span class="选项字母">${字母[n]}</span><span class="选项内容" lang="en">${转义(x)}</span></button>`).join('')}</div><div class="按钮组 论道操作"><button class="按钮 次要" data-action="论道翻题" data-step="-1" ${i===0?'disabled':''}>上一题</button>${i<论道题数-1?`<button class="按钮" data-action="论道翻题" data-step="1">下一题</button>`:''}<button class="按钮 ${已答===论道题数?'':'次要'}" data-action="论道提交" ${已答===论道题数?'':'disabled'}>${图标('flag')}交卷</button></div></section>`;
}
function 启动计时(){clearInterval(计时器);计时器=setInterval(()=>{const el=document.querySelector('#论道计时');if(el&&论道)el.textContent=时长(Date.now()-论道.开始时间);else clearInterval(计时器);},1000);}
function 抽题(题库){
  const 池=题库.题目.filter(q=>(q.题型||'单选')==='单选'&&q.可抽取!==false&&Array.isArray(q.选项)&&q.选项.length===4&&!q.旧版);
  if(池.length<论道题数)throw new Error('单选题库不足，无法论道。');
  const 选=[];const 用=new Set();while(选.length<论道题数){const q=池[Math.floor(Math.random()*池.length)];if(用.has(q.编号))continue;用.add(q.编号);选.push(q.编号);}
  return 选;
}
function 开始论道(模式,对手,题目编号,编号,索引){
  for(const id of 题目编号)if(!索引.题目.has(id))throw new Error('题库版本不一致，请刷新页面后再试。');
  保存论道({模式,对手,编号:编号||null,题目编号,作答:{},当前:0,开始时间:Date.now()});
}
export async function 社交动作(b,{弹窗,提示,渲染,导航,题库,索引,载入答案,出战武器}){
  const 行=b.dataset.action;
  if(!行||!/^(道友刷新|榜单类型|榜单范围|加好友|隐私开关|好友处理|发起论道|确认发起论道|应战|拒绝论道|放弃论道|确认放弃论道|论道跳题|论道选答案|论道翻题|论道提交|确认论道提交|发起切磋|确认发起切磋|接受切磋|拒绝切磋)$/.test(行))return false;
  if(行==='道友刷新'){await 渲染();提示('已刷新。');return true;}
  if(行==='榜单类型'){榜单类型=b.dataset.value;await 渲染();return true;}
  if(行==='榜单范围'){榜单范围=b.dataset.value;await 渲染();return true;}
  if(行==='加好友'){const r=await 云端请求('/api/friends',{method:'POST',body:JSON.stringify({目标:b.dataset.target})});提示(r.message||'好友申请已发送。');await 渲染();return true;}
  if(行==='隐私开关'){const 键=b.dataset.key,值=b.checked;try{await 云端请求('/api/social',{method:'PUT',body:JSON.stringify({设置:{[键]:值}})});提示(`${键}已${值?'开启':'关闭'}。`);}catch(e){b.checked=!值;throw e;}return true;}
  if(行==='好友处理'){await 云端请求('/api/friends',{method:'PUT',body:JSON.stringify({编号:b.dataset.id,动作:b.dataset.act})});提示({接受:'已成为好友。',拒绝:'已拒绝该申请。',删除:'已删除。'}[b.dataset.act]);await 渲染();return true;}
  if(行==='发起切磋'){
    const 武=出战武器||{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};
    弹窗.innerHTML=`<h2>向 ${转义(b.dataset.name)} 发起切磋</h2><p>双方同答 ${论道题数} 道单选。答对发动「${转义(武.名称)}」特效攻击对方；连击 ≥3 放大招。对方接受后<strong>自动进入 3D 竞技场</strong>。</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">取消</button><button class="按钮 醒目" data-action="确认发起切磋" data-target="${转义(b.dataset.target)}" data-name="${转义(b.dataset.name)}">发出切磋</button></div>`;弹窗.showModal();return true;}
  if(行==='确认发起切磋'){
    弹窗.close();
    const 武=出战武器||{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};
    const 题目编号=抽题(题库);
    const r=await 云端请求('/api/arena',{method:'POST',body:JSON.stringify({对手:b.dataset.target,题目编号,武器:武})});
    提示(r.message||'切磋邀请已发出，等待对方应战。');启动切磋轮询();导航('道友/切磋');return true;}
  if(行==='接受切磋'){
    const 武=出战武器||{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};
    const r=await 云端请求('/api/arena',{method:'PUT',body:JSON.stringify({编号:b.dataset.id,动作:'接受',武器:武})});
    提示('切磋开始，正在进入竞技场…');
    location.href=`./竞技场.html?id=${encodeURIComponent(r.对局?.编号||b.dataset.id)}`;
    return true;}
  if(行==='拒绝切磋'){await 云端请求('/api/arena',{method:'PUT',body:JSON.stringify({编号:b.dataset.id,动作:'拒绝'})});提示('已婉拒切磋。');await 渲染();return true;}
  if(行==='发起论道'){if(论道){提示('先完成或放弃当前进行中的论道。');导航('道友/答题');return true;}弹窗.innerHTML=`<h2>向 ${转义(b.dataset.name)} 发起论道</h2><p>系统随机抽取 ${论道题数} 道单选题，你先作答并计时；对方 7 天内用同一套题应战。先比答对数，再比用时。</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">取消</button><button class="按钮" data-action="确认发起论道" data-target="${转义(b.dataset.target)}" data-name="${转义(b.dataset.name)}">开始作答</button></div>`;弹窗.showModal();return true;}
  if(行==='确认发起论道'){弹窗.close();开始论道('发起',{用户键:b.dataset.target,名称:b.dataset.name},抽题(题库),null,索引);导航('道友/答题');return true;}
  if(行==='应战'){if(论道){提示('先完成或放弃当前进行中的论道。');导航('道友/答题');return true;}const d=await 云端请求('/api/pk'),x=d.收到.find(y=>y.编号===b.dataset.id);if(!x)throw new Error('这局论道已不存在，请刷新。');开始论道('应战',{用户键:x.发起人.用户键,名称:x.发起人.名称},x.题目编号,x.编号,索引);导航('道友/答题');return true;}
  if(行==='拒绝论道'){await 云端请求('/api/pk',{method:'PUT',body:JSON.stringify({编号:b.dataset.id,动作:'拒绝'})});提示('已婉拒。');await 渲染();return true;}
  if(行==='放弃论道'){弹窗.innerHTML=`<h2>放弃本局论道？</h2><p>${论道?.模式==='应战'?'放弃后这局仍会保留在“等你应战”里，可以稍后重新应战。':'放弃后不会向对方发起挑战。'}</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">继续答题</button><button class="按钮" data-action="确认放弃论道">放弃</button></div>`;弹窗.showModal();return true;}
  if(行==='确认放弃论道'){弹窗.close();保存论道(null);导航('道友/论道');return true;}
  if(!论道){导航('道友/论道');return true;}
  if(行==='论道跳题'){论道.当前=Number(b.dataset.index);保存论道(论道);await 渲染();return true;}
  if(行==='论道翻题'){论道.当前=Math.max(0,Math.min(论道题数-1,论道.当前+Number(b.dataset.step)));保存论道(论道);await 渲染();return true;}
  if(行==='论道选答案'){论道.作答[论道.题目编号[论道.当前]]=b.dataset.value;if(论道.当前<论道题数-1)论道.当前++;保存论道(论道);await 渲染();return true;}
  if(行==='论道提交'){if(Object.keys(论道.作答).length<论道题数){提示('还有题目没有作答。');return true;}弹窗.innerHTML=`<h2>确认交卷？</h2><p>交卷后成绩将发送给 ${转义(论道.对手.名称)}，用时 ${时长(Date.now()-论道.开始时间)}。</p><div class="按钮组"><button class="按钮 次要" data-action="关闭">再检查一下</button><button class="按钮" data-action="确认论道提交">交卷</button></div>`;弹窗.showModal();return true;}
  if(行==='确认论道提交'){
    弹窗.close();const 答案=await 载入答案();const 当前=论道;
    const 明细=当前.题目编号.map(id=>({id,我选:当前.作答[id],正确:答案[id]?.正确选项||[],对:!!答案[id]?.正确选项?.includes(当前.作答[id])}));
    const 分数=明细.filter(x=>x.对).length,用时=Math.min(3600000,Math.max(0,Date.now()-当前.开始时间));
    let 结果;
    if(当前.模式==='应战')结果=(await 云端请求('/api/pk',{method:'PUT',body:JSON.stringify({编号:当前.编号,动作:'应战',分数,用时})})).对战;
    else await 云端请求('/api/pk',{method:'POST',body:JSON.stringify({对手:当前.对手.用户键,模块:'单选',题目编号:当前.题目编号,分数,用时})});
    保存论道(null);clearInterval(计时器);
    const 错题=明细.filter(x=>!x.对);
    弹窗.innerHTML=`<div class="升级提示">${图标('swords')}<p>${结果?`本局${结果.结果==='胜'?'获胜':结果.结果==='负'?'惜败':'平局'}`:'挑战已发出'}</p><h2>${分数} / ${论道题数}</h2><p>用时 ${时长(用时)}${结果?` · 对方 ${结果.发起人分数} / ${论道题数}，用时 ${时长(结果.发起人用时)}`:'，等待对方应战'}</p>${错题.length?`<p class="论道错题">答错：${错题.map((x,n)=>`第 ${当前.题目编号.indexOf(x.id)+1} 题（正确 ${x.正确.join('/')}）`).join('，')}</p>`:'<p>全部答对！</p>'}<button class="按钮 满" data-action="关闭">知道了</button></div>`;弹窗.showModal();globalThis.lucide?.createIcons();
    导航('道友/论道');return true;
  }
  return false;
}
export async function 提交社交表单(e,{提示,渲染}){
  const f=e.target;if(f.id!=='加好友表单')return false;e.preventDefault();
  const b=f.querySelector('[type="submit"]'),错误=f.querySelector('[data-form-error]');if(b.disabled)return true;b.disabled=true;错误.textContent='';
  try{const r=await 云端请求('/api/friends',{method:'POST',body:JSON.stringify({目标:String(new FormData(f).get('目标')||'').trim()})});提示(r.message||'好友申请已发送。');await 渲染();}
  catch(err){错误.textContent=err.message;}finally{b.disabled=false;}
  return true;
}
export function 论道进行中(){return !!论道;}
