// 切磋 3D 竞技场：Three.js CDN + Worker /api/arena 轮询同步。
// VFX 参考 threejs-game-skills（game-feel / bloom 思路）与 threejs-skills lighting。
import * as THREE from 'three';
import {云端请求} from './云端接口.js';
import {初始化认证,是否已登录} from './认证.js';

const 参数=new URLSearchParams(location.search);
const 对局编号=参数.get('id');
const 字母=['A','B','C','D'];
const $=id=>document.getElementById(id);
const 转义=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let 题库=null,答案表=null,对局=null,已播日志=0,轮询=null,答Busy=false;
let 渲染器,场景,相机,时钟,我方角色,对方角色,粒子组=[],震动=0,闪白=0;
const 减动=matchMedia('(prefers-reduced-motion: reduce)').matches;

if(!对局编号){显示等待('缺少对局编号','请从道友页发起或接受切磋。');}
else 启动();

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
  if(ev.类型==='大招'){
    放字(ev.武器+' · 大招！', ev.色||'#fbbf24');
    喷粒子(受.position,色,减动?18:48,1.8);
    斩击弧(攻.position,受.position,色,true);
    震动=减动?0.08:0.28;闪白=0.55;
  }else if(ev.类型==='攻击'){
    放字((ev.伤害||0)+' !', ev.色||'#5eead4');
    喷粒子(受.position,色,减动?10:28,1.1);
    按武器特效(类型,攻.position,受.position,色);
    震动=减动?0.04:0.14;闪白=0.28;
  }else{
    放字('失手', '#94a3b8');
  }
  // 受击闪白材质
  受.traverse(o=>{if(o.isMesh&&o.material?.emissive){o.userData._em=o.material.emissive.clone();o.material.emissive.set(色);o.material.emissiveIntensity=0.8;setTimeout(()=>{if(o.userData._em){o.material.emissive.copy(o.userData._em);o.material.emissiveIntensity=0.15;}},220);}});
}

function 按武器特效(类型,from,to,色){
  if(类型==='护腕'||类型==='近战')近战斩击(from,to,色);
  else if(类型==='灵笔')剑气(from,to,色);
  else if(类型==='知微鉴')光刃(from,to,色);
  else if(类型==='镜类')折射光环(to,色);
  else if(类型==='法衣'||类型==='书袋'||类型==='佩符')剑气(from,to,色);
  else 斩击弧(from,to,色,false);
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

/* ===== Three.js 场景 ===== */
function 初始化场景(){
  const canvas=$('擂台画布');
  渲染器=new THREE.WebGLRenderer({canvas,antialias:!减动,alpha:false,powerPreference:'high-performance'});
  渲染器.setPixelRatio(Math.min(devicePixelRatio,减动?1.5:2));
  渲染器.setSize(innerWidth,innerHeight,false);
  渲染器.toneMapping=THREE.ACESFilmicToneMapping;
  渲染器.toneMappingExposure=1.15;
  场景=new THREE.Scene();
  场景.background=new THREE.Color(0x070b14);
  场景.fog=new THREE.FogExp2(0x070b14,0.028);
  相机=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,100);
  相机.position.set(0,6.2,11.5);相机.lookAt(0,1.2,0);
  时钟=new THREE.Clock();

  场景.add(new THREE.HemisphereLight(0x9ecbff,0x1a1208,0.55));
  const sun=new THREE.DirectionalLight(0xffe2b8,1.35);sun.position.set(6,12,4);场景.add(sun);
  const rim=new THREE.PointLight(0x2dd4bf,2.2,28);rim.position.set(-4,3,-2);场景.add(rim);
  const rim2=new THREE.PointLight(0xf43f5e,1.6,24);rim2.position.set(4,3,-2);场景.add(rim2);

  // 擂台地面
  const floorMat=new THREE.MeshStandardMaterial({color:0x1e293b,roughness:0.85,metalness:0.15});
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(7.2,7.2,0.35,48),floorMat);floor.position.y=-0.1;场景.add(floor);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(6.6,0.08,8,64),new THREE.MeshStandardMaterial({color:0xfbbf24,emissive:0xb45309,emissiveIntensity:0.4,roughness:0.4}));
  ring.rotation.x=Math.PI/2;ring.position.y=0.12;场景.add(ring);
  // 石砖细节
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.9,0.55),new THREE.MeshStandardMaterial({color:0x334155,roughness:0.9}));
    p.position.set(Math.cos(a)*6.2,0.35,Math.sin(a)*6.2);场景.add(p);
  }
  // 远山剪影
  for(const [x,z,s] of [[-14,-10,1.2],[12,-12,1.5],[0,-16,1.8]]){
    const m=new THREE.Mesh(new THREE.ConeGeometry(3.5*s,5*s,4),new THREE.MeshStandardMaterial({color:0x0b1324,roughness:1}));
    m.position.set(x,2.2*s,z);场景.add(m);
  }

  我方角色=造角色(0x14b8a6);我方角色.position.set(-2.6,0,0);场景.add(我方角色);
  对方角色=造角色(0xf43f5e);对方角色.position.set(2.6,0,0);对方角色.rotation.y=Math.PI;场景.add(对方角色);

  addEventListener('resize',()=>{
    相机.aspect=innerWidth/innerHeight;相机.updateProjectionMatrix();
    渲染器.setSize(innerWidth,innerHeight,false);
  });
}

