/**
 * 框内 AI 判分：经同域 /api/grade（Groq）打分并写入自评分。
 * 备用：可折叠「复制提示词」供无法连 API 时手工使用。
 */
import { 云端地址 } from './云端接口.js';

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

/**
 * 解析判分返回：优先 JSON；否则从纯文本抽取「得分/满分」。
 * @returns {{得分:number,满分:number,正确:boolean,理由:string}|null}
 */
export function 解析判题结果(原文, 默认满分) {
  const 文 = String(原文 || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!文) return null;
  const 尝试 = [];
  const json块 = 文.match(/\{[\s\S]*\}/);
  if (json块) 尝试.push(json块[0]);
  尝试.push(文);
  for (const 块 of 尝试) {
    try {
      const o = JSON.parse(块);
      const 满分 = Number.isFinite(Number(o.满分)) ? Number(o.满分) : 默认满分;
      let 得分 = Number(o.得分);
      if (!Number.isFinite(得分)) continue;
      得分 = Math.max(0, Math.min(满分, Math.round(得分)));
      const 正确 = typeof o.正确 === 'boolean' ? o.正确 : 得分 >= 满分 / 2;
      return { 得分, 满分, 正确, 理由: String(o.理由 || o.说明 || '').trim() || '已按判分结果写入自评分。' };
    } catch { /* next */ }
  }
  const 满分匹配 = 文.match(/满分\s*[:：]?\s*(\d+)/) || 文.match(/\/\s*(\d+)\s*分/);
  const 得分匹配 = 文.match(/得\s*分\s*[:：]?\s*(\d+)/) || 文.match(/(\d+)\s*\/\s*\d+\s*分/) || 文.match(/给\s*(\d+)\s*分/);
  if (得分匹配) {
    const 满分 = 满分匹配 ? Number(满分匹配[1]) : 默认满分;
    const 得分 = Math.max(0, Math.min(满分, Number(得分匹配[1])));
    return { 得分, 满分, 正确: 得分 >= 满分 / 2, 理由: 文.slice(0, 400) };
  }
  return null;
}

/** POST /api/grade：相对路径优先，失败再试云端 Workers 地址 */
export async function 请求判分(载荷) {
  const token = localStorage.getItem('升本练习室_云端令牌');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const body = JSON.stringify(载荷);
  const 路径列表 = ['/api/grade', 云端地址 + '/api/grade'];
  let 最后错误 = new Error('判分服务暂时无法连接。');
  for (const 地址 of 路径列表) {
    try {
      const 控制 = new AbortController();
      const 计时 = setTimeout(() => 控制.abort(), 45000);
      let r;
      try {
        r = await fetch(地址, { method: 'POST', headers, body, signal: 控制.signal, cache: 'no-store' });
      } finally {
        clearTimeout(计时);
      }
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        最后错误 = new Error('判分接口返回异常，请稍后重试。');
        continue;
      }
      const 数据 = await r.json();
      if (!r.ok) {
        最后错误 = new Error(数据.error || ('判分失败（' + r.status + '）'));
        最后错误.status = r.status;
        if (r.status === 429) 最后错误.message += ' 请稍后再试。';
        // 同域 404/HTML 代理失败时再试云端
        if (r.status === 404 || r.status === 502 || r.status === 503) continue;
        throw 最后错误;
      }
      const 满分 = Number.isFinite(Number(数据.满分)) ? Number(数据.满分) : Number(载荷.满分) || 0;
      let 得分 = Number(数据.得分);
      if (!Number.isFinite(得分)) throw new Error('判分结果无效。');
      得分 = Math.max(0, Math.min(满分, Math.round(得分)));
      return {
        得分,
        满分,
        正确: typeof 数据.正确 === 'boolean' ? 数据.正确 : 得分 >= 满分 / 2,
        理由: String(数据.理由 || '').trim() || '已完成自动判分。',
        model: 数据.model || '',
      };
    } catch (e) {
      if (e.status && e.status !== 404 && e.status !== 502 && e.status !== 503) throw e;
      最后错误 = e.name === 'AbortError' ? new Error('判分超时，请稍后重试。') : (e.message ? e : 最后错误);
    }
  }
  throw 最后错误;
}

