/**
 * 免费 ChatGPT 网页版辅助判题（不调用 OpenAI API，不伪造密钥）。
 * 流程：生成提示词 → 复制到剪贴板 → 打开 chatgpt.com → 用户粘贴提示词与截图 → 粘贴回结果 → 写入自评分。
 */
const 主观题型 = new Set(['填空', '计算', '证明', '简答', '编程', '翻译']);

export function 是主观题(题型) {
  return 主观题型.has(题型);
}

/** 压缩图片为 JPEG dataURL，长边≤1280，质量约 0.7，尽量 <400KB */
export function 压缩截图(file, { 长边 = 1280, 质量 = 0.7, 目标上限 = 400 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('请选择图片文件。'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const 比 = Math.min(1, 长边 / Math.max(img.width, img.height));
        let w = Math.max(1, Math.round(img.width * 比));
        let h = Math.max(1, Math.round(img.height * 比));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let q = 质量;
        let data = canvas.toDataURL('image/jpeg', q);
        while (data.length * 0.75 > 目标上限 && q > 0.4) {
          q -= 0.08;
          data = canvas.toDataURL('image/jpeg', q);
        }
        while (data.length * 0.75 > 目标上限 && Math.max(w, h) > 640) {
          w = Math.round(w * 0.85);
          h = Math.round(h * 0.85);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          data = canvas.toDataURL('image/jpeg', q);
        }
        URL.revokeObjectURL(url);
        resolve(data);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片无法读取。'));
    };
    img.src = url;
  });
}

export function 构建判题提示词({ 题干, 题型, 参考答案, 评分要点 = [], 满分, 学生作答 = '', 科目 = '专业课' } = {}) {
  const 要点 = Array.isArray(评分要点) && 评分要点.length
    ? 评分要点.map((x, i) => `${i + 1}. ${x}`).join('\n')
    : '（无单独要点，请按参考答案的关键步骤给分）';
  return `你是${科目}阅卷助手。请对照参考答案与评分要点，给学生作答（或答题截图）打分。

【题型】${题型 || '主观题'}
【满分】${满分}
【题干】
${题干 || ''}

【参考答案】
${参考答案 || '（未提供文字参考答案，请根据题干与评分要点判断）'}

【评分要点】
${要点}

【学生文字作答】
${(学生作答 || '').trim() || '（无文字作答，请根据用户另行粘贴的答题截图判分）'}

请只输出一段 JSON（不要 markdown 代码块），格式严格为：
{"得分":数字,"满分":${Number(满分) || 0},"正确":true或false,"理由":"简要说明给分依据"}
其中 得分 为 0 到 满分 的整数；正确 表示是否基本做对（得分≥满分的一半可视为 true）。`;
}

export async function 复制文本(文字) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(文字);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = 文字;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('无法写入剪贴板，请手动复制提示词。');
  return true;
}

export function 打开ChatGPT() {
  window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
}

/**
 * 解析 ChatGPT 返回：优先 JSON；否则从纯文本抽取「得分/满分」。
 * @returns {{得分:number,满分:number,正确:boolean,理由:string}|null}
 */
export function 解析判题结果(原文, 默认满分) {
  const 文=String(原文||'').trim();if(!文)return null;
  if(!Number.isInteger(默认满分)||默认满分<=0)throw new Error('本题分值无效。');
  function 结果(得分,满分,理由,正确){
    if(满分!==undefined&&满分!==null&&(!['number','string'].includes(typeof 满分)||Number(满分)!==默认满分))throw new Error(`回复满分与本题 ${默认满分} 分不一致，请按本题满分重新判题。`);
    if(!['number','string'].includes(typeof 得分)||String(得分).trim()===''||!Number.isInteger(Number(得分))||Number(得分)<0||Number(得分)>默认满分)throw new Error(`得分必须是 0 到 ${默认满分} 的整数。`);
    return {得分:Number(得分),满分:默认满分,正确:typeof 正确==='boolean'?正确:Number(得分)>=默认满分/2,理由:String(理由||'已按判题结果写入自评分。').slice(0,2000)};
  }
  const 块=文.match(/\{[\s\S]*\}/)?.[0]||文;let o;
  try{o=JSON.parse(块);}catch{}
  if(o&&typeof o==='object'&&Object.hasOwn(o,'得分'))return 结果(o.得分,o.满分,o.理由||o.说明,o.正确);
  const 分数=文.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*分/);
  const 得=文.match(/得\s*分\s*[:：]?\s*(-?\d+(?:\.\d+)?)/)||分数||文.match(/给\s*(-?\d+(?:\.\d+)?)\s*分/);
  const 满=文.match(/满分\s*[:：]?\s*(\d+)/);
  return 得?结果(得[1],满?.[1]||分数?.[2],文.slice(0,400)):null;
}

