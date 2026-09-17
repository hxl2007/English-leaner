import { 初始化认证, 注册用户, 用户登录, 是否已登录 } from './认证.js';

let 当前模式 = '登录'; // '登录' 或 '注册'
const 账户提示=sessionStorage.getItem('账户提示');
if(账户提示){document.querySelector('.副标题').textContent=账户提示;sessionStorage.removeItem('账户提示');}

const 元素 = {
  表单: document.querySelector('#认证表单'),
  标题: document.querySelector('#表单标题'),
  手机号: document.querySelector('#手机号'),
  名称: document.querySelector('#名称'),
  名称组: document.querySelector('#名称组'),
  密码: document.querySelector('#密码'),
  确认密码: document.querySelector('#确认密码'),
  确认密码组: document.querySelector('#确认密码组'),
  提交按钮: document.querySelector('#提交按钮'),
  切换按钮: document.querySelector('#切换模式'),
  切换文字: document.querySelector('#切换文字')
};

// 切换登录/注册模式
元素.切换按钮.addEventListener('click', () => {
  当前模式 = 当前模式 === '登录' ? '注册' : '登录';
  元素.密码.autocomplete=当前模式==='注册'?'new-password':'current-password';

  if (当前模式 === '注册') {
    元素.标题.textContent = '注册';
    元素.名称组.style.display = 'block';
    元素.确认密码组.style.display = 'block';
    元素.提交按钮.textContent = '注册';
    元素.切换文字.textContent = '已有账号？';
    元素.切换按钮.textContent = '立即登录';
  } else {
    元素.标题.textContent = '登录';
    元素.名称组.style.display = 'none';
    元素.确认密码组.style.display = 'none';
    元素.提交按钮.textContent = '登录';
    元素.切换文字.textContent = '还没有账号？';
    元素.切换按钮.textContent = '立即注册';
  }

  清除所有错误();
});

// 密码强度检测
元素.密码.addEventListener('input', () => {
  if (当前模式 === '注册') {
    const 密码 = 元素.密码.value;
    const 强度条 = 元素.确认密码组.querySelector('.密码强度');

    let 强度 = 0;
    if (密码.length >= 6) 强度++;
    if (密码.length >= 8) 强度++;
    if (/[A-Z]/.test(密码) && /[a-z]/.test(密码)) 强度++;
    if (/\d/.test(密码)) 强度++;
    if (/[^A-Za-z0-9]/.test(密码)) 强度++;

    强度条.className = '密码强度';
    if (强度 <= 2) 强度条.classList.add('弱');
    else if (强度 <= 4) 强度条.classList.add('中');
    else 强度条.classList.add('强');
  }
});

// 表单提交
元素.表单.addEventListener('submit', async (e) => {
  e.preventDefault();

  清除所有错误();

  const 手机号 = 元素.手机号.value.trim();
  const 密码 = 元素.密码.value;
  const 名称 = 元素.名称.value.trim();

  // 验证手机号
  if (!/^1[3-9]\d{9}$/.test(手机号)) {
    显示错误(元素.手机号.parentElement, '请输入正确的手机号码');
    return;
  }

  // 验证密码
  if (密码.length < 6) {
    显示错误(元素.密码.parentElement, '密码至少需要6位');
    return;
  }

  // 注册模式下验证确认密码
  if (当前模式 === '注册') {
    const 确认密码 = 元素.确认密码.value;
    if (密码 !== 确认密码) {
      显示错误(元素.确认密码.parentElement, '两次输入的密码不一致');
      return;
    }
    if (名称.length > 20) {
      显示错误(元素.名称.parentElement, '名称最多20个字符');
      return;
    }
  }

  元素.提交按钮.disabled = true;
  元素.提交按钮.textContent = 当前模式 === '登录' ? '登录中...' : '注册中...';

  try {
    if (当前模式 === '注册') {
      await 注册用户(手机号, 密码, 名称);
      显示成功('注册成功！');
    } else {
      await 用户登录(手机号, 密码);
      显示成功('登录成功！');
    }

    // 1秒后跳转到主页
    setTimeout(() => {
      window.location.href = './index.html';
    }, 1000);

  } catch (错误) {
    显示错误(元素.手机号.parentElement, 错误.message);
    元素.提交按钮.disabled = false;
    元素.提交按钮.textContent = 当前模式 === '登录' ? '登录' : '注册';
  }
});

function 显示错误(表单组, 消息) {
  表单组.classList.add('错误');
  const 提示 = 表单组.querySelector('.错误提示');
  if (提示) 提示.textContent = 消息;
}

function 清除所有错误() {
  document.querySelectorAll('.表单组').forEach(组 => {
    组.classList.remove('错误');
  });
}

function 显示成功(消息) {
  const 遮罩 = document.createElement('div');
  遮罩.className = '遮罩';

  const 提示 = document.createElement('div');
  提示.className = '登录成功提示';
  提示.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <h2>${消息}</h2>
    <p>正在跳转到学习主页...</p>
  `;

  document.body.appendChild(遮罩);
  document.body.appendChild(提示);
}

// 初始化
(async () => {
  try {
    // 防止重定向循环：检查是否从主页跳转过来
    const 来自主页 = document.referrer.includes('index.html') || sessionStorage.getItem('刚从主页跳转');

    await 初始化认证();

    // 如果已登录且不是从主页跳转过来的，才重定向到主页
    if (是否已登录() && !来自主页) {
      // 清除标记
      sessionStorage.removeItem('刚从主页跳转');
      window.location.href = './index.html';
    } else if (来自主页) {
      // 清除标记，允许用户重新登录
      sessionStorage.removeItem('刚从主页跳转');
    }
  } catch (错误) {
    console.error('初始化失败:', 错误);
  }
})();
