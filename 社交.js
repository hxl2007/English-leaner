// 道友模块：排行榜、好友、论道（异步 PK）。论道成绩只记入云端对战表，不改变练习存档与金币。
import {云端请求} from './云端接口.js';
const 转义=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const 图标=x=>`<i data-lucide="${x}" aria-hidden="true"></i>`;
const 字母=['A','B','C','D'],论道题数=10,论道键='升本练习室_论道';
const 日期=n=>n?new Date(n).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const 时长=毫秒=>{const s=Math.max(0,Math.round(毫秒/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
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

export async function 社交页面(子页='排行榜',{快照,索引}={}){
  if(子页==='答题')return 答题页(索引);
  if(快照)推送社交统计(快照).catch(()=>{});
  const 资料=await 云端请求('/api/social');
  const 页签=[['排行榜','排行榜',0],['好友','好友',资料.待处理好友],['论道','论道',资料.待应战]];
  let 正文;
  if(子页==='好友')正文=好友区(await 云端请求('/api/friends'));
  else if(子页==='论道')正文=论道区(await 云端请求('/api/pk'));
  else 正文=排行区(await 云端请求(`/api/leaderboard?榜=${encodeURIComponent(榜单类型)}&范围=${encodeURIComponent(榜单范围)}`),资料.profile);
  return `<div class="页头"><div><h1>道友</h1><p class="副标题">与同修切磋，比一比修为、战力与金币。你的道友码：<code class="道友码">${转义(资料.profile.用户键)}</code></p></div><button class="按钮 次要" data-action="道友刷新">${图标('refresh-cw')}刷新</button></div>${论道?`<div class="继续条"><div><p>论道进行中 · 对阵 ${转义(论道.对手.名称)}</p><small>已作答 ${Object.keys(论道.作答).length} / ${论道题数}</small></div><a class="按钮 小" href="#道友/答题">继续答题 ${图标('arrow-right')}</a></div>`:''}<nav class="分段 道友页签">${页签.map(([k,名,数])=>`<a href="#道友/${k}" class="${子页===k?'当前':''}">${名}${数?`<span class="徽标 红 小徽标">${数}</span>`:''}</a>`).join('')}</nav>${正文}`;
}
function 排行区(榜,我){
  const 列=榜单类型;
  return `<section class="道友卡"><div class="分区头"><div class="道友切换"><div class="按钮组">${['修为','战力','金币'].map(k=>`<button class="按钮 小 ${榜单类型===k?'':'次要'}" data-action="榜单类型" data-value="${k}">${k}榜</button>`).join('')}</div><div class="按钮组">${['全站','好友'].map(k=>`<button class="按钮 小 ${榜单范围===k?'':'次要'}" data-action="榜单范围" data-value="${k}">${k}</button>`).join('')}</div></div><p class="副标题">${榜.范围==='全站'?(榜.我公开?`共 ${榜.总人数} 位公开道友，你排第 ${榜.我的名次} 名。`:'你已关闭公开排行，全站榜不显示你的名次。'):`好友榜共 ${榜.总人数} 人${榜.我的名次?`，你排第 ${榜.我的名次} 名`:''}。`}</p></div>${榜.items.length?`<div class="表格容器"><table class="表格 道友表格"><thead><tr><th>名次</th><th>道友</th><th>${列}</th><th class="手机隐藏">答题数</th><th class="手机隐藏">正确率</th><th></th></tr></thead><tbody>${榜.items.map(x=>`<tr class="${x.是我?'是我':''}"><td>${x.名次<=3?`<span class="名次 名次${x.名次}">${x.名次}</span>`:x.名次}</td><td>${转义(x.名称)} <small>· ${转义(x.尾号)}</small>${x.是我?'<span class="徽标 小徽标">我</span>':''}</td><td><strong>${x[列]}</strong></td><td class="手机隐藏">${x.答题数}</td><td class="手机隐藏">${x.正确率}%</td><td>${x.是我||x.是好友?'':`<button class="按钮 轻 小" data-action="加好友" data-target="${转义(x.用户键)}">加好友</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="空状态"><h2>榜上还没有人</h2><p>完成一次练习后，你的修为就会出现在这里。</p></div>'}</section><section class="道友卡"><div class="分区头"><div><h2>隐私设置</h2><p class="副标题">关闭公开排行后，只有好友榜能看到你；关闭好友申请后，其他人无法向你发送申请。</p></div></div><div class="道友开关组"><label class="道友开关"><input type="checkbox" data-action="隐私开关" data-key="公开排行" ${我.公开排行?'checked':''}><span>公开排行</span></label><label class="道友开关"><input type="checkbox" data-action="隐私开关" data-key="允许好友" ${我.允许好友?'checked':''}><span>允许好友申请</span></label></div></section>`;
}
function 好友区(d){
  const 人=x=>`<div><p>${转义(x.名称)} <small>· ${转义(x.尾号)}</small></p><small>修为 ${x.修为} · 战力 ${x.战力} · 金币 ${x.金币}</small></div>`;
  return `<section class="道友卡"><div class="分区头"><div><h2>添加好友</h2><p class="副标题">输入对方的手机号或道友码。对方同意后即可互相查看好友榜并论道。</p></div></div><form id="加好友表单" class="道友表单"><input name="目标" placeholder="手机号或 12 位道友码" required maxlength="20" autocomplete="off"><button class="按钮" type="submit">${图标('user-plus')}发送申请</button><p data-form-error role="alert"></p></form></section>${d.收到.length?`<section class="道友卡"><div class="分区头"><div><h2>收到的申请</h2></div></div>${d.收到.map(x=>`<div class="设置行 道友行">${人(x)}<div class="按钮组"><button class="按钮 小" data-action="好友处理" data-id="${x.编号}" data-act="接受">接受</button><button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="拒绝">拒绝</button></div></div>`).join('')}</section>`:''}<section class="道友卡"><div class="分区头"><div><h2>我的好友</h2><p class="副标题">共 ${d.好友.length} 位</p></div></div>${d.好友.length?d.好友.map(x=>`<div class="设置行 道友行">${人(x)}<div class="按钮组"><button class="按钮 小" data-action="发起论道" data-target="${转义(x.用户键)}" data-name="${转义(x.名称)}">${图标('swords')}论道</button><button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="删除">删除</button></div></div>`).join(''):'<div class="空状态"><h2>还没有好友</h2><p>可以在排行榜里直接点“加好友”。</p></div>'}</section>${d.发出.length?`<section class="道友卡"><div class="分区头"><div><h2>等待对方确认</h2></div></div>${d.发出.map(x=>`<div class="设置行 道友行">${人(x)}<button class="按钮 小 次要" data-action="好友处理" data-id="${x.编号}" data-act="删除">撤回</button></div>`).join('')}</section>`:''}`;
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
export async function 社交动作(b,{弹窗,提示,渲染,导航,题库,索引,载入答案}){
  const 行=b.dataset.action;
  if(!行||!/^(道友刷新|榜单类型|榜单范围|加好友|隐私开关|好友处理|发起论道|确认发起论道|应战|拒绝论道|放弃论道|确认放弃论道|论道跳题|论道选答案|论道翻题|论道提交|确认论道提交)$/.test(行))return false;
  if(行==='道友刷新'){await 渲染();提示('已刷新。');return true;}
  if(行==='榜单类型'){榜单类型=b.dataset.value;await 渲染();return true;}
  if(行==='榜单范围'){榜单范围=b.dataset.value;await 渲染();return true;}
  if(行==='加好友'){const r=await 云端请求('/api/friends',{method:'POST',body:JSON.stringify({目标:b.dataset.target})});提示(r.message||'好友申请已发送。');await 渲染();return true;}
  if(行==='隐私开关'){const 键=b.dataset.key,值=b.checked;try{await 云端请求('/api/social',{method:'PUT',body:JSON.stringify({设置:{[键]:值}})});提示(`${键}已${值?'开启':'关闭'}。`);}catch(e){b.checked=!值;throw e;}return true;}
  if(行==='好友处理'){await 云端请求('/api/friends',{method:'PUT',body:JSON.stringify({编号:b.dataset.id,动作:b.dataset.act})});提示({接受:'已成为好友。',拒绝:'已拒绝该申请。',删除:'已删除。'}[b.dataset.act]);await 渲染();return true;}
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
