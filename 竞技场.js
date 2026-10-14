// 切磋 3D 竞技场：武侠人形 + PBR + 增强 VFX + UnrealBloom。
// 参考 threejs-skills（postprocessing / lighting / materials）与
// threejs-game-skills（game-feel / aaa authoring-recipes 英雄角色）。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {云端请求} from './云端接口.js';
import {初始化认证,是否已登录} from './认证.js';

const 参数=new URLSearchParams(location.search);
const 对局编号=参数.get('id');
const 演示模式=参数.get('demo')==='1';
const 字母=['A','B','C','D'];
const $=id=>document.getElementById(id);
const 转义=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let 题库=null,答案表=null,对局=null,已播日志=0,轮询=null,答Busy=false;
let 渲染器,场景,相机,时钟,合成器,bloomPass;
let 我方角色,对方角色;
let 粒子组=[],震动=0,闪白=0,创伤=0;
const 减动=matchMedia('(prefers-reduced-motion: reduce)').matches;
const 手机=matchMedia('(max-width:640px)').matches||navigator.maxTouchPoints>1;
const 粒子上限=减动?12:(手机?28:48);

if(演示模式){启动演示();}
else if(!对局编号){显示等待('缺少对局编号','请从道友页发起或接受切磋。');}
else 启动();

function 启动演示(){
  初始化场景();
  $('等待层').hidden=true;
  $('答题面板').hidden=true;
  $('对阵名').textContent='特效演示 · 按兵器轮播';
  $('出战兵器').textContent='demo 模式';
  $('我名').textContent='青衫剑修';
  $('他名').textContent='赤衣对手';
  动画循环();
  const 序列=[
    {类型:'攻击',特效:'木剑',色:'#5eead4',伤害:12,武器:'松木剑'},
    {类型:'攻击',特效:'护腕',色:'#34d399',伤害:14,武器:'青藤护腕'},
    {类型:'攻击',特效:'灵笔',色:'#38bdf8',伤害:16,武器:'明悟灵笔'},
    {类型:'攻击',特效:'知微鉴',色:'#fbbf24',伤害:18,武器:'知微鉴'},
    {类型:'攻击',特效:'镜类',色:'#c084fc',伤害:15,武器:'照魂灯'},
    {类型:'大招',特效:'知微鉴',色:'#f59e0b',伤害:28,武器:'知微鉴'},
  ];
  let i=0;
  const 播=()=>{
    const ev=序列[i%序列.length];
    $('出战兵器').textContent=`当前：${ev.武器} · ${ev.类型}`;
    触发特效({...ev,谁:'demo'}, true);
    i++;
  };
  播();
  setInterval(播, 2400);
  window.__vfxIndex=()=>i;
}

async function 启动(){
  try{
    await 初始化认证();
    if(!是否已登录()){location.replace('./login.html');return;}
    初始化场景();
    await Promise.all([载入题库(),刷新对局()]);
    $('等待层').hidden=true;
    开始轮询();
    渲染题目();
    动画循环();
  }catch(e){
    显示等待('无法进入擂台',e.message||String(e));
  }
}

function 显示等待(标题,说明){
  $('等待层').hidden=false;$('等待标题').textContent=标题;$('等待说明').textContent=说明;
}

