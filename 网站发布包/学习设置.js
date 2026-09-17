import {获取当前用户} from './认证.js';
const 键=()=>`学习显示设置:${获取当前用户()?.手机号||'访客'}`;
export function 读取显示设置(){
 let 值={};try{值=JSON.parse(localStorage.getItem(键())||'{}');}catch{}
 return {字号:Math.max(14,Math.min(24,Number(值.字号)||17)),面板高度:Math.max(35,Math.min(75,Number(值.面板高度)||55))};
}
export function 应用显示设置(){const s=读取显示设置();document.documentElement.style.setProperty('--阅读字号',s.字号+'px');document.documentElement.style.setProperty('--面板比例',s.面板高度+'dvh');return s;}
export function 保存显示设置(字段,值){if(!['字号','面板高度'].includes(字段))return;localStorage.setItem(键(),JSON.stringify({...读取显示设置(),[字段]:Number(值)}));return 应用显示设置();}
export function 显示设置控件(){const s=读取显示设置();return `<div class="显示控件"><label>文章字号 <output data-display-output="字号">${s.字号}</output> px<input type="range" data-display="字号" min="14" max="24" step="1" value="${s.字号}" aria-label="文章字号"></label><label>答题面板高度 <output data-display-output="面板高度">${s.面板高度}</output>%<input type="range" data-display="面板高度" min="35" max="75" step="5" value="${s.面板高度}" aria-label="答题面板高度"></label><p>设置保存在当前设备，换题和重新打开后继续使用。</p></div>`;}