function 造角色(主色){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:主色,roughness:0.45,metalness:0.25,emissive:new THREE.Color(主色),emissiveIntensity:0.15});
  const dark=new THREE.MeshStandardMaterial({color:0x0f172a,roughness:0.7,metalness:0.2});
  const 躯干=new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.85,6,12),mat);躯干.position.y=1.35;g.add(躯干);
  const 头=new THREE.Mesh(new THREE.SphereGeometry(0.28,16,16),mat);头.position.y=2.25;g.add(头);
  const 盔=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.35,8),dark);盔.position.y=2.52;g.add(盔);
  for(const s of [-1,1]){
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(0.12,0.55,4,8),mat);arm.position.set(0.55*s,1.45,0);arm.rotation.z=.35*s;g.add(arm);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(0.14,0.55,4,8),dark);leg.position.set(0.2*s,0.55,0);g.add(leg);
  }
  // 默认剑
  const 剑=new THREE.Group();
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.05,0.04),new THREE.MeshStandardMaterial({color:0xe2e8f0,metalness:0.9,roughness:0.2,emissive:主色,emissiveIntensity:0.35}));
  blade.position.y=0.55;剑.add(blade);
  const hilt=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.28,8),dark);剑.add(hilt);
  剑.position.set(0.72,1.35,0.15);剑.rotation.z=-0.5;g.add(剑);g.userData.剑=剑;
  return g;
}

function 喷粒子(pos,色,数量,速度){
  const geo=new THREE.BufferGeometry();
  const n=数量,posArr=new Float32Array(n*3),vel=[];
  for(let i=0;i<n;i++){
    posArr[i*3]=pos.x;posArr[i*3+1]=pos.y+1.2;posArr[i*3+2]=pos.z;
    vel.push(new THREE.Vector3((Math.random()-.5)*速度,(Math.random()*.8+.2)*速度,(Math.random()-.5)*速度));
  }
  geo.setAttribute('position',new THREE.BufferAttribute(posArr,3));
  const mat=new THREE.PointsMaterial({color:色,size:减动?0.12:0.18,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending});
  const pts=new THREE.Points(geo,mat);场景.add(pts);
  粒子组.push({pts,vel,life:0.7});
}