async function 载入题库(){
  const [题,答]=await Promise.all([
    fetch('./题库.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('题库加载失败');return r.json();}),
    fetch('./答案.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('答案加载失败');return r.json();})
  ]);
  题库=new Map(题.题目.map(q=>[q.编号,q]));
  答案表=答;
}

async function 刷新对局(){
  const d=await 云端请求('/api/arena?id='+encodeURIComponent(对局编号));
  const 旧=对局;对局=d.对局;
  if(对局.状态==='待接受'){
    显示等待(对局.我是发起人?'等待对方应战…':'切磋邀请待接受',对局.我是发起人?'对方接受后将自动进入对战。':'请返回道友页点击「应战切磋」。');
    $('答题面板').hidden=true;
  }else if(对局.状态==='进行中'||对局.状态==='已结束'){
    $('等待层').hidden=true;
    更新HUD();
    播放新事件(旧);
    if(对局.状态==='已结束')显示结算();
    else 渲染题目();
  }else{
    显示等待('对局已结束',对局.状态);显示结算();
  }
}

function 开始轮询(){
  clearInterval(轮询);
  轮询=setInterval(()=>{刷新对局().catch(()=>{});},1200);
}

function 更新HUD(){
  const 他=对局.我是发起人?对局.对手:对局.发起人;
  const 我名=对局.我是发起人?对局.发起人:对局.对手;
  $('对阵名').textContent=`${我名.名称} VS ${他.名称}`;
  $('我名').textContent=我名.名称;
  $('他名').textContent=他.名称;
  $('我血').textContent=对局.我的血量;
  $('他血').textContent=对局.对方血量;
  $('我连').textContent=对局.我的连击;
  $('他连').textContent=对局.对方连击;
  $('我血条').style.width=对局.我的血量+'%';
  $('他血条').style.width=对局.对方血量+'%';
  const 武=对局.我的武器;
  $('出战兵器').textContent=`出战 · ${武.名称}`;
  $('出战兵器').style.borderColor=武.色||'#5eead4';
}

function 播放新事件(旧){
  const 日志=对局.回合日志||[];
  if(已播日志>日志.length)已播日志=0;
  for(let i=已播日志;i<日志.length;i++){
    const ev=日志[i];
    const 从左打右 = ev.谁 === 对局.我的手机号;
    触发特效(ev, 从左打右);
  }
  已播日志=日志.length;
}

function 触发特效(ev,从左打右){
  const 色=new THREE.Color(ev.色||'#5eead4');
  const 攻=从左打右?我方角色:对方角色;
  const 受=从左打右?对方角色:我方角色;
  if(!攻||!受)return;
  const 类型=ev.特效||'木剑';
  // 攻击姿势短暂前倾
  挥砍姿势(攻,从左打右);
  if(ev.类型==='大招'){
    放字(ev.武器+' · 大招！', ev.色||'#fbbf24');
    喷粒子(受.position,色,减动?14:粒子上限,2.2);
    斩击弧(攻.position,受.position,色,true);
    冲击波环(受.position,色,1.6);
    命中火花(受.position,色,减动?10:22);
    残影(攻,色);
    震动=减动?0.1:0.32;闪白=0.75;创伤=Math.min(1,创伤+0.85);
    if(bloomPass)bloomPass.strength=减动?0.55:1.35;
  }else if(ev.类型==='攻击'){
    放字((ev.伤害||0)+' !', ev.色||'#5eead4');
    喷粒子(受.position,色,减动?8:Math.min(粒子上限,28),1.25);
    按武器特效(类型,攻.position,受.position,色);
    命中火花(受.position,色,减动?6:14);
    震动=减动?0.05:0.16;闪白=0.32;创伤=Math.min(1,创伤+0.35);
  }else{
    放字('失手', '#94a3b8');
  }
  // 受击闪色
  受.traverse(o=>{
    if(o.isMesh&&o.material?.emissive){
      o.userData._em=o.material.emissive.clone();
      o.userData._emi=o.material.emissiveIntensity??0.12;
      o.material.emissive.set(色);
      o.material.emissiveIntensity=0.95;
      setTimeout(()=>{
        if(o.userData._em){
          o.material.emissive.copy(o.userData._em);
          o.material.emissiveIntensity=o.userData._emi;
        }
      },260);
    }
  });
  // 受击轻后仰
  const 基=受.userData.基旋Y??受.rotation.y;
  受.rotation.x=-0.12;
  setTimeout(()=>{受.rotation.x=0;},280);
}

function 挥砍姿势(角色,向右){
  const 剑=角色.userData.剑;
  if(!剑)return;
  const 目标Z=向右?-1.05:1.05;
  剑.rotation.z=目标Z;
  剑.rotation.x=-0.35;
  setTimeout(()=>{剑.rotation.z=角色.userData.剑闲置Z??-0.55;剑.rotation.x=0;},320);
}

function 按武器特效(类型,from,to,色){
  if(类型==='护腕'||类型==='近战')近战斩击(from,to,色);
  else if(类型==='灵笔')剑气(from,to,色);
  else if(类型==='知微鉴')光刃(from,to,色);
  else if(类型==='镜类')折射光环(to,色);
  else if(类型==='法衣'||类型==='书袋'||类型==='佩符')剑气(from,to,色);
  else 斩击弧(from,to,色,false); // 木剑默认
}

function 放字(文,色){
  const el=$('特效字');el.textContent=文;el.style.color=色;el.classList.remove('显');void el.offsetWidth;el.classList.add('显');
  setTimeout(()=>el.classList.remove('显'),700);
}

function 渲染题目(){
  if(!对局||对局.状态!=='进行中'){$('答题面板').hidden=true;return;}
  const 已答=对局.我的答卷||{};
  const 下一=对局.题目编号.find(id=>!已答[id]);
  if(!下一){
    $('答题面板').hidden=false;
    $('题进度').textContent=`已答完 ${对局.题目编号.length} 题`;
    $('题干').textContent='等待对方完成作答或血量见分晓…';
    $('选项列').innerHTML='';
    return;
  }
  const q=题库.get(下一);
  if(!q){$('题干').textContent='题目缺失，请刷新题库。';return;}
  const idx=对局.题目编号.indexOf(下一)+1;
  $('答题面板').hidden=false;
  $('题进度').textContent=`第 ${idx} / ${对局.题目编号.length} 题 · ${对局.我的武器.名称}`;
  $('题干').textContent=q.题干;
  $('选项列').innerHTML=q.选项.map((x,i)=>`<button type="button" data-opt="${字母[i]}" data-qid="${转义(下一)}"><b>${字母[i]}.</b> ${转义(x)}</button>`).join('');
}

$('选项列')?.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-opt]');if(!b||答Busy||!对局)return;
  const 选项=b.dataset.opt,题号=b.dataset.qid;
  const 正确=!!答案表[题号]?.正确选项?.includes(选项);
  答Busy=true;
  [...$('选项列').querySelectorAll('button')].forEach(x=>{x.disabled=true;if(x.dataset.opt===选项)x.classList.add(正确?'对':'错');});
  try{
    const r=await 云端请求('/api/arena',{method:'PUT',body:JSON.stringify({编号:对局编号,动作:'答题',题目编号:题号,选项,正确})});
    对局=r.对局;
    if(r.事件)触发特效(r.事件,true);
    已播日志=(对局.回合日志||[]).length;
    更新HUD();
    if(对局.状态==='已结束')显示结算();
    else setTimeout(()=>{答Busy=false;渲染题目();},450);
  }catch(err){
    答Busy=false;alert(err.message||'提交失败');渲染题目();
  }
});

