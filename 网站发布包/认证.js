// 用户认证系统
const 认证数据库名 = '升本练习室认证';
let 认证数据库, 当前用户 = null;

// 初始化认证数据库
export async function 初始化认证() {
  return new Promise((完成, 拒绝) => {
    const 请求 = indexedDB.open(认证数据库名, 1);

    请求.onupgradeneeded = (事件) => {
      const db = 事件.target.result;
      if (!db.objectStoreNames.contains('用户')) {
        const 用户仓库 = db.createObjectStore('用户', { keyPath: '手机号' });
        用户仓库.createIndex('手机号', '手机号', { unique: true });
      }
    };

    请求.onsuccess = () => {
      认证数据库 = 请求.result;
      // 检查本地存储的登录状态
      const 保存的手机号 = localStorage.getItem('升本练习室_当前用户');
      if (保存的手机号) {
        获取用户(保存的手机号).then(用户 => {
          if (用户) 当前用户 = 用户;
          完成();
        }).catch(() => 完成());
      } else {
        完成();
      }
    };

    请求.onerror = () => 拒绝(new Error('认证数据库初始化失败'));
  });
}

// 注册新用户
export async function 注册用户(手机号, 密码) {
  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(手机号)) {
    throw new Error('请输入正确的手机号码');
  }

  // 验证密码强度
  if (密码.length < 6) {
    throw new Error('密码至少需要6位');
  }

  return new Promise((完成, 拒绝) => {
    const 事务 = 认证数据库.transaction(['用户'], 'readwrite');
    const 仓库 = 事务.objectStore('用户');

    // 检查手机号是否已注册
    const 检查 = 仓库.get(手机号);

    检查.onsuccess = () => {
      if (检查.result) {
        拒绝(new Error('该手机号已注册'));
        return;
      }

      // 创建新用户（实际应用中密码应该加密存储）
      const 新用户 = {
        手机号,
        密码: 简单加密(密码),
        注册时间: Date.now(),
        最后登录: Date.now()
      };

      const 添加 = 仓库.add(新用户);

      添加.onsuccess = () => {
        当前用户 = { 手机号, 注册时间: 新用户.注册时间 };
        localStorage.setItem('升本练习室_当前用户', 手机号);
        完成(当前用户);
      };

      添加.onerror = () => 拒绝(new Error('注册失败，请重试'));
    };

    检查.onerror = () => 拒绝(new Error('注册失败，请重试'));
  });
}

// 用户登录
export async function 用户登录(手机号, 密码) {
  if (!/^1[3-9]\d{9}$/.test(手机号)) {
    throw new Error('请输入正确的手机号码');
  }

  return new Promise((完成, 拒绝) => {
    const 事务 = 认证数据库.transaction(['用户'], 'readwrite');
    const 仓库 = 事务.objectStore('用户');
    const 查询 = 仓库.get(手机号);

    查询.onsuccess = () => {
      const 用户 = 查询.result;

      if (!用户) {
        拒绝(new Error('手机号或密码错误'));
        return;
      }

      if (用户.密码 !== 简单加密(密码)) {
        拒绝(new Error('手机号或密码错误'));
        return;
      }

      // 更新最后登录时间
      用户.最后登录 = Date.now();
      仓库.put(用户);

      当前用户 = { 手机号: 用户.手机号, 注册时间: 用户.注册时间 };
      localStorage.setItem('升本练习室_当前用户', 手机号);
      完成(当前用户);
    };

    查询.onerror = () => 拒绝(new Error('登录失败，请重试'));
  });
}

// 退出登录
export function 退出登录() {
  当前用户 = null;
  localStorage.removeItem('升本练习室_当前用户');
}

// 获取当前用户
export function 获取当前用户() {
  return 当前用户;
}

// 检查是否已登录
export function 是否已登录() {
  return 当前用户 !== null;
}

// 获取用户信息
async function 获取用户(手机号) {
  return new Promise((完成, 拒绝) => {
    const 事务 = 认证数据库.transaction(['用户'], 'readonly');
    const 仓库 = 事务.objectStore('用户');
    const 查询 = 仓库.get(手机号);

    查询.onsuccess = () => {
      if (查询.result) {
        完成({ 手机号: 查询.result.手机号, 注册时间: 查询.result.注册时间 });
      } else {
        完成(null);
      }
    };

    查询.onerror = () => 拒绝(new Error('获取用户信息失败'));
  });
}

// 简单加密（实际应用应使用更安全的方法，如bcrypt）
function 简单加密(文本) {
  let 结果 = 0;
  for (let i = 0; i < 文本.length; i++) {
    结果 = ((结果 << 5) - 结果) + 文本.charCodeAt(i);
    结果 |= 0;
  }
  return 结果.toString(36);
}
