// 科目首页：登录门禁 + 用户名展示 + 旧英语书签兼容。
import {初始化认证,是否已登录,获取当前用户} from './认证.js';

const 旧页=new Set(['主页','选择题','阅读理解','完形填空','翻译','单块模拟题','全套卷子模拟题','知识点专项','每日复习','错题本','记录','修为','兑换','道友','设置','练习','结果','题目反馈']);
function 恢复英语书签(){
  let 页;
  try{页=decodeURIComponent(location.hash.slice(1)).split('/')[0];}catch{return;}
  if(旧页.has(页))location.replace('./英语.html'+location.hash);
}

function 显示用户名(用户){
  const 名=用户?.名称?.trim() || (用户?.手机号 ? `学员 ${用户.手机号.slice(-4)}` : '已登录');
  const 槽=document.querySelector('#首页用户名');
  if(槽){
    槽.textContent=名;
    槽.title=`已登录 · ${用户?.手机号||''}`;
    槽.removeAttribute('href');
    槽.setAttribute('aria-disabled','true');
    槽.classList.add('已登录');
  }
  document.querySelectorAll('[data-login-only]').forEach(el=>{
    el.hidden=false;
  });
}

function 遮罩未登录(){
  document.documentElement.classList.add('待登录');
  const 盖=document.querySelector('#登录跳转遮罩');
  if(盖)盖.hidden=false;
}

(async()=>{
  恢复英语书签();
  window.addEventListener('hashchange',恢复英语书签);
  try{
    await 初始化认证();
    if(!是否已登录()){
      遮罩未登录();
      sessionStorage.setItem('登录后科目','./index.html');
      location.replace('./login.html');
      return;
    }
    显示用户名(获取当前用户());
    document.documentElement.classList.remove('待登录');
    document.documentElement.classList.add('已登录首页');
    const 盖=document.querySelector('#登录跳转遮罩');
    if(盖)盖.remove();
  }catch(e){
    console.error('首页认证失败',e);
    遮罩未登录();
    sessionStorage.setItem('账户提示','登录状态异常，请重新登录。');
    location.replace('./login.html');
  }
})();