function 显示结算(){
  $('结算层').hidden=false;
  const 胜=对局.胜者是我,平=!对局.胜者;
  $('结算标题').textContent=平?'平局':胜?'切磋获胜':'惜败';
  $('结算说明').textContent=`最终血量 ${对局.我的血量} : ${对局.对方血量} · 兵器 ${对局.我的武器.名称}`;
}

$('再看擂台')?.addEventListener('click',()=>{$('结算层').hidden=true;});

/* ===== 材质工具 ===== */
function 布料(色,粗糙=0.92,金属=0.02,自发光=0){
  return new THREE.MeshStandardMaterial({
    color:色,roughness:粗糙,metalness:金属,
    emissive:自发光?new THREE.Color(色):0x000000,
    emissiveIntensity:自发光
  });
}
function 皮肤(色=0xe8c4a8){
  // 轻量 SSS：略暖 emissive 模拟皮下散射
  return new THREE.MeshStandardMaterial({
    color:色,roughness:0.55,metalness:0.0,
    emissive:new THREE.Color(0xff8866),emissiveIntensity:0.08
  });
}
function 金属(色,粗糙=0.22,金属度=0.92,辉=0){
  return new THREE.MeshStandardMaterial({
    color:色,roughness:粗糙,metalness:金属度,
    emissive:辉?new THREE.Color(色):0x000000,emissiveIntensity:辉
  });
}
function 木纹(色=0x8b5a2b){
  return new THREE.MeshStandardMaterial({color:色,roughness:0.88,metalness:0.05});
}