function 转义(x) {
  return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 专业课主观题：截图上传 + ChatGPT 判题面板 HTML。
 * @param {'作答'|'自评'|'只读'} 模式
 */
export function 专业课AI判题HTML(q, 练习, { 模式 = '作答', 参考答案 = '', 评分要点 = [] } = {}) {
  const 截图 = 练习.截图?.[q.编号] || '';
  const 理由 = 练习.判题理由?.[q.编号] || '';
  const 只读 = 模式 === '只读';
  const 可上传 = 模式 === '作答' && !只读;
  const 可判题 = (模式 === '自评' || 模式 === '作答') && !只读;
  return `<details class="ai判题区" ${截图||理由?'open':''} data-ai-qid="${转义(q.编号)}" aria-label="答题截图与 ChatGPT 判题">
  <summary class="ai判题标题">上传答题截图 / ChatGPT 辅助判题（可选）</summary>
  <p class="ai判题说明">免费流程：上传或粘贴截图 → 一键复制提示词并打开 ChatGPT 网页 → 在 ChatGPT 粘贴提示词并附上截图 → 把回复粘贴回来自动写入自评分。本站不会登录 ChatGPT，也不调用付费 API。</p>
  <div class="ai截图行">
    ${可上传 ? `<button type="button" class="ai上传按钮" data-ai-action="选图">选择截图</button><input type="file" accept="image/*" data-ai-action="选图" hidden>
    <button type="button" class="次按钮" data-ai-action="粘贴图">从剪贴板粘贴图片</button>` : ''}
    ${截图 ? `<button type="button" class="次按钮" data-ai-action="清除图" ${只读 && 模式 !== '自评' ? 'disabled' : ''}>清除截图</button>` : ''}
  </div>
  <div class="ai预览" data-ai-preview>${截图 ? `<img src="${转义(截图)}" alt="本题答题截图预览">` : '<span class="ai预览空">尚未上传截图</span>'}</div>
  ${可判题 ? `<div class="ai动作行">
    <button type="button" class="次按钮" data-ai-action="复制提示词">一键复制提示词</button>
    <button type="button" class="练习按钮" data-ai-action="ChatGPT判题">用 ChatGPT 判题</button>
  </div>
  <label class="ai结果标签" for="ai判题结果-${转义(q.编号)}">粘贴 ChatGPT 判题结果</label>
  <textarea id="ai判题结果-${转义(q.编号)}" class="ai结果框" rows="4" placeholder='粘贴 JSON，例如 {"得分":6,"满分":${q.分值},"正确":true,"理由":"..."}，或含“得分：n”的纯文本'></textarea>
  <button type="button" class="次按钮" data-ai-action="解析结果">写入自评分</button>` : ''}
  <p class="ai状态" data-ai-status role="status" aria-live="polite"></p>
  ${理由 ? `<p class="ai理由"><strong>判题理由</strong>：${转义(理由)}</p>` : ''}
  <script type="application/json" data-ai-meta>${JSON.stringify({
    题号: q.编号,
    题干: q.题干,
    题型: q.题型,
    满分: q.分值,
    参考答案,
    评分要点,
  }).replace(/</g, '\\u003c')}</script>
</details>`;
}

/** 英语翻译自评旁的轻量辅助（不替代原有 0–4 要点自评） */
export function 英语翻译AI辅助HTML(q, { 参考答案 = '', 评分要点 = [], 满分 = 4 } = {}) {
  return `<details class="ai英语辅助"><summary>ChatGPT 辅助判分（可选）</summary>
  <p class="ai判题说明">复制提示词到 ChatGPT 网页，把结果粘贴下方，可自动勾选最接近的自评分。仍以你最终选择的 0–4 分为准。</p>
  <div class="ai动作行">
    <button type="button" class="按钮 次要 小" data-ai-en-action="复制提示词">一键复制提示词</button>
    <button type="button" class="按钮 小" data-ai-en-action="打开ChatGPT">打开 ChatGPT</button>
  </div>
  <textarea class="ai结果框" data-ai-en-result rows="3" placeholder='粘贴 {"得分":n,"满分":4,...} 或含得分的文字'></textarea>
  <button type="button" class="按钮 次要 小" data-ai-en-action="解析结果">按结果建议自评分</button>
  <p class="ai状态" data-ai-en-status role="status"></p>
  <script type="application/json" data-ai-en-meta>${JSON.stringify({
    题干: q.题干,
    题型: '翻译',
    满分,
    参考答案,
    评分要点: Array.isArray(评分要点) ? 评分要点 : [],
  }).replace(/</g, '\\u003c')}</script>
</details>`;
}

export function 读取专业课AI元数据(区) {
  const 节点 = 区.querySelector('[data-ai-meta]');
  if (!节点) return null;
  try { return JSON.parse(节点.textContent); } catch { return null; }
}

/**
 * 绑定专业课 AI 判题区事件。调用方提供存取练习的回调。
 * @param {HTMLElement} 根 通常是 #答题区
 * @param {{ get练习:()=>object, get题目:()=>object, get答案:()=>object|null, 保存:()=>void, 刷新:()=>void, 转义?:Function }} api
 */
export function 绑定专业课AI判题(根, api) {
  if (!根 || 根.dataset.aiBound === '1') return;
  根.dataset.aiBound = '1';

  const 状态 = (区, 文) => {
    const el = 区.querySelector('[data-ai-status]');
    if (el) el.textContent = 文 || '';
  };

  const 确保结构 = (练习, 题号) => {
    if (!练习.截图 || typeof 练习.截图 !== 'object') 练习.截图 = {};
    if (!练习.判题理由 || typeof 练习.判题理由 !== 'object') 练习.判题理由 = {};
    return 题号;
  };

  const 提示词 = (区, 练习) => {
    const meta = 读取专业课AI元数据(区);
    const q = api.get题目();
    if (!meta || !q) throw new Error('题目信息缺失。');
    const a = api.get答案?.()?.[q.编号];
    return 构建判题提示词({
      题干: meta.题干 || q.题干,
      题型: meta.题型 || q.题型,
      参考答案: meta.参考答案 || a?.参考答案 || '',
      评分要点: meta.评分要点?.length ? meta.评分要点 : (a?.评分要点 || []),
      满分: meta.满分 ?? q.分值,
      学生作答: 练习.作答?.[q.编号] || '',
      科目: '高等数学 / C 语言',
    });
  };

  根.addEventListener('click', async e => {
    const b = e.target.closest('[data-ai-action]');
    if (!b) return;
    const 区 = b.closest('.ai判题区');
    if (!区) return;
    let 练习 = api.get练习();
    const q = api.get题目();
    if (!练习 || !q || api.get只读?.()) return;
    const 动作 = b.dataset.aiAction;
    try {
      if (动作 === '选图') {if(b.tagName!=='INPUT')区.querySelector('input[data-ai-action="选图"]').click();return;}
      if (动作 === '粘贴图') {
        if (!navigator.clipboard?.read) throw new Error('当前浏览器不支持读取剪贴板图片，请改用「选择截图」。');
        const items = await navigator.clipboard.read();
        let file = null;
        for (const item of items) {
          const type = item.types.find(t => t.startsWith('image/'));
          if (type) {
            const blob = await item.getType(type);
            file = new File([blob], 'paste.jpg', { type: blob.type || 'image/jpeg' });
            break;
          }
        }
        if (!file) throw new Error('剪贴板里没有图片。');
        const data = await 压缩截图(file);
        if(api.get练习()?.编号!==练习.编号)throw new Error('已切换练习，请回到原练习重新上传截图。');
        练习=api.get练习();if(练习.阶段!=='作答'||api.get只读?.())throw new Error('练习已交卷，截图未更改。');
        确保结构(练习, q.编号);
        练习.截图[q.编号] = data;
        if (!(练习.作答[q.编号] || '').trim()) 练习.作答[q.编号] = '（已上传答题截图）';
        await api.保存();
        api.刷新();
        return;
      }
      if (动作 === '清除图') {
        确保结构(练习, q.编号);
        delete 练习.截图[q.编号];
        if (练习.作答[q.编号] === '（已上传答题截图）') 练习.作答[q.编号] = '';
        await api.保存();
        api.刷新();
        return;
      }
      if (动作 === '复制提示词') {
        await 复制文本(提示词(区, 练习));
        状态(区, '提示词已复制。请到 ChatGPT 粘贴，并附上截图。');
        return;
      }
      if (动作 === 'ChatGPT判题') {
        await 复制文本(提示词(区, 练习));
        打开ChatGPT();
        状态(区, '提示词已复制并打开 ChatGPT。请在新标签页粘贴提示词，再附上本题截图；判完后把回复粘贴到下方。');
        return;
      }
      if (动作 === '解析结果') {
        const 框 = 区.querySelector('.ai结果框');
        const 结果 = 解析判题结果(框?.value, q.分值);
        if (!结果) throw new Error('未能解析得分，请粘贴含 JSON 或「得分：n」的回复。');
        if (练习.阶段 === '作答') {
          状态(区, `解析成功：建议 ${结果.得分}/${结果.满分}。交卷进入自评后会自动写入；理由已暂存。`);
          确保结构(练习, q.编号);
          练习.判题理由[q.编号] = 结果.理由;
          练习._ai建议 = 练习._ai建议 || {};
          练习._ai建议[q.编号] = 结果.得分;
          await api.保存();
          return;
        }
        练习.自评[q.编号] = 结果.得分;
        确保结构(练习, q.编号);
        练习.判题理由[q.编号] = 结果.理由;
        await api.保存();
        api.刷新();
        状态(区, `已写入自评分 ${结果.得分} / ${结果.满分}。`);
        return;
      }
    } catch (err) {
      状态(区, err.message || String(err));
    }
  });

  根.addEventListener('change', async e => {
    const input = e.target.closest('input[data-ai-action="选图"]');
    if (!input?.files?.[0]) return;
    const 区 = input.closest('.ai判题区');
    let 练习 = api.get练习();
    const q = api.get题目();
    if (!区 || !练习 || !q) return;
    try {
      const data = await 压缩截图(input.files[0]);
      if(api.get练习()?.编号!==练习.编号)throw new Error('已切换练习，请回到原练习重新上传截图。');
        练习=api.get练习();if(练习.阶段!=='作答'||api.get只读?.())throw new Error('练习已交卷，截图未更改。');
      确保结构(练习, q.编号);
      练习.截图[q.编号] = data;
      if (!(练习.作答[q.编号] || '').trim()) 练习.作答[q.编号] = '（已上传答题截图）';
      await api.保存();
      api.刷新();
    } catch (err) {
      状态(区, err.message || String(err));
    } finally {
      input.value = '';
    }
  });
}

/** 绑定英语翻译页的可选 AI 辅助（写在 document 上，幂等） */
export function 绑定英语翻译AI辅助(获取上下文) {
  if (document.documentElement.dataset.aiEnBound === '1') return;
  document.documentElement.dataset.aiEnBound = '1';
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-ai-en-action]');
    if (!b) return;
    const 区 = b.closest('.ai英语辅助');
    if (!区) return;
    const 状态 = 区.querySelector('[data-ai-en-status]');
    const set = 文 => { if (状态) 状态.textContent = 文 || ''; };
    try {
      const meta = JSON.parse(区.querySelector('[data-ai-en-meta]')?.textContent || '{}');
      const ctx = 获取上下文?.() || {};
      const 学生作答 = ctx.学生作答 || '';
      const 词 = 构建判题提示词({
        题干: meta.题干,
        题型: '翻译',
        参考答案: meta.参考答案,
        评分要点: meta.评分要点,
        满分: meta.满分 || 4,
        学生作答,
        科目: '专升本英语翻译',
      });
      const 动作 = b.dataset.aiEnAction;
      if (动作 === '复制提示词') {
        await 复制文本(词);
        set('提示词已复制。');
        return;
      }
      if (动作 === '打开ChatGPT') {
        await 复制文本(词);
        打开ChatGPT();
        set('已复制提示词并打开 ChatGPT。');
        return;
      }
      if (动作 === '解析结果') {
        const 框 = 区.querySelector('[data-ai-en-result]');
        const 结果 = 解析判题结果(框?.value, meta.满分 || 4);
        if (!结果) throw new Error('未能解析得分。');
        const 分 = Math.max(0, Math.min(4, 结果.得分));
        const radio = document.querySelector(`input[name="自评"][value="${分}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        set(`已建议自评分 ${分} / 4。${结果.理由 ? ' ' + 结果.理由.slice(0, 120) : ''}`);
      }
    } catch (err) {
      set(err.message || String(err));
    }
  });
}