function 转义(x) {
  return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 专业课主观题：截图上传 + 框内判分面板 HTML。
 * @param {'作答'|'自评'|'只读'} 模式
 */
export function 专业课AI判题HTML(q, 练习, { 模式 = '作答', 参考答案 = '', 评分要点 = [] } = {}) {
  const 截图 = 练习.截图?.[q.编号] || '';
  const 理由 = 练习.判题理由?.[q.编号] || '';
  const 只读 = 模式 === '只读';
  const 可上传 = 模式 === '作答' && !只读;
  const 可判题 = (模式 === '自评' || 模式 === '作答') && !只读;
  return `<section class="ai判题区" data-ai-qid="${转义(q.编号)}" aria-label="答题截图与 AI 判分">
  <h3 class="ai判题标题">答题截图 · AI 判分</h3>
  <p class="ai判题说明">在框内填写作答或上传截图后，点「判分」即可自动打分并写入自评分。无需打开外部网页。</p>
  <div class="ai截图行">
    ${可上传 ? `<label class="ai上传按钮">选择截图<input type="file" accept="image/*" data-ai-action="选图" hidden></label>
    <button type="button" class="次按钮" data-ai-action="粘贴图">从剪贴板粘贴图片</button>` : ''}
    ${截图 ? `<button type="button" class="次按钮" data-ai-action="清除图" ${只读 && 模式 !== '自评' ? 'disabled' : ''}>清除截图</button>` : ''}
  </div>
  <div class="ai预览" data-ai-preview>${截图 ? `<img src="${截图}" alt="本题答题截图预览">` : '<span class="ai预览空">尚未上传截图</span>'}</div>
  ${可判题 ? `<div class="ai动作行">
    <button type="button" class="练习按钮 ai判分按钮" data-ai-action="判分">判分</button>
  </div>
  <details class="ai备用">
    <summary>备用：复制提示词</summary>
    <p class="ai判题说明">网络异常时，可复制提示词到其他 AI，再把回复粘贴下方写入自评分。</p>
    <div class="ai动作行">
      <button type="button" class="次按钮" data-ai-action="复制提示词">一键复制提示词</button>
    </div>
    <label class="ai结果标签" for="ai判题结果-${转义(q.编号)}">粘贴判分结果</label>
    <textarea id="ai判题结果-${转义(q.编号)}" class="ai结果框" rows="3" placeholder='粘贴 JSON，例如 {"得分":6,"满分":${q.分值},"正确":true,"理由":"..."}'></textarea>
    <button type="button" class="次按钮" data-ai-action="解析结果">写入自评分</button>
  </details>` : ''}
  <p class="ai状态" data-ai-status role="status" aria-live="polite"></p>
  ${理由 ? `<p class="ai理由"><strong>判分理由</strong>：${转义(理由)}</p>` : ''}
  <script type="application/json" data-ai-meta>${JSON.stringify({
    题号: q.编号,
    题干: q.题干,
    题型: q.题型,
    满分: q.分值,
    参考答案,
    评分要点,
  }).replace(/</g, '\\u003c')}</script>
</section>`;
}

/** 英语翻译自评旁的轻量辅助（不替代原有 0–4 要点自评） */
export function 英语翻译AI辅助HTML(q, { 参考答案 = '', 评分要点 = [], 满分 = 4 } = {}) {
  return `<details class="ai英语辅助" open><summary>AI 判分（可选）</summary>
  <p class="ai判题说明">填写译文后点「判分」，自动建议 0–4 分自评分。仍以你最终选择为准。</p>
  <div class="ai动作行">
    <button type="button" class="按钮 小 ai判分按钮" data-ai-en-action="判分">判分</button>
  </div>
  <details class="ai备用">
    <summary>备用：复制提示词</summary>
    <div class="ai动作行">
      <button type="button" class="按钮 次要 小" data-ai-en-action="复制提示词">一键复制提示词</button>
    </div>
    <textarea class="ai结果框" data-ai-en-result rows="3" placeholder='粘贴 {"得分":n,"满分":4,...} 或含得分的文字'></textarea>
    <button type="button" class="按钮 次要 小" data-ai-en-action="解析结果">按结果建议自评分</button>
  </details>
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

function 写入专业课结果(练习, q, 结果, api, 区, 状态) {
  确保结构本地(练习, q.编号);
  练习.判题理由[q.编号] = 结果.理由;
  if (练习.阶段 === '作答') {
    练习._ai建议 = 练习._ai建议 || {};
    练习._ai建议[q.编号] = 结果.得分;
    api.保存();
    状态(区, `判分完成：建议 ${结果.得分}/${结果.满分}。交卷进入自评后可自动写入。${结果.理由 ? ' ' + 结果.理由.slice(0, 80) : ''}`);
    const 理由节点 = 区.querySelector('.ai理由');
    if (理由节点) 理由节点.innerHTML = `<strong>判分理由</strong>：${转义(结果.理由)}`;
    else {
      const p = document.createElement('p');
      p.className = 'ai理由';
      p.innerHTML = `<strong>判分理由</strong>：${转义(结果.理由)}`;
      区.appendChild(p);
    }
    return;
  }
  练习.自评[q.编号] = 结果.得分;
  api.保存();
  api.刷新();
  状态(区, `已写入自评分 ${结果.得分} / ${结果.满分}。`);
}

function 确保结构本地(练习, 题号) {
  if (!练习.截图 || typeof 练习.截图 !== 'object') 练习.截图 = {};
  if (!练习.判题理由 || typeof 练习.判题理由 !== 'object') 练习.判题理由 = {};
  return 题号;
}

/**
 * 绑定专业课 AI 判题区事件。
 */
export function 绑定专业课AI判题(根, api) {
  if (!根 || 根.dataset.aiBound === '1') return;
  根.dataset.aiBound = '1';

  const 状态 = (区, 文) => {
    const el = 区.querySelector('[data-ai-status]');
    if (el) el.textContent = 文 || '';
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

  const 载荷 = (区, 练习, q) => {
    const meta = 读取专业课AI元数据(区) || {};
    const a = api.get答案?.()?.[q.编号];
    return {
      题干: meta.题干 || q.题干 || '',
      题型: meta.题型 || q.题型 || '主观题',
      参考答案: meta.参考答案 || a?.参考答案 || '',
      评分要点: meta.评分要点?.length ? meta.评分要点 : (a?.评分要点 || []),
      满分: meta.满分 ?? q.分值,
      学生作答: 练习.作答?.[q.编号] || '',
      科目: '高等数学 / C 语言',
      截图: 练习.截图?.[q.编号] || '',
    };
  };

  根.addEventListener('click', async e => {
    const b = e.target.closest('[data-ai-action]');
    if (!b) return;
    const 区 = b.closest('.ai判题区');
    if (!区) return;
    const 练习 = api.get练习();
    const q = api.get题目();
    if (!练习 || !q) return;
    const 动作 = b.dataset.aiAction;
    try {
      if (动作 === '选图') return;
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
        确保结构本地(练习, q.编号);
        练习.截图[q.编号] = data;
        if (!(练习.作答[q.编号] || '').trim()) 练习.作答[q.编号] = '（已上传答题截图）';
        api.保存();
        api.刷新();
        return;
      }
      if (动作 === '清除图') {
        确保结构本地(练习, q.编号);
        delete 练习.截图[q.编号];
        if (练习.作答[q.编号] === '（已上传答题截图）') 练习.作答[q.编号] = '';
        api.保存();
        api.刷新();
        return;
      }
      if (动作 === '复制提示词') {
        await 复制文本(提示词(区, 练习));
        状态(区, '提示词已复制。');
        return;
      }
      if (动作 === '判分') {
        const 作答 = (练习.作答?.[q.编号] || '').trim();
        const 图 = 练习.截图?.[q.编号] || '';
        if (!作答 && !图) throw new Error('请先填写作答或上传截图再判分。');
        b.disabled = true;
        状态(区, '正在判分…');
        try {
          const 结果 = await 请求判分(载荷(区, 练习, q));
          写入专业课结果(练习, q, 结果, api, 区, 状态);
        } finally {
          b.disabled = false;
        }
        return;
      }
      if (动作 === '解析结果') {
        const 框 = 区.querySelector('.ai结果框');
        const 结果 = 解析判题结果(框?.value, q.分值);
        if (!结果) throw new Error('未能解析得分，请粘贴含 JSON 或「得分：n」的回复。');
        写入专业课结果(练习, q, 结果, api, 区, 状态);
        return;
      }
    } catch (err) {
      状态(区, err.message || String(err));
      const btn = 区.querySelector('[data-ai-action="判分"]');
      if (btn) btn.disabled = false;
    }
  });

  根.addEventListener('change', async e => {
    const input = e.target.closest('input[data-ai-action="选图"]');
    if (!input?.files?.[0]) return;
    const 区 = input.closest('.ai判题区');
    const 练习 = api.get练习();
    const q = api.get题目();
    if (!区 || !练习 || !q) return;
    try {
      const data = await 压缩截图(input.files[0]);
      确保结构本地(练习, q.编号);
      练习.截图[q.编号] = data;
      if (!(练习.作答[q.编号] || '').trim()) 练习.作答[q.编号] = '（已上传答题截图）';
      api.保存();
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
      if (动作 === '判分') {
        if (!学生作答.trim()) throw new Error('请先填写译文再判分。');
        b.disabled = true;
        set('正在判分…');
        try {
          const 结果 = await 请求判分({
            题干: meta.题干 || '',
            题型: '翻译',
            参考答案: meta.参考答案 || '',
            评分要点: meta.评分要点 || [],
            满分: meta.满分 || 4,
            学生作答,
            科目: '专升本英语翻译',
            截图: '',
          });
          const 分 = Math.max(0, Math.min(4, 结果.得分));
          const radio = document.querySelector(`input[name="自评"][value="${分}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
          set(`已建议自评分 ${分} / 4。${结果.理由 ? ' ' + 结果.理由.slice(0, 120) : ''}`);
        } finally {
          b.disabled = false;
        }
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
      const btn = 区.querySelector('[data-ai-en-action="判分"]');
      if (btn) btn.disabled = false;
    }
  });
}