/* ===== Three.js 场景 ===== */
function 初始化场景(){
  const canvas=$('擂台画布');
  渲染器=new THREE.WebGLRenderer({canvas,antialias:!减动,alpha:false,powerPreference:'high-performance'});
  渲染器.setPixelRatio(Math.min(devicePixelRatio,减动?1.25:(手机?1.75:2)));
  渲染器.setSize(innerWidth,innerHeight,false);
  渲染器.toneMapping=THREE.ACESFilmicToneMapping;
  渲染器.toneMappingExposure=1.05;
  渲染器.shadowMap.enabled=!手机;
  渲染器.shadowMap.type=THREE.PCFSoftShadowMap;
  渲染器.outputColorSpace=THREE.SRGBColorSpace;

  场景=new THREE.Scene();
  场景.background=new THREE.Color(0x060914);
  场景.fog=new THREE.FogExp2(0x060914,0.032);
  相机=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,0.1,100);
  相机.position.set(0,5.8,11.2);相机.lookAt(0,1.35,0);
  时钟=new THREE.Clock();

  // 电影感环境光 + rim
  场景.add(new THREE.HemisphereLight(0xb8d4ff,0x3a2210,0.42));
  const sun=new THREE.DirectionalLight(0xffe6c8,1.55);
  sun.position.set(5.5,11,3.5);
  if(!手机){
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.near=1;sun.shadow.camera.far=30;
    sun.shadow.camera.left=-10;sun.shadow.camera.right=10;
    sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
    sun.shadow.bias=-0.0008;sun.shadow.normalBias=0.03;
  }
  场景.add(sun);
  // 青绿 / 赤红轮廓光
  const rimL=new THREE.SpotLight(0x2dd4bf,3.2,35,Math.PI/5,0.45,1.4);
  rimL.position.set(-7,4.5,-1.5);rimL.target.position.set(-2.4,1.4,0);
  场景.add(rimL);场景.add(rimL.target);
  const rimR=new THREE.SpotLight(0xf43f5e,2.8,35,Math.PI/5,0.45,1.4);
  rimR.position.set(7,4.5,-1.5);rimR.target.position.set(2.4,1.4,0);
  场景.add(rimR);场景.add(rimR.target);
  // 顶光补面
  const fill=new THREE.PointLight(0xffd9a8,0.55,40);fill.position.set(0,6.5,2);场景.add(fill);

  搭建擂台();

  我方角色=造武侠角色({主色:0x14b8a6,袍色:0x0f766e,里色:0x134e4a,发色:0x1e293b,向右:true});
  我方角色.position.set(-2.55,0,0);
  我方角色.userData.基旋Y=0;
  场景.add(我方角色);

  对方角色=造武侠角色({主色:0xf43f5e,袍色:0x9f1239,里色:0x4c0519,发色:0x1c1917,向右:false});
  对方角色.position.set(2.55,0,0);
  对方角色.rotation.y=Math.PI;
  对方角色.userData.基旋Y=Math.PI;
  场景.add(对方角色);

  // 后处理 Bloom（CDN three/addons）
  try{
    合成器=new EffectComposer(渲染器);
    合成器.addPass(new RenderPass(场景,相机));
    bloomPass=new UnrealBloomPass(
      new THREE.Vector2(innerWidth,innerHeight),
      减动?0.35:(手机?0.55:0.72), // strength
      0.42, // radius
      0.82  // threshold — 只让高亮刀光/粒子 bloom
    );
    合成器.addPass(bloomPass);
    合成器.addPass(new OutputPass());
  }catch(err){
    console.warn('Bloom 不可用，回退直渲',err);
    合成器=null;bloomPass=null;
  }

  addEventListener('resize',()=>{
    相机.aspect=innerWidth/innerHeight;相机.updateProjectionMatrix();
    渲染器.setSize(innerWidth,innerHeight,false);
    合成器?.setSize(innerWidth,innerHeight);
  });
}

function 搭建擂台(){
  // 木纹色块擂台：底层圆台 + 径向木板条 + 中心垫
  const 木色=[0x6b4423,0x7a4f28,0x5c3a1e,0x8a5a30,0x4a2f16,0x704828];
  const 台=new THREE.Group();
  const 底=new THREE.Mesh(
    new THREE.CylinderGeometry(7.05,7.2,0.38,48),
    木纹(0x4a2f16)
  );
  底.position.y=0.05;底.receiveShadow=true;底.castShadow=true;台.add(底);
  // 径向木板（色块拼纹）
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2;
    const plank=new THREE.Mesh(
      new THREE.BoxGeometry(0.48,0.08,6.4),
      木纹(木色[i%木色.length])
    );
    plank.position.set(Math.cos(a)*0.15,0.28,Math.sin(a)*0.15);
    plank.rotation.y=-a;
    plank.receiveShadow=true;台.add(plank);
  }
  // 中心圆垫
  const 心=new THREE.Mesh(
    new THREE.CylinderGeometry(2.15,2.15,0.07,36),
    new THREE.MeshStandardMaterial({color:0x3f2a1a,roughness:0.72,metalness:0.1})
  );
  心.position.y=0.34;心.receiveShadow=true;台.add(心);
  // 内环暗纹
  const 内环=new THREE.Mesh(
    new THREE.TorusGeometry(2.25,0.04,8,48),
    金属(0xc4a484,0.55,0.35,0.08)
  );
  内环.rotation.x=Math.PI/2;内环.position.y=0.38;台.add(内环);
  // 金边环
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(6.55,0.075,10,72),
    金属(0xfbbf24,0.35,0.85,0.4)
  );
  ring.rotation.x=Math.PI/2;ring.position.y=0.36;台.add(ring);
  场景.add(台);

  // 石阶 / 围柱
  const 石色=[0x475569,0x526278,0x3f4b5c];
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2;
    const 柱=new THREE.Group();
    const 石=新石材(石色[i%石色.length]);
    const base=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.28,0.62),石);
    base.position.y=0.14;base.castShadow=true;base.receiveShadow=true;柱.add(base);
    const mid=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,0.85,8),石);
    mid.position.y=0.7;mid.castShadow=true;柱.add(mid);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.12,0.42),金属(0xcbd5e1,0.5,0.4,0.05));
    cap.position.y=1.18;柱.add(cap);
    柱.position.set(Math.cos(a)*6.85,0,Math.sin(a)*6.85);
    场景.add(柱);
  }
  // 远山剪影
  for(const [x,z,s,c] of [[-15,-11,1.25,0x0a1222],[13,-13,1.55,0x0c1528],[2,-17,1.9,0x08101c],[-8,-15,1.1,0x0b1320]]){
    const m=new THREE.Mesh(new THREE.ConeGeometry(3.8*s,5.2*s,5),new THREE.MeshStandardMaterial({color:c,roughness:1,metalness:0}));
    m.position.set(x,2.3*s,z);场景.add(m);
  }
  // 月光淡圈
  const moon=new THREE.Mesh(
    new THREE.SphereGeometry(0.55,16,16),
    new THREE.MeshBasicMaterial({color:0xdbeafe,transparent:true,opacity:0.55})
  );
  moon.position.set(-6,9.5,-8);场景.add(moon);
}