function 斩击弧(from,to,色,大){
  const curve=new THREE.QuadraticBezierCurve3(
    from.clone().add(new THREE.Vector3(0,1.5,0)),
    new THREE.Vector3((from.x+to.x)/2,大?3.2:2.4,1.2),
    to.clone().add(new THREE.Vector3(0,1.3,0))
  );
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,20,大?0.12:0.06,8,false),
    new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending}));
  场景.add(tube);
  粒子组.push({mesh:tube,life:大?0.55:0.35,fade:true});
}

function 近战斩击(from,to,色){
  斩击弧(from,to,色,false);
  喷粒子(to,色,减动?8:16,1.4);
}

function 剑气(from,to,色){
  const dir=to.clone().sub(from).normalize();
  const geo=new THREE.CylinderGeometry(0.05,0.02,from.distanceTo(to),6);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending}));
  mesh.position.copy(from).add(to).multiplyScalar(0.5);mesh.position.y+=1.3;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().setY(dir.y).normalize());
  场景.add(mesh);粒子组.push({mesh,life:0.4,fade:true});
  喷粒子(to,色,减动?10:22,1.3);
}

function 光刃(from,to,色){
  剑气(from,to,色);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.05,8,32),new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending}));
  ring.position.copy(to);ring.position.y+=1.4;ring.rotation.x=Math.PI/2;场景.add(ring);
  粒子组.push({mesh:ring,life:0.5,fade:true,spin:true});
}

function 折射光环(to,色){
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.5+i*0.35,0.04,8,40),new THREE.MeshBasicMaterial({color:色,transparent:true,opacity:0.7-i*0.15,blending:THREE.AdditiveBlending}));
    ring.position.copy(to);ring.position.y+=1.3;ring.rotation.x=Math.PI/2+i*0.2;场景.add(ring);
    粒子组.push({mesh:ring,life:0.65,fade:true,spin:true});
  }
  喷粒子(to,色,减动?12:30,1.6);
}

function 动画循环(){
  requestAnimationFrame(动画循环);
  const dt=Math.min(0.05,时钟.getDelta());
  const t=时钟.elapsedTime;
  if(我方角色){我方角色.position.y=Math.sin(t*2)*0.04;if(我方角色.userData.剑)我方角色.userData.剑.rotation.z=-0.5+Math.sin(t*3)*0.08;}
  if(对方角色){对方角色.position.y=Math.sin(t*2+1)*0.04;}
  // 粒子更新
  for(let i=粒子组.length-1;i>=0;i--){
    const p=粒子组[i];p.life-=dt;
    if(p.pts){
      const arr=p.pts.geometry.attributes.position.array;
      for(let j=0;j<p.vel.length;j++){arr[j*3]+=p.vel[j].x*dt;arr[j*3+1]+=p.vel[j].y*dt;arr[j*3+2]+=p.vel[j].z*dt;p.vel[j].y-=2.5*dt;}
      p.pts.geometry.attributes.position.needsUpdate=true;
      p.pts.material.opacity=Math.max(0,p.life);
    }
    if(p.mesh){if(p.fade)p.mesh.material.opacity=Math.max(0,p.life*2);if(p.spin)p.mesh.rotation.z+=dt*4;}
    if(p.life<=0){场景.remove(p.pts||p.mesh);(p.pts||p.mesh).geometry?.dispose();粒子组.splice(i,1);}
  }
  // 相机震动 + 轻量闪白（曝光）
  if(震动>0){震动=Math.max(0,震动-dt);相机.position.x=(Math.random()-0.5)*震动;相机.position.y=6.2+(Math.random()-0.5)*震动;}
  else{相机.position.x=THREE.MathUtils.lerp(相机.position.x,0,0.1);相机.position.y=THREE.MathUtils.lerp(相机.position.y,6.2,0.1);}
  if(闪白>0){闪白=Math.max(0,闪白-dt*1.8);渲染器.toneMappingExposure=1.15+闪白*1.4;}
  else 渲染器.toneMappingExposure=1.15;
  渲染器.render(场景,相机);
}
