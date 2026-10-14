// 保留以前分享的英语主页、练习、成绩等书签。
const 旧页=new Set(['主页','选择题','阅读理解','完形填空','翻译','单块模拟题','全套卷子模拟题','知识点专项','每日复习','错题本','记录','修为','兑换','道友','设置','练习','结果','题目反馈']);
function 恢复英语书签(){
  let 页;
  try{页=decodeURIComponent(location.hash.slice(1)).split('/')[0];}catch{return;}
  if(旧页.has(页))location.replace('./英语.html'+location.hash);
}
恢复英语书签();
window.addEventListener('hashchange',恢复英语书签);