function 新石材(色){
  return new THREE.MeshStandardMaterial({color:色,roughness:0.92,metalness:0.08});
}

/** 武侠人形：头/发髻、分层道袍、宽袖、腿靴、持兵器 */
function 造武侠角色({主色,袍色,里色,发色,向右}){
  const g=new THREE.Group();
  const 肤=皮肤();
  const 袍=布料(袍色,0.93,0.04,0.04);
  const 里=布料(里色,0.9,0.03,0.02);
  const 发=布料(发色,0.85,0.02);
  const 靴=布料(0x1e293b,0.8,0.15);
  const 带=金属(主色,0.4,0.55,0.2);

  // —— 下肢 / 靴 ——
  for(const s of [-1,1]){
    const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(0.13,0.42,4,8),里);
    thigh.position.set(0.16*s,0.72,0);thigh.castShadow=true;g.add(thigh);
    const calf=new THREE.Mesh(new THREE.CapsuleGeometry(0.11,0.38,4,8),靴);
    calf.position.set(0.16*s,0.28,0.02);calf.castShadow=true;g.add(calf);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.12,0.32),靴);
    boot.position.set(0.16*s,0.06,0.06);boot.castShadow=true;g.add(boot);
  }

  // —— 道袍下摆（宽轮廓） ——
  const 摆=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.72,0.55,10,1,true),袍);
  摆.position.y=0.95;摆.castShadow=true;g.add(摆);
  // 内衬
  const 内摆=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.52,0.48,8,1,true),里);
  内摆.position.y=0.95;g.add(内摆);

  // —— 躯干分层 ——
  const 胸=new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.55,6,12),袍);
  胸.position.y=1.55;胸.castShadow=true;g.add(胸);
  const 领=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.04,6,16),里);
  领.position.y=1.95;领.rotation.x=Math.PI/2;g.add(领);
  // 交领装饰条
  const 交领=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.55,0.02),带);
  交领.position.set(0.08,1.55,0.30);交领.rotation.z=-0.25;g.add(交领);
  const 腰带=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.045,6,20),带);
  腰带.position.y=1.22;腰带.rotation.x=Math.PI/2;g.add(腰带);

  // —— 宽袖臂 ——
  g.userData.臂=[];
  for(const s of [-1,1]){
    const 肩=new THREE.Mesh(new THREE.SphereGeometry(0.14,10,10),袍);
    肩.position.set(0.38*s,1.78,0);肩.castShadow=true;g.add(肩);
    const 上臂=new THREE.Mesh(new THREE.CapsuleGeometry(0.11,0.32,4,8),袍);
    上臂.position.set(0.52*s,1.52,0.05);上臂.rotation.z=0.55*s;上臂.castShadow=true;g.add(上臂);
    // 宽袖筒
    const 袖=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,0.42,8,1,true),袍);
    袖.position.set(0.68*s,1.28,0.08);袖.rotation.z=0.7*s;袖.castShadow=true;g.add(袖);
    const 前臂=new THREE.Mesh(new THREE.CapsuleGeometry(0.08,0.28,4,8),肤);
    前臂.position.set(0.82*s,1.05,0.12);前臂.rotation.z=0.35*s;前臂.castShadow=true;g.add(前臂);
    g.userData.臂.push({上臂,袖,前臂,s});
  }

  // —— 头 / 发髻 / 发带 ——
  const 头=new THREE.Mesh(new THREE.SphereGeometry(0.26,18,16),肤);
  头.position.y=2.22;头.castShadow=true;g.add(头);
  // 发顶
  const 发顶=new THREE.Mesh(new THREE.SphereGeometry(0.27,14,12,0,Math.PI*2,0,Math.PI*0.55),发);
  发顶.position.y=2.28;发顶.rotation.x=0.08;g.add(发顶);
  // 发髻
  const 髻=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,10),发);
  髻.position.y=2.52;g.add(髻);
  const 髻冠=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,0.08,8),金属(主色,0.35,0.7,0.25));
  髻冠.position.y=2.62;g.add(髻冠);
  // 发带飘带
  const 带左=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.35,0.01),布料(主色,0.7,0.1,0.15));
  带左.position.set(-0.12,2.42,-0.05);带左.rotation.z=0.35;g.add(带左);
  const 带右=带左.clone();带右.position.x=0.12;带右.rotation.z=-0.35;g.add(带右);
  g.userData.发带=[带左,带右];

  // 眉眼简化（可读轮廓）
  for(const s of [-1,1]){
    const 眉=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.015,0.02),发);
    眉.position.set(0.09*s,2.28,0.22);眉.rotation.z=-0.15*s;g.add(眉);
    const 眼=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,8),new THREE.MeshStandardMaterial({color:0x0f172a,roughness:0.3,metalness:0.1}));
    眼.position.set(0.09*s,2.22,0.23);g.add(眼);
  }

  // —— 兵器（右手侧，按向右调整） ——
  const 剑=造兵器(主色);
  const 手侧=向右?1:-1;
  剑.position.set(0.95*手侧,1.15,0.18);
  剑.rotation.z=向右?-0.55:0.55;
  g.add(剑);
  g.userData.剑=剑;
  g.userData.剑闲置Z=剑.rotation.z;
  g.userData.主色=主色;
  g.userData.呼吸相位=Math.random()*Math.PI*2;

  return g;
}

