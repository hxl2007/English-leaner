import {云端请求} from './云端接口.js';
import {是管理员} from './认证.js';
const 转义=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let 页=0,列表=[];
export const 反馈按钮=id=>`<button class="按钮 轻 小" data-action="题目反馈" data-id="${转义(id)}">反馈题目</button>`;
export async function 反馈页面(){
 const 管理=是管理员(),r=await 云端请求('/api/feedback?scope='+(管理?'all':'mine')+'&page='+页);列表=r.items;
 return `<div class="页头"><div><h1>${管理?'题目反馈管理':'我的题目反馈'}</h1><p class="副标题">${管理?'核对题目后填写处理结果，操作自动记入管理员日志。':'查看处理状态和管理员回复。'}</p></div><button class="按钮 次要" data-action="反馈分页" data-step="0">刷新</button></div><p class="参考提示">反馈用于整理问题；题库内容修订需要核实后发布，标记“已解决”本身不会自动改变题目。</p>${列表.map(x=>`<article class="反馈卡"><div><span class="徽标">${转义(x.分类)}</span><span class="徽标">${转义(x.状态)}</span></div><h3>题号 ${转义(x.题号)}</h3><p>${转义(x.详情||'未填写补充说明')}</p><small>${new Date(x.提交时间).toLocaleString('zh-CN')}${管理?' · '+转义(x.提交人):''}</small>${x.回复?`<blockquote><strong>管理员回复</strong><p>${转义(x.回复)}</p></blockquote>`:''}<div class="按钮组"><button class="按钮 轻 小" data-action="反馈看题" data-id="${转义(x.题号)}">查看题目与解析</button>${管理?`<button class="按钮 次要 小" data-action="反馈处理" data-id="${转义(x.编号)}">处理反馈</button>`:''}</div></article>`).join('')||'<div class="空状态"><h2>暂无反馈</h2><p>答题和查看解析时，可以通过“反馈题目”提交问题。</p></div>'}<div class="按钮组"><button class="按钮 次要" data-action="反馈分页" data-step="-1" ${页?'':'disabled'}>上一页</button><span>第 ${页+1} 页</span><button class="按钮 次要" data-action="反馈分页" data-step="1" ${列表.length===30?'':'disabled'}>下一页</button></div>`;
}
export async function 反馈动作(b,{弹窗,题目,提示,渲染,查看题目}){
 const 行=b.dataset.action;
 if(行==='题目反馈'){
  const q=题目.get(b.dataset.id);if(!q)throw new Error('题目不存在。');
  弹窗.innerHTML=`<h2>反馈题目</h2><p>题号：${转义(q.编号)}</p><form id="题目反馈表单" class="安全表单" data-id="${转义(q.编号)}" data-request="${crypto.randomUUID()}"><label>问题类型<select name="分类"><option>题干错误</option><option>答案争议</option><option>解析不清楚</option></select></label><label>补充说明<textarea name="详情" maxlength="2000" rows="4" placeholder="例如：第2段有漏字；或说明你认为另一答案正确的依据。"></textarea></label><p data-form-error role="alert"></p><div class="按钮组"><button class="按钮 次要" type="button" data-action="关闭">取消</button><button class="按钮" type="submit">提交反馈</button></div></form>`;弹窗.showModal();return true;
 }
 if(行==='反馈分页'){页=Math.max(0,页+Number(b.dataset.step||0));await 渲染();return true;}
 if(行==='反馈看题'){await 查看题目(b.dataset.id);return true;}
 if(行==='反馈处理'){
  if(!是管理员())throw new Error('只有管理员可以处理反馈');const x=列表.find(x=>x.编号===b.dataset.id);if(!x)throw new Error('请先刷新反馈列表');
  弹窗.innerHTML=`<h2>处理题目反馈</h2><p>${转义(x.题号)} · ${转义(x.分类)}</p><form id="反馈处理表单" class="安全表单" data-id="${转义(x.编号)}"><label>状态<select name="状态">${['待处理','处理中','已解决','暂不采纳'].map(s=>`<option ${s===x.状态?'selected':''}>${s}</option>`).join('')}</select></label><label>回复<textarea name="回复" rows="4" maxlength="2000">${转义(x.回复)}</textarea></label><p data-form-error role="alert"></p><div class="按钮组"><button class="按钮 次要" type="button" data-action="关闭">取消</button><button class="按钮" type="submit">保存处理结果</button></div></form>`;弹窗.showModal();return true;
 }
 return false;
}
export async function 提交反馈表单(e,{弹窗,提示,渲染}){
 const f=e.target;if(!['题目反馈表单','反馈处理表单'].includes(f.id))return false;e.preventDefault();
 const b=f.querySelector('[type="submit"]');if(b.disabled)return true;b.disabled=true;
 try{const v=Object.fromEntries(new FormData(f)),提交=f.id==='题目反馈表单';await 云端请求(提交?'/api/feedback':'/api/feedback/status',{method:提交?'POST':'PUT',body:JSON.stringify(提交?{...v,编号:f.dataset.request,题号:f.dataset.id}:{...v,编号:f.dataset.id})});弹窗.close();提示(提交?'题目反馈已提交，可在学习存档中查看处理状态。':'处理结果已保存。');if(!提交)await 渲染();}catch(err){f.querySelector('[data-form-error]').textContent=err.message;b.disabled=false;}return true;
}