function 造兵器(辉色){
  const 剑=new THREE.Group();
  // 刃
  const blade=new THREE.Mesh(
    new THREE.BoxGeometry(0.07,1.15,0.028),
    金属(0xe8eef7,0.18,0.95,0.22)
  );
  blade.position.y=0.62;blade.castShadow=true;剑.add(blade);
  // 刃尖
  const tip=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.18,6),金属(0xf1f5f9,0.15,0.95,0.3));
  tip.position.y=1.28;剑.add(tip);
  // 血槽高光条
  const groove=new THREE.Mesh(
    new THREE.BoxGeometry(0.012,0.9,0.03),
    new THREE.MeshStandardMaterial({color:辉色,emissive:辉色,emissiveIntensity:0.55,roughness:0.3,metalness:0.6})
  );
  groove.position.y=0.62;剑.add(groove);
  // 护手
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.05,0.08),金属(0xcbd5e1,0.35,0.8,0.1));
  guard.position.y=0.08;剑.add(guard);
  // 柄
  const hilt=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.32,8),木纹(0x5c3a1e));
  hilt.position.y=-0.1;剑.add(hilt);
  // 柄头
  const pommel=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),金属(辉色,0.3,0.75,0.35));
  pommel.position.y=-0.28;剑.add(pommel);
  return 剑;
}

/* ===== VFX ===== */
function 喷粒子(pos,色,数量,速度){
  const n=Math.min(数量,粒子上限);
  const geo=new THREE.BufferGeometry();
  const posArr=new Float32Array(n*3),vel=[];
  for(let i=0;i<n;i++){
    posArr[i*3]=pos.x+(Math.random()-0.5)*0.2;
    posArr[i*3+1]=pos.y+1.35+(Math.random()-0.5)*0.3;
    posArr[i*3+2]=pos.z+(Math.random()-0.5)*0.2;
    vel.push(new THREE.Vector3(
      (Math.random()-0.5)*速度*1.4,
      (Math.random()*0.9+0.25)*速度,
      (Math.random()-0.5)*速度*1.4
    ));
  }
  geo.setAttribute('position',new THREE.BufferAttribute(posArr,3));
  const mat=new THREE.PointsMaterial({
    color:色,size:减动?0.1:0.16,transparent:true,opacity:0.95,
    depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true
  });
  const pts=new THREE.Points(geo,mat);场景.add(pts);
  粒子组.push({pts,vel,life:0.75});
}

function 命中火花(pos,色,数量){
  const n=Math.min(数量,粒子上限);
  const geo=new THREE.BufferGeometry();
  const arr=new Float32Array(n*3),vel=[];
  for(let i=0;i<n;i++){
    arr[i*3]=pos.x;arr[i*3+1]=pos.y+1.4;arr[i*3+2]=pos.z;
    const sp=1.8+Math.random()*2.2;
    const th=Math.random()*Math.PI*2;
    vel.push(new THREE.Vector3(Math.cos(th)*sp,Math.random()*sp*0.9,Math.sin(th)*sp));
  }
  geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const mat=new THREE.PointsMaterial({
    color:色,size:减动?0.08:0.12,transparent:true,opacity:1,
    depthWrite:false,blending:THREE.AdditiveBlending
  });
  const pts=new THREE.Points(geo,mat);场景.add(pts);
  粒子组.push({pts,vel,life:0.45,gravity:5});
}

function 冲击波环(pos,色,尺度=1){
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(0.35*尺度,0.045,8,48),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  ring.position.copy(pos);ring.position.y+=1.25;ring.rotation.x=Math.PI/2;
  场景.add(ring);
  粒子组.push({mesh:ring,life:0.55,fade:true,expand:2.8*尺度});
}

function 残影(角色,色){
  if(减动)return;
  const clone=角色.clone(true);
  clone.traverse(o=>{
    if(o.isMesh){
      o.material=new THREE.MeshBasicMaterial({
        color:色,transparent:true,opacity:0.35,depthWrite:false,blending:THREE.AdditiveBlending
      });
    }
  });
  clone.position.copy(角色.position);
  clone.rotation.copy(角色.rotation);
  场景.add(clone);
  粒子组.push({mesh:clone,life:0.4,fade:true,ghost:true});
}

function 斩击弧(from,to,色,大){
  const midY=大?3.4:2.5;
  const curve=new THREE.QuadraticBezierCurve3(
    from.clone().add(new THREE.Vector3(0,1.55,0.2)),
    new THREE.Vector3((from.x+to.x)/2,midY,大?1.6:1.0),
    to.clone().add(new THREE.Vector3(0,1.35,0.1))
  );
  // 主刃光
  const tube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,大?28:18,大?0.16:0.07,8,false),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  场景.add(tube);
  粒子组.push({mesh:tube,life:大?0.65:0.38,fade:true});
  // 拖尾细管
  if(!减动){
    const trail=new THREE.Mesh(
      new THREE.TubeGeometry(curve,大?24:14,大?0.28:0.14,6,false),
      new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false})
    );
    场景.add(trail);
    粒子组.push({mesh:trail,life:大?0.5:0.28,fade:true});
  }
  if(大){
    冲击波环(to,色,1.2);
    冲击波环(to,色,1.9);
  }
}

function 近战斩击(from,to,色){
  // 短弧 + 冲击
  const curve=new THREE.QuadraticBezierCurve3(
    from.clone().add(new THREE.Vector3(0.3,1.4,0.3)),
    new THREE.Vector3((from.x+to.x)/2,2.0,0.8),
    to.clone().add(new THREE.Vector3(0,1.3,0))
  );
  const tube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,12,0.09,8,false),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.88,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  场景.add(tube);
  粒子组.push({mesh:tube,life:0.32,fade:true});
  冲击波环(to,色,0.7);
  喷粒子(to,色,减动?8:16,1.5);
}

function 剑气(from,to,色){
  const dir=to.clone().sub(from);const len=dir.length();dir.normalize();
  // 主束
  const geo=new THREE.CylinderGeometry(0.06,0.02,len,8);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false}));
  mesh.position.copy(from).add(to).multiplyScalar(0.5);mesh.position.y+=1.35;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
  场景.add(mesh);粒子组.push({mesh,life:0.42,fade:true});
  // 外层拖尾
  if(!减动){
    const outer=new THREE.Mesh(
      new THREE.CylinderGeometry(0.14,0.04,len*0.95,8),
      new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.28,blending:THREE.AdditiveBlending,depthWrite:false})
    );
    outer.position.copy(mesh.position);outer.quaternion.copy(mesh.quaternion);
    场景.add(outer);粒子组.push({mesh:outer,life:0.35,fade:true});
  }
  喷粒子(to,色,减动?10:20,1.35);
  冲击波环(to,色,0.55);
}

function 光刃(from,to,色){
  剑气(from,to,色);
  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(0.85,0.06,8,40),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  ring.position.copy(to);ring.position.y+=1.4;ring.rotation.x=Math.PI/2;
  场景.add(ring);
  粒子组.push({mesh:ring,life:0.55,fade:true,spin:true,expand:1.6});
  // 竖立光刃片
  const blade=new THREE.Mesh(
    new THREE.PlaneGeometry(0.15,1.6),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})
  );
  blade.position.copy(to);blade.position.y+=1.5;
  场景.add(blade);
  粒子组.push({mesh:blade,life:0.4,fade:true});
}

function 折射光环(to,色){
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(0.45+i*0.38,0.035,8,48),
      new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.75-i*0.18,blending:THREE.AdditiveBlending,depthWrite:false})
    );
    ring.position.copy(to);ring.position.y+=1.3;ring.rotation.x=Math.PI/2+i*0.18;
    场景.add(ring);
    粒子组.push({mesh:ring,life:0.7,fade:true,spin:true,expand:1.4+i*0.3});
  }
  // 镜面闪光球
  const flash=new THREE.Mesh(
    new THREE.SphereGeometry(0.25,12,12),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.65,blending:THREE.AdditiveBlending,depthWrite:false})
  );
  flash.position.copy(to);flash.position.y+=1.35;
  场景.add(flash);
  粒子组.push({mesh:flash,life:0.35,fade:true,expand:2.2});
  喷粒子(to,色,减动?12:Math.min(粒子上限,32),1.7);
}

function 动画循环(){
  requestAnimationFrame(动画循环);
  const dt=Math.min(0.05,时钟.getDelta());
  const t=时钟.elapsedTime;

  // 待机呼吸 / 持剑晃动 / 发带轻摆
  for(const 角 of [我方角色,对方角色]){
    if(!角)continue;
    const ph=角.userData.呼吸相位||0;
    const breath=Math.sin(t*2.1+ph)*0.035;
    角.position.y=breath;
    角.scale.y=1+breath*0.35;
    角.scale.x=1-breath*0.12;
    角.scale.z=1-breath*0.12;
    if(角.userData.剑){
      const idle=角.userData.剑闲置Z??-0.55;
      角.userData.剑.rotation.z=idle+Math.sin(t*2.6+ph)*0.07;
      角.userData.剑.rotation.x=Math.sin(t*1.8+ph)*0.04;
    }
    if(角.userData.发带){
      for(const b of 角.userData.发带){
        b.rotation.x=Math.sin(t*3+ph)*0.15;
      }
    }
  }

  // 粒子 / 特效寿命
  for(let i=粒子组.length-1;i>=0;i--){
    const p=粒子组[i];p.life-=dt;
    if(p.pts){
      const arr=p.pts.geometry.attributes.position.array;
      const g=p.gravity??2.8;
      for(let j=0;j<p.vel.length;j++){
        arr[j*3]+=p.vel[j].x*dt;
        arr[j*3+1]+=p.vel[j].y*dt;
        arr[j*3+2]+=p.vel[j].z*dt;
        p.vel[j].y-=g*dt;
      }
      p.pts.geometry.attributes.position.needsUpdate=true;
      p.pts.material.opacity=Math.max(0,p.life*1.2);
    }
    if(p.mesh){
      if(p.fade){
        const mats=p.ghost
          ? (()=>{const list=[];p.mesh.traverse(o=>{if(o.isMesh&&o.material)list.push(o.material);});return list;})()
          : [p.mesh.material];
        for(const m of mats){if(m)m.opacity=Math.max(0,p.life*(p.ghost?0.9:2));}
      }
      if(p.spin)p.mesh.rotation.z+=dt*5;
      if(p.expand){
        const s=1+(1-Math.max(0,p.life))*p.expand*0.35;
        p.mesh.scale.setScalar(s);
      }
    }
    if(p.life<=0){
      const obj=p.pts||p.mesh;
      场景.remove(obj);
      if(p.ghost){obj.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
      else{obj.geometry?.dispose();obj.material?.dispose();}
      粒子组.splice(i,1);
    }
  }

  // 创伤衰减相机震动（game-feel trauma²）
  if(创伤>0)创伤=Math.max(0,创伤-dt*1.5);
  const shake=创伤*创伤;
  const baseY=5.8,baseZ=11.2;
  if(shake>0.002||震动>0){
    震动=Math.max(0,震动-dt);
    const amp=0.45*shake+震动;
    相机.position.x=(Math.random()-0.5)*amp;
    相机.position.y=baseY+(Math.random()-0.5)*amp*0.6;
    相机.position.z=baseZ+(Math.random()-0.5)*amp*0.25;
    相机.rotation.z=(Math.random()-0.5)*amp*0.08;
  }else{
    相机.position.x=THREE.MathUtils.lerp(相机.position.x,0,0.12);
    相机.position.y=THREE.MathUtils.lerp(相机.position.y,baseY,0.12);
    相机.position.z=THREE.MathUtils.lerp(相机.position.z,baseZ,0.12);
    相机.rotation.z=THREE.MathUtils.lerp(相机.rotation.z,0,0.15);
  }

  // 曝光闪白 + bloom 回落
  if(闪白>0){
    闪白=Math.max(0,闪白-dt*1.6);
    渲染器.toneMappingExposure=1.05+闪白*1.6;
  }else{
    渲染器.toneMappingExposure=THREE.MathUtils.lerp(渲染器.toneMappingExposure,1.05,0.08);
  }
  if(bloomPass){
    const 目标=减动?0.35:(手机?0.55:0.72);
    bloomPass.strength=THREE.MathUtils.lerp(bloomPass.strength,目标,0.06);
  }

  if(合成器)合成器.render();
  else 渲染器.render(场景,相机);
}
