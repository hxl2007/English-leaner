// Cloudflare Workers API：账户、管理员和学习存档均保存到 D1。
const 管理员手机号 = '13671068767';
const 允许来源 = '*';
const 已初始化数据库=new WeakSet();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {'Access-Control-Allow-Origin':允许来源,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
    if (request.method === 'OPTIONS') return new Response(null,{headers:cors});
    if (!url.pathname.startsWith('/api/')) return json({error:'Not Found'},404,cors);
    try {
      if(!env.DB)return json({error:'请在账户 Worker 绑定 D1：DB = zhuanshengben_users，然后重新部署。'},503,cors);
      await 补齐用户字段(env);
      if(url.pathname==='/api/health')return json({service:'升本账户服务',version:9,database:true,social:true,grade:true,arena:true},200,cors);
      const 社交响应=await 社交路由(request,env,cors,url,{鉴权,限流,hash,json});if(社交响应)return 社交响应;
      if(url.pathname==='/api/feedback'&&request.method==='POST')return await 提交反馈(request,env,cors);
      if(url.pathname==='/api/feedback'&&request.method==='GET')return await 读取反馈(request,env,cors);
      if(url.pathname==='/api/feedback/status'&&request.method==='PUT')return await 处理反馈(request,env,cors);
      if(url.pathname==='/api/password'&&request.method==='PUT')return await 修改密码(request,env,cors);
      if(url.pathname==='/api/logout'&&request.method==='POST')return await 注销会话(request,env,cors,false);
      if(url.pathname==='/api/logout-others'&&request.method==='POST')return await 注销会话(request,env,cors,true);
      if(url.pathname==='/api/admin/logs'&&request.method==='GET')return await 管理日志(request,env,cors);
      if (url.pathname === '/api/register' && request.method === 'POST') return await 注册(request,env,cors);
      if (url.pathname === '/api/login' && request.method === 'POST') return await 登录(request,env,cors);
      if (url.pathname === '/api/user' && request.method === 'GET') return await 当前用户(request,env,cors);
      if (url.pathname === '/api/users' && request.method === 'GET') return await 用户列表(request,env,cors);
      if (url.pathname === '/api/user/status' && request.method === 'PUT') return await 用户状态(request,env,cors);
      if (url.pathname === '/api/archive' && request.method === 'GET') return await 获取存档(request,env,cors);
      if (url.pathname === '/api/archive' && request.method === 'PUT') return await 保存存档(request,env,cors);
      if (url.pathname === '/api/grade' && request.method === 'POST') return await 判分(request,env,cors);
      return json({error:'Not Found'},404,cors);
    } catch (错误) {
      if(错误.status===429)return json({error:'操作过于频繁，请稍后再试。',retryAfter:错误.retryAfter},429,{...cors,'Retry-After':String(错误.retryAfter)});
      if(错误 instanceof SyntaxError)return json({error:'请求格式无效'},400,cors);
      console.error(错误);
      return json({error:'服务器暂时无法处理请求'},500,cors);
    }
  }
};

async function 补齐用户字段(env) {
  if(已初始化数据库.has(env.DB))return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS 会话 (令牌 TEXT PRIMARY KEY, 手机号 TEXT NOT NULL, 到期 INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS 访问限流 (键 TEXT PRIMARY KEY, 截止 INTEGER NOT NULL, 次数 INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS 管理操作 (编号 TEXT PRIMARY KEY, 操作人 TEXT NOT NULL, 目标 TEXT NOT NULL, 动作 TEXT NOT NULL, 时间 INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 管理操作时间 ON 管理操作(时间)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS 题目反馈 (编号 TEXT PRIMARY KEY, 提交人 TEXT NOT NULL, 题号 TEXT NOT NULL, 分类 TEXT NOT NULL, 详情 TEXT NOT NULL, 状态 TEXT NOT NULL DEFAULT '待处理', 回复 TEXT NOT NULL DEFAULT '', 提交时间 INTEGER NOT NULL, 更新时间 INTEGER NOT NULL)").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 题目反馈时间 ON 题目反馈(提交时间)').run();
  await env.DB.prepare('DELETE FROM 访问限流 WHERE 截止 < ?').bind(Date.now()).run();
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS 用户 (手机号 TEXT PRIMARY KEY, 密码 TEXT NOT NULL, 名称 TEXT NOT NULL DEFAULT '', 禁用 INTEGER NOT NULL DEFAULT 0, 注册时间 INTEGER NOT NULL, 最后登录 INTEGER NOT NULL)").run(); } catch {}
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS 存档 (手机号 TEXT PRIMARY KEY, 存档数据 TEXT NOT NULL, 更新时间 INTEGER NOT NULL, FOREIGN KEY (手机号) REFERENCES 用户(手机号))").run(); } catch {}
  // 兼容已经创建的 D1 表；字段已存在时 D1 会报错，直接忽略即可。
  try { await env.DB.prepare("ALTER TABLE 用户 ADD COLUMN 名称 TEXT NOT NULL DEFAULT ''").run(); } catch {}
  try { await env.DB.prepare("ALTER TABLE 用户 ADD COLUMN 禁用 INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  await 补齐社交表(env);
  已初始化数据库.add(env.DB);
}
async function 注册(request,env,cors) {
  const {手机号,密码,名称=''} = await request.json();
  if (typeof 手机号!=='string'||!/^1[3-9]\d{9}$/.test(手机号)) return json({error:'请输入正确的手机号码'},400,cors);
  if (typeof 密码 !== 'string' || 密码.length < 6 || 密码.length>256) return json({error:'密码需要6至256位'},400,cors);
  const 来源=await 来源键(request);if(来源)await 限流(env,'注册来源:'+来源,20);
  await 限流(env,'注册账户:'+await hash(手机号),5);
  const 已有=await env.DB.prepare('SELECT 手机号 FROM 用户 WHERE 手机号=?').bind(手机号).first();
  if (已有) return json({error:'该手机号已注册'},409,cors);
  const 时间=Date.now(),哈希=await 密码摘要(密码),用户名称=String(名称||'').trim().slice(0,20)||`学习者${手机号.slice(-4)}`;
  await env.DB.prepare('INSERT INTO 用户 (手机号,密码,名称,禁用,注册时间,最后登录) VALUES (?,?,?,?,?,?)').bind(手机号,哈希,用户名称,0,时间,时间).run();
  return json({success:true,token:await token(手机号,env),user:视图({手机号,名称:用户名称,禁用:0,注册时间:时间,最后登录:时间})},200,cors);
}
async function 登录(request,env,cors) {
  const {手机号,密码}=await request.json();
  if(!/^1[3-9]\d{9}$/.test(手机号)||typeof 密码!=='string'||密码.length>256)return json({error:'手机号或密码错误'},401,cors);
  const 来源=await 来源键(request);if(来源)await 限流(env,'登录来源:'+来源,60);
  const 限流键='登录账户:'+await hash(手机号);
  await 限流(env,限流键,10);
  const 用户=await env.DB.prepare('SELECT * FROM 用户 WHERE 手机号=?').bind(手机号).first();
  if (!用户 || !(await 校验密码(密码,用户.密码))) return json({error:'手机号或密码错误'},401,cors);
  if (Number(用户.禁用)===1) return json({error:'该账号已被管理员禁用'},403,cors);
  await env.DB.prepare('DELETE FROM 访问限流 WHERE 键=?').bind(限流键).run();
  if(!用户.密码.startsWith('pbkdf2$'))await env.DB.prepare('UPDATE 用户 SET 密码=? WHERE 手机号=?').bind(await 密码摘要(密码),手机号).run();
  const 时间=Date.now(); await env.DB.prepare('UPDATE 用户 SET 最后登录=? WHERE 手机号=?').bind(时间,手机号).run();
  用户.最后登录=时间;
  return json({success:true,token:await token(手机号,env),user:视图(用户)},200,cors);
}
async function 当前用户(request,env,cors) {
  const 手机号=await 鉴权(request,env); if(!手机号)return json({error:'未授权'},401,cors);
  const 用户=await env.DB.prepare('SELECT 手机号,名称,禁用,注册时间,最后登录 FROM 用户 WHERE 手机号=?').bind(手机号).first();
  if(!用户)return json({error:'用户不存在'},404,cors);
  return json({user:视图(用户)},200,cors);
}
async function 用户列表(request,env,cors) {
  const 手机号=await 鉴权(request,env); if(手机号!==管理员手机号)return json({error:'只有管理员可以查看用户'},403,cors);
  const 结果=await env.DB.prepare('SELECT 手机号,名称,禁用,注册时间,最后登录 FROM 用户 ORDER BY 注册时间').all();
  return json({users:(结果.results||[]).map(视图)},200,cors);
}
async function 用户状态(request,env,cors) {
  const 管理员=await 鉴权(request,env); if(管理员!==管理员手机号)return json({error:'只有管理员可以管理账户'},403,cors);
  const {手机号,禁用}=await request.json(); if(!/^1[3-9]\d{9}$/.test(手机号)||typeof 禁用!=='boolean'||手机号===管理员手机号)return json({error:'账户参数无效或目标为管理员'},400,cors);
  const 存在=await env.DB.prepare('SELECT 手机号 FROM 用户 WHERE 手机号=?').bind(手机号).first();
  if(!存在)return json({error:'用户不存在'},404,cors);
  await env.DB.batch([
    env.DB.prepare('UPDATE 用户 SET 禁用=? WHERE 手机号=?').bind(禁用?1:0,手机号),
    env.DB.prepare('INSERT INTO 管理操作 (编号,操作人,目标,动作,时间) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),管理员,手机号,禁用?'禁用账户':'启用账户',Date.now())
  ]);
  const 用户=await env.DB.prepare('SELECT 手机号,名称,禁用,注册时间,最后登录 FROM 用户 WHERE 手机号=?').bind(手机号).first();
  return json({user:视图(用户)},200,cors);
}
async function 获取存档(request,env,cors) {
  const 手机号=await 鉴权(request,env); if(!手机号)return json({error:'未授权'},401,cors);
  const 行=await env.DB.prepare('SELECT 存档数据,更新时间 FROM 存档 WHERE 手机号=?').bind(手机号).first();
  if(!行)return json({archive:null},200,cors);
  let archive=null; try{archive=JSON.parse(行.存档数据);}catch{}
  return json({archive,updatedAt:Number(行.更新时间)||0},200,cors);
}
async function 保存存档(request,env,cors) {
  const 手机号=await 鉴权(request,env); if(!手机号)return json({error:'未授权'},401,cors);
  const {archive,updatedAt,baseUpdatedAt}=await request.json(); if(!archive||typeof archive!=='object'||!Array.isArray(archive.记录)||!Array.isArray(archive.收藏))return json({error:'存档格式无效'},400,cors);
  const 时间=Number(updatedAt); if(!Number.isFinite(时间)||时间<=0)return json({error:'存档时间无效'},400,cors);
  let 数据=JSON.stringify(archive);
  if(new TextEncoder().encode(数据).length>4000000)return json({error:'存档过大，请先导出备份后联系管理员'},413,cors);
  if(baseUpdatedAt!==undefined){
    const 基线=Number(baseUpdatedAt);
    if(!Number.isSafeInteger(基线)||基线<0)return json({error:'存档版本无效'},400,cors);
    const 新版本=Math.max(Date.now(),基线+1);
    数据=JSON.stringify({...archive,更新时间:新版本});
    const 写入=await env.DB.prepare('INSERT INTO 存档 (手机号,存档数据,更新时间) SELECT ?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM 存档 WHERE 手机号=?) ON CONFLICT(手机号) DO UPDATE SET 存档数据=excluded.存档数据,更新时间=excluded.更新时间 WHERE 存档.更新时间=?').bind(手机号,数据,新版本,基线,手机号,基线).run();
    if(写入.meta?.changes)return json({success:true,updatedAt:新版本},200,cors);
    const 行=await env.DB.prepare('SELECT 存档数据,更新时间 FROM 存档 WHERE 手机号=?').bind(手机号).first();
    return json({conflict:true,error:'另一台设备已更新进度',archive:行?JSON.parse(行.存档数据):null,updatedAt:Number(行?.更新时间)||0},409,cors);
  }
  // D1 使用单条条件更新，旧设备的迟到请求不会覆盖较新的云端进度。
  await env.DB.prepare('INSERT INTO 存档 (手机号,存档数据,更新时间) VALUES (?,?,?) ON CONFLICT(手机号) DO UPDATE SET 存档数据=excluded.存档数据,更新时间=excluded.更新时间 WHERE 存档.更新时间 < excluded.更新时间').bind(手机号,数据,时间).run();
  const 最新=await env.DB.prepare('SELECT 存档数据,更新时间 FROM 存档 WHERE 手机号=?').bind(手机号).first();
  const 最新时间=Number(最新?.更新时间)||0;
  if(最新时间!==时间){
    let 最新存档=null; try{最新存档=JSON.parse(最新?.存档数据||'null');}catch{}
    return json({success:false,conflict:true,archive:最新存档,updatedAt:最新时间},409,cors);
  }
  return json({success:true,updatedAt:时间},200,cors);
}
async function 提交反馈(request,env,cors){
 const 用户=await 鉴权(request,env);if(!用户)return json({error:'请先登录'},401,cors);
 await 限流(env,'题目反馈:'+await hash(用户),20);
 const {编号,题号,分类,详情=''}=await request.json();
 if(typeof 编号!=='string'||!/^[\w-]{8,80}$/.test(编号)||typeof 题号!=='string'||题号.length>100||!题号.trim()||!['题干错误','答案争议','解析不清楚'].includes(分类)||typeof 详情!=='string'||详情.length>2000)return json({error:'反馈格式无效，说明最多2000字'},400,cors);
 const 旧=await env.DB.prepare('SELECT 提交人 FROM 题目反馈 WHERE 编号=?').bind(编号).first();
 if(旧)return 旧.提交人===用户?json({success:true,id:编号},200,cors):json({error:'反馈编号冲突，请重试'},409,cors);
 const 时间=Date.now();await env.DB.prepare('INSERT INTO 题目反馈 (编号,提交人,题号,分类,详情,提交时间,更新时间) VALUES (?,?,?,?,?,?,?)').bind(编号,用户,题号,分类,详情.trim(),时间,时间).run();
 return json({success:true,id:编号},200,cors);
}
async function 读取反馈(request,env,cors){
 const 用户=await 鉴权(request,env);if(!用户)return json({error:'请先登录'},401,cors);
 const 参数=new URL(request.url).searchParams,全部=参数.get('scope')==='all',页=Math.max(0,Math.min(10000,parseInt(参数.get('page')||'0',10)||0));
 if(全部&&用户!==管理员手机号)return json({error:'只有管理员可以查看全部反馈'},403,cors);
 const 语句=全部?'SELECT * FROM 题目反馈 ORDER BY 提交时间 DESC,编号 DESC LIMIT 30 OFFSET ?':'SELECT * FROM 题目反馈 WHERE 提交人=? ORDER BY 提交时间 DESC,编号 DESC LIMIT 30 OFFSET ?';
 const 查询=env.DB.prepare(语句),结果=await (全部?查询.bind(页*30):查询.bind(用户,页*30)).all();
 return json({items:结果.results||[],page:页},200,cors);
}
async function 处理反馈(request,env,cors){
 const 用户=await 鉴权(request,env);if(用户!==管理员手机号)return json({error:'只有管理员可以处理反馈'},403,cors);
 const {编号,状态,回复=''}=await request.json();
 if(typeof 编号!=='string'||!['待处理','处理中','已解决','暂不采纳'].includes(状态)||typeof 回复!=='string'||回复.length>2000)return json({error:'处理结果格式无效'},400,cors);
 if(!await env.DB.prepare('SELECT 编号 FROM 题目反馈 WHERE 编号=?').bind(编号).first())return json({error:'反馈不存在'},404,cors);
 const 时间=Date.now();await env.DB.batch([
  env.DB.prepare('UPDATE 题目反馈 SET 状态=?,回复=?,更新时间=? WHERE 编号=?').bind(状态,回复.trim(),时间,编号),
  env.DB.prepare('INSERT INTO 管理操作 (编号,操作人,目标,动作,时间) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),用户,编号,'处理题目反馈：'+状态,时间)
 ]);
 return json({success:true},200,cors);
}
async function 来源键(request){
  const ip=request.headers.get('CF-Connecting-IP');
  // Cloudflare 跨区子请求可能提供统一占位地址；此时仍按账户限流，避免全站共用一个名额。
  return !ip||ip==='2a06:98c0:3600::103'?null:hash(ip);
}
async function 限流(env,键,上限,窗口毫秒=15*60000){
  const 现在=Date.now(),截止=现在+窗口毫秒;
  const 行=await env.DB.prepare('INSERT INTO 访问限流 (键,截止,次数) VALUES (?,?,1) ON CONFLICT(键) DO UPDATE SET 次数=CASE WHEN 访问限流.截止<=? THEN 1 ELSE 访问限流.次数+1 END,截止=CASE WHEN 访问限流.截止<=? THEN excluded.截止 ELSE 访问限流.截止 END RETURNING 次数,截止').bind(键,截止,现在,现在).first();
  if(行.次数>上限){const e=new Error('请求过于频繁');e.status=429;e.retryAfter=Math.max(1,Math.ceil((行.截止-现在)/1000));throw e;}
}
async function 修改密码(request,env,cors){
  const 手机号=await 鉴权(request,env);if(!手机号)return json({error:'登录已失效，请重新登录'},401,cors);
  await 限流(env,'修改密码:'+await hash(手机号),5);
  const {旧密码,新密码,确认密码}=await request.json();
  if(typeof 新密码!=='string'||新密码.length<8||新密码.length>256||新密码!==确认密码)return json({error:'新密码需为8至256位，且两次输入一致'},400,cors);
  if(新密码===旧密码)return json({error:'新密码不能与原密码相同'},400,cors);
  const 用户=await env.DB.prepare('SELECT 密码 FROM 用户 WHERE 手机号=?').bind(手机号).first();
  if(!用户||!await 校验密码(旧密码,用户.密码))return json({error:'当前密码不正确'},400,cors);
  const 摘要=await 密码摘要(新密码);
  // 密码变更与撤销会话在同一事务中完成，包括当前设备。
  await env.DB.batch([
    env.DB.prepare('UPDATE 用户 SET 密码=? WHERE 手机号=?').bind(摘要,手机号),
    env.DB.prepare('DELETE FROM 会话 WHERE 手机号=?').bind(手机号)
  ]);
  return json({success:true,message:'密码已修改，请用新密码重新登录所有设备。'},200,cors);
}
async function 注销会话(request,env,cors,其他){
  const 手机号=await 鉴权(request,env);if(!手机号)return json({error:'登录已失效'},401,cors);
  const 摘要=await hash((request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''));
  await env.DB.prepare(其他?'DELETE FROM 会话 WHERE 手机号=? AND 令牌<>?':'DELETE FROM 会话 WHERE 手机号=? AND 令牌=?').bind(手机号,摘要).run();
  return json({success:true},200,cors);
}
async function 管理日志(request,env,cors){
  if(await 鉴权(request,env)!==管理员手机号)return json({error:'只有管理员可以查看操作记录'},403,cors);
  const 参数=new URL(request.url).searchParams,页=Math.max(0,Math.min(10000,parseInt(参数.get('page')||'0',10)||0));
  const 结果=await env.DB.prepare('SELECT 编号,操作人,目标,动作,时间 FROM 管理操作 ORDER BY 时间 DESC,编号 DESC LIMIT 50 OFFSET ?').bind(页*50).all();
  return json({logs:结果.results||[],page:页},200,cors);
}
function 视图(用户){return {手机号:用户.手机号,名称:用户.名称||`学习者${String(用户.手机号).slice(-4)}`,禁用:Number(用户.禁用)===1,注册时间:Number(用户.注册时间)||0,最后登录:Number(用户.最后登录)||0};}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
async function hash(密码){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(密码));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function 密码摘要(密码,盐){
  盐 ||= [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(密码),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(盐),iterations:100000},key,256);
  return `pbkdf2$${盐}$${[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
}
async function 校验密码(密码,哈希){return typeof 密码==='string'&&密码.length<=256&&哈希===(哈希.startsWith('pbkdf2$')?await 密码摘要(密码,哈希.split('$')[1]):await hash(密码));}
async function token(手机号,env){
  const 值=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT INTO 会话 (令牌,手机号,到期) VALUES (?,?,?)').bind(await hash(值),手机号,Date.now()+7*24*60*60*1000).run();
  return 值;
}
async function 鉴权(request,env){
  const 值=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(/^[a-f0-9]{64}$/.test(值)){
    const 行=await env.DB.prepare('SELECT 用户.手机号 FROM 会话 JOIN 用户 ON 用户.手机号=会话.手机号 WHERE 会话.令牌=? AND 会话.到期>? AND 用户.禁用=0').bind(await hash(值),Date.now()).first();
    if(行?.手机号)return 行.手机号;
  }
  // 历史 JWT 没有可验证的签名，不能作为任何账户（尤其管理员）的身份凭据。
  return null;
}

async function 判分(request,env,cors){
  if(!env.GROQ_API_KEY&&!env.AI)return json({error:'判分服务未配置：请设置 GROQ_API_KEY 或绑定 Workers AI。'},503,cors);
  const 用户=await 鉴权(request,env);
  const 来源=await 来源键(request);
  if(用户)await 限流(env,'判分用户:'+await hash(用户),20,60000);
  else if(来源)await 限流(env,'判分IP:'+来源,20,60000);
  else await 限流(env,'判分匿名',20,60000);
  const 体=await request.json();
  const 题干=String(体.题干??'').slice(0,8000);
  const 题型=String(体.题型??'主观题').slice(0,40);
  const 参考答案=String(体.参考答案??'').slice(0,8000);
  const 评分要点=Array.isArray(体.评分要点)?体.评分要点.map(x=>String(x).slice(0,500)).slice(0,30):[];
  const 满分=Number(体.满分);
  const 学生作答=String(体.学生作答??'').slice(0,8000);
  const 科目=String(体.科目??'专升本').slice(0,40);
  let 截图=typeof 体.截图==='string'?体.截图:'';
  if(!Number.isFinite(满分)||满分<0||满分>200)return json({error:'满分无效'},400,cors);
  if(!题干.trim()&&!截图)return json({error:'请提供题干或答题截图'},400,cors);
  if(截图&&!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(截图)){
    if(截图.startsWith('data:'))return json({error:'截图格式需为 JPEG/PNG/WebP dataURL'},400,cors);
    截图='';
  }
  if(截图&&截图.length>900000)return json({error:'截图过大，请压缩后再试'},413,cors);
  const 要点文=评分要点.length?评分要点.map((x,i)=>`${i+1}. ${x}`).join('\n'):'（无单独要点，请按参考答案的关键步骤给分）';
  const 提示=`你是${科目}阅卷助手。请对照参考答案与评分要点，给学生作答（或答题截图）打分。

【题型】${题型}
【满分】${满分}
【题干】
${题干||'（见截图或参考答案）'}

【参考答案】
${参考答案||'（未提供文字参考答案，请根据题干与评分要点判断）'}

【评分要点】
${要点文}

【学生文字作答】
${学生作答.trim()||'（无文字作答，请根据答题截图判分）'}

请只输出一段 JSON（不要 markdown 代码块），格式严格为：
{"得分":数字,"满分":${满分},"正确":true或false,"理由":"简要说明给分依据"}
其中 得分 为 0 到 满分 的整数；正确 表示是否基本做对（得分≥满分的一半可视为 true）。`;
  const 有图=!!截图;
  const 主模型='qwen/qwen3.8-27b';
  const 备模型='openai/gpt-oss-20b';
  const 模型列表=env.GROQ_API_KEY?(有图?[主模型,备模型]:[主模型,备模型]):[];
  let 原文='',用模=主模型,最后错误=env.GROQ_API_KEY?'':'未配置 GROQ_API_KEY，改用 Workers AI';
  for(const 模型 of 模型列表){
    try{
      const 可用图=有图&&模型===主模型;
      const 用户内容=可用图
        ?[{type:'text',text:提示},{type:'image_url',image_url:{url:截图}}]
        :提示+(有图&&!可用图?'\n（当前模型不支持看图，请仅根据文字作答与参考答案评分；若无文字作答可给 0 分并说明。）':'');
      const 载荷={
        model:模型,
        temperature:0.2,
        max_tokens:1200,
        messages:[
          {role:'system',content:'你是严谨的阅卷助手。只输出合法 JSON 对象，不要 markdown，不要额外文字。'},
          {role:'user',content:用户内容}
        ]
      };
      // qwen 支持 json_object；有图时不强制，避免部分 vision 组合报错
      if(模型===主模型&&!可用图)载荷.response_format={type:'json_object'};
      if(模型===主模型)载荷.reasoning_effort='none';
      const 响应=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        headers:{
          'Authorization':'Bearer '+String(env.GROQ_API_KEY||'').trim(),
          'Content-Type':'application/json',
          'Accept':'application/json',
          'User-Agent':'Mozilla/5.0 (compatible; ZhuanshengbenGrade/8; +https://zhuanshengben-api.adadaadadaaa.workers.dev)'
        },
        body:JSON.stringify(载荷)
      });
      const 原始文本=await 响应.text();
      let 数据={};
      try{数据=JSON.parse(原始文本);}catch{数据={raw:原始文本.slice(0,200)};}
      if(!响应.ok){
        最后错误=(数据?.error?.message||数据?.raw||('HTTP '+响应.status))+' ['+响应.status+'/'+模型+']';
        continue;
      }
      const msg=数据?.choices?.[0]?.message||{};
      原文=(msg.content||msg.reasoning||'').trim();
      // 若 content 为空但 reasoning 里夹了 JSON，一并尝试
      if(!原文&&msg.reasoning)原文=String(msg.reasoning);
      if(!原文.trim()){最后错误='模型未返回内容 ['+模型+']';continue;}
      用模=模型;
      break;
    }catch(e){最后错误=(e.message||String(e))+' ['+模型+']';}
  }
  if(!原文.trim()&&env.AI){
    const ai提示=提示+(有图?'\n（截图无法转发至回退模型，请主要依据文字作答评分。）':'');
    const ai模型列表=['@cf/zai-org/glm-4.7-flash','@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/meta/llama-3.2-3b-instruct','@cf/meta/llama-3.1-8b-instruct-fp8'];
    for(const ai模型 of ai模型列表){
      try{
        const ai=await env.AI.run(ai模型,{
          messages:[
            {role:'system',content:'你是严谨的阅卷助手。只输出合法 JSON 对象，不要 markdown，不要额外文字。'},
            {role:'user',content:ai提示}
          ],
          max_tokens:600,
          temperature:0.2
        });
        原文=抽取AI文本(ai);
        if(原文&&解析模型判分(原文,满分)){用模='workers-ai:'+ai模型;最后错误='';break;}
        if(原文){用模='workers-ai:'+ai模型;最后错误='';break;}
        最后错误=(最后错误?最后错误+'；':'')+'Workers AI 空响应 ['+ai模型+']';
      }catch(e){最后错误=(最后错误?最后错误+'；':'')+'Workers AI '+ai模型+'：'+(e.message||String(e));}
    }
  }
  if(!原文.trim())return json({error:'判分模型暂时不可用：'+(最后错误||'未知错误')},502,cors);
  const 结果=解析模型判分(原文,满分);
  if(!结果)return json({error:'未能解析模型判分结果，请重试或改用文字作答。',raw:原文.slice(0,500)},502,cors);
  return json({得分:结果.得分,满分:结果.满分,正确:结果.正确,理由:结果.理由,model:用模},200,cors);
}
function 抽取AI文本(ai){
  if(ai==null)return '';
  if(typeof ai==='string'){
    const t=ai.trim();
    try{
      const o=JSON.parse(t);
      const c=o?.choices?.[0]?.message?.content??o?.response??o?.result??o?.text;
      if(c!=null&&String(c).trim())return String(c).trim();
    }catch{}
    return t;
  }
  if(typeof ai==='object'){
    const c=ai.response??ai.result??ai.choices?.[0]?.message?.content??ai.text??ai.output_text;
    if(c!=null&&String(c).trim())return String(c).trim();
  }
  return '';
}
function 解析模型判分(原文,默认满分){
  let 文=String(原文||'').trim();
  文=文.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const 候选=[];
  // 优先匹配带「得分」的对象，避免误解析外层 completion 包装
  const 带分=文.match(/\{[^{}]*"得分"\s*:[^{}]*\}/);
  if(带分)候选.push(带分[0]);
  const 块=文.match(/\{[\s\S]*\}/);
  if(块)候选.push(块[0]);
  候选.push(文);
  for(const 段 of 候选){
    try{
      let o=JSON.parse(段);
      // 若是 chat.completion 包装，再取 content
      if(o&&typeof o==='object'&&o.choices?.[0]?.message?.content){
        const 内=解析模型判分(String(o.choices[0].message.content),默认满分);
        if(内)return 内;
      }
      if(o&&typeof o==='object'&&o.得分===undefined&&(o.response||o.result)){
        const 内=解析模型判分(String(o.response||o.result),默认满分);
        if(内)return 内;
      }
      const 满分=Number.isFinite(Number(o.满分))?Number(o.满分):默认满分;
      let 得分=Number(o.得分);
      if(!Number.isFinite(得分))continue;
      得分=Math.max(0,Math.min(满分,Math.round(得分)));
      const 正确=typeof o.正确==='boolean'?o.正确:得分>=满分/2;
      return {得分,满分,正确,理由:String(o.理由||o.说明||'').trim().slice(0,800)||'已完成自动判分。'};
    }catch{/* next */}
  }
  return null;
}

// ===== 社交模块：排行榜、好友、论道（异步 PK）。与上方账户接口共用 D1、鉴权与限流。 =====
// 社交模块：排行榜、好友、论道（异步 PK）。所有接口都要求登录，数据保存在 D1。
const 手机格式=/^1[3-9]\d{9}$/,键格式=/^[a-f0-9]{12}$/;
const 榜单字段={修为:'修为',战力:'战力',金币:'金币'};
const 统计字段=['修为','战力','金币','答题数','正确率','练习次数'];
const 论道题数=10,论道有效期=7*24*60*60*1000;

async function 补齐社交表(env){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS 社交资料 (手机号 TEXT PRIMARY KEY, 用户键 TEXT NOT NULL DEFAULT '', 公开排行 INTEGER NOT NULL DEFAULT 1, 允许好友 INTEGER NOT NULL DEFAULT 1, 修为 INTEGER NOT NULL DEFAULT 0, 战力 INTEGER NOT NULL DEFAULT 0, 金币 INTEGER NOT NULL DEFAULT 0, 答题数 INTEGER NOT NULL DEFAULT 0, 正确率 INTEGER NOT NULL DEFAULT 0, 练习次数 INTEGER NOT NULL DEFAULT 0, 更新时间 INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 社交资料键 ON 社交资料(用户键)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS 好友关系 (编号 TEXT PRIMARY KEY, 发起人 TEXT NOT NULL, 接收人 TEXT NOT NULL, 状态 TEXT NOT NULL DEFAULT '待确认', 创建时间 INTEGER NOT NULL, 更新时间 INTEGER NOT NULL, UNIQUE(发起人,接收人))").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 好友关系接收人 ON 好友关系(接收人)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS 对战 (编号 TEXT PRIMARY KEY, 发起人 TEXT NOT NULL, 对手 TEXT NOT NULL, 模块 TEXT NOT NULL DEFAULT '单选', 题目编号 TEXT NOT NULL, 状态 TEXT NOT NULL DEFAULT '待应战', 发起人分数 INTEGER, 发起人用时 INTEGER, 对手分数 INTEGER, 对手用时 INTEGER, 创建时间 INTEGER NOT NULL, 更新时间 INTEGER NOT NULL)").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 对战发起人 ON 对战(发起人,创建时间)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 对战对手 ON 对战(对手,创建时间)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS 竞技场 (编号 TEXT PRIMARY KEY, 发起人 TEXT NOT NULL, 对手 TEXT NOT NULL, 题目编号 TEXT NOT NULL, 状态 TEXT NOT NULL DEFAULT '待接受', 发起人血量 INTEGER NOT NULL DEFAULT 100, 对手血量 INTEGER NOT NULL DEFAULT 100, 发起人连击 INTEGER NOT NULL DEFAULT 0, 对手连击 INTEGER NOT NULL DEFAULT 0, 发起人进度 INTEGER NOT NULL DEFAULT 0, 对手进度 INTEGER NOT NULL DEFAULT 0, 发起人武器 TEXT NOT NULL DEFAULT '', 对手武器 TEXT NOT NULL DEFAULT '', 发起人答卷 TEXT NOT NULL DEFAULT '{}', 对手答卷 TEXT NOT NULL DEFAULT '{}', 回合日志 TEXT NOT NULL DEFAULT '[]', 胜者 TEXT, 创建时间 INTEGER NOT NULL, 更新时间 INTEGER NOT NULL)").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS 竞技场双方 ON 竞技场(发起人,对手,创建时间)').run();
}

// 返回 null 表示不是社交接口，由主路由继续处理。
async function 社交路由(request,env,cors,url,工具){
  const 路径=url.pathname,方法=request.method;
  if(!/^\/api\/(social|friends|leaderboard|pk|arena)$/.test(路径))return null;
  const {json}=工具;
  const 我=await 工具.鉴权(request,env);if(!我)return json({error:'请先登录'},401,cors);
  const 上下文={env,cors,我,url,request,...工具};
  if(路径==='/api/social'&&方法==='GET')return 我的资料(上下文);
  if(路径==='/api/social'&&方法==='PUT')return 更新资料(上下文);
  if(路径==='/api/leaderboard'&&方法==='GET')return 排行榜(上下文);
  if(路径==='/api/friends'&&方法==='GET')return 好友列表(上下文);
  if(路径==='/api/friends'&&方法==='POST')return 申请好友(上下文);
  if(路径==='/api/friends'&&方法==='PUT')return 处理好友(上下文);
  if(路径==='/api/pk'&&方法==='GET')return 论道列表(上下文);
  if(路径==='/api/pk'&&方法==='POST')return 发起论道(上下文);
  if(路径==='/api/pk'&&方法==='PUT')return 回应论道(上下文);
  if(路径==='/api/arena'&&方法==='GET')return 竞技场查询(上下文);
  if(路径==='/api/arena'&&方法==='POST')return 发起切磋(上下文);
  if(路径==='/api/arena'&&方法==='PUT')return 回应切磋(上下文);
  return json({error:'Not Found'},404,cors);
}

async function 确保资料(env,hash,手机号){
  await env.DB.prepare('INSERT OR IGNORE INTO 社交资料 (手机号,用户键,更新时间) VALUES (?,?,?)').bind(手机号,(await hash('用户键:'+手机号)).slice(0,12),Date.now()).run();
}
const 公开视图=(行,我)=>({用户键:行.用户键,名称:行.名称||`学习者${String(行.手机号).slice(-4)}`,尾号:String(行.手机号).slice(-4),修为:Number(行.修为)||0,战力:Number(行.战力)||0,金币:Number(行.金币)||0,答题数:Number(行.答题数)||0,正确率:Number(行.正确率)||0,练习次数:Number(行.练习次数)||0,更新时间:Number(行.更新时间)||0,是我:行.手机号===我});
async function 读取资料(env,hash,手机号){
  await 确保资料(env,hash,手机号);
  return env.DB.prepare('SELECT 社交资料.*,用户.名称 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.手机号=?').bind(手机号).first();
}
async function 好友手机号集合(env,我){
  const 结果=await env.DB.prepare("SELECT 发起人,接收人 FROM 好友关系 WHERE 状态='已接受' AND (发起人=? OR 接收人=?)").bind(我,我).all();
  return new Set((结果.results||[]).map(r=>r.发起人===我?r.接收人:r.发起人));
}

async function 我的资料({env,cors,我,hash,json}){
  const 行=await 读取资料(env,hash,我);
  const 待处理=await env.DB.prepare("SELECT COUNT(*) AS n FROM 好友关系 WHERE 接收人=? AND 状态='待确认'").bind(我).first();
  const 待应战=await env.DB.prepare("SELECT COUNT(*) AS n FROM 对战 WHERE 对手=? AND 状态='待应战' AND 创建时间>?").bind(我,Date.now()-论道有效期).first();
  const 待切磋=await env.DB.prepare("SELECT COUNT(*) AS n FROM 竞技场 WHERE 对手=? AND 状态='待接受' AND 创建时间>?").bind(我,Date.now()-论道有效期).first();
  const 进行中=await env.DB.prepare("SELECT 编号 FROM 竞技场 WHERE 状态='进行中' AND (发起人=? OR 对手=?) ORDER BY 更新时间 DESC LIMIT 1").bind(我,我).first();
  return json({profile:{...公开视图(行,我),手机号:我,公开排行:Number(行.公开排行)===1,允许好友:Number(行.允许好友)===1},待处理好友:Number(待处理?.n)||0,待应战:Number(待应战?.n)||0,待切磋:Number(待切磋?.n)||0,进行中竞技场:进行中?.编号||null},200,cors);
}
async function 更新资料({env,cors,我,request,hash,json,限流}){
  await 限流(env,'社交更新:'+await hash(我),240);
  const 数据=await request.json();if(!数据||typeof 数据!=='object')return json({error:'请求格式无效'},400,cors);
  await 确保资料(env,hash,我);
  const 赋值=[],参数=[];
  if(数据.统计&&typeof 数据.统计==='object'){
    for(const 键 of 统计字段){
      if(数据.统计[键]===undefined)continue;
      const 值=Number(数据.统计[键]);
      if(!Number.isFinite(值)||值<0||值>1e9||(键==='正确率'&&值>100))return json({error:`统计字段 ${键} 无效`},400,cors);
      赋值.push(`${键}=?`);参数.push(Math.round(值));
    }
  }
  if(数据.设置&&typeof 数据.设置==='object'){
    for(const 键 of ['公开排行','允许好友']){
      if(数据.设置[键]===undefined)continue;
      if(typeof 数据.设置[键]!=='boolean')return json({error:`设置 ${键} 需为布尔值`},400,cors);
      赋值.push(`${键}=?`);参数.push(数据.设置[键]?1:0);
    }
  }
  if(!赋值.length)return json({error:'没有需要更新的内容'},400,cors);
  赋值.push('更新时间=?');参数.push(Date.now(),我);
  await env.DB.prepare(`UPDATE 社交资料 SET ${赋值.join(',')} WHERE 手机号=?`).bind(...参数).run();
  const 行=await 读取资料(env,hash,我);
  return json({success:true,profile:{...公开视图(行,我),手机号:我,公开排行:Number(行.公开排行)===1,允许好友:Number(行.允许好友)===1}},200,cors);
}
async function 排行榜({env,cors,我,url,hash,json}){
  const 榜=url.searchParams.get('榜')||'修为',范围=url.searchParams.get('范围')==='好友'?'好友':'全站';
  const 字段=榜单字段[榜];if(!字段)return json({error:'榜单类型无效'},400,cors);
  const 我的=await 读取资料(env,hash,我);
  let 行列表,总人数,我的名次=null;
  if(范围==='全站'){
    const 结果=await env.DB.prepare(`SELECT 社交资料.*,用户.名称 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.公开排行=1 AND 用户.禁用=0 AND 社交资料.更新时间>0 ORDER BY 社交资料.${字段} DESC, 社交资料.更新时间 ASC LIMIT 50`).all();
    行列表=结果.results||[];
    总人数=Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.公开排行=1 AND 用户.禁用=0 AND 社交资料.更新时间>0').first())?.n)||0;
    if(Number(我的.公开排行)===1){
      const 前面=await env.DB.prepare(`SELECT COUNT(*) AS n FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.公开排行=1 AND 用户.禁用=0 AND 社交资料.更新时间>0 AND 社交资料.${字段}>?`).bind(Number(我的[字段])||0).first();
      我的名次=(Number(前面?.n)||0)+1;
    }
  }else{
    const 好友=await 好友手机号集合(env,我);好友.add(我);
    const 列表=[...好友];
    const 结果=await env.DB.prepare(`SELECT 社交资料.*,用户.名称 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 用户.禁用=0 AND 社交资料.手机号 IN (${列表.map(()=>'?').join(',')}) ORDER BY 社交资料.${字段} DESC, 社交资料.更新时间 ASC LIMIT 200`).bind(...列表).all();
    行列表=结果.results||[];总人数=行列表.length;
    const 位置=行列表.findIndex(r=>r.手机号===我);我的名次=位置<0?null:位置+1;
  }
  const 好友集合=范围==='好友'?null:await 好友手机号集合(env,我);
  return json({榜,范围,总人数,我的名次,我公开:Number(我的.公开排行)===1,items:行列表.map((r,i)=>({名次:i+1,...公开视图(r,我),是好友:好友集合?好友集合.has(r.手机号):r.手机号!==我}))},200,cors);
}
async function 好友列表({env,cors,我,hash,json}){
  await 确保资料(env,hash,我);
  const 结果=await env.DB.prepare('SELECT 好友关系.编号,好友关系.发起人,好友关系.接收人,好友关系.状态,好友关系.创建时间,好友关系.更新时间 FROM 好友关系 WHERE (发起人=? OR 接收人=?) AND 状态<>? ORDER BY 更新时间 DESC').bind(我,我,'已拒绝').all();
  const 关系=(结果.results||[]);
  const 对方号码=[...new Set(关系.map(r=>r.发起人===我?r.接收人:r.发起人))];
  const 资料=new Map();
  if(对方号码.length){
    for(const 号 of 对方号码)await 确保资料(env,hash,号);
    const 行=await env.DB.prepare(`SELECT 社交资料.*,用户.名称,用户.禁用 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.手机号 IN (${对方号码.map(()=>'?').join(',')})`).bind(...对方号码).all();
    for(const r of (行.results||[]))资料.set(r.手机号,r);
  }
  const 条目=r=>{const 号=r.发起人===我?r.接收人:r.发起人,p=资料.get(号);return p?{编号:r.编号,...公开视图(p,我),创建时间:Number(r.创建时间)||0,更新时间:Number(r.更新时间)||0,已禁用:Number(p.禁用)===1}:null;};
  const 好友=关系.filter(r=>r.状态==='已接受').map(条目).filter(Boolean);
  const 收到=关系.filter(r=>r.状态==='待确认'&&r.接收人===我).map(条目).filter(Boolean);
  const 发出=关系.filter(r=>r.状态==='待确认'&&r.发起人===我).map(条目).filter(Boolean);
  return json({好友,收到,发出},200,cors);
}
async function 查找用户(env,目标){
  if(typeof 目标!=='string')return null;
  目标=目标.trim();
  if(手机格式.test(目标))return env.DB.prepare('SELECT 手机号,禁用 FROM 用户 WHERE 手机号=?').bind(目标).first();
  if(键格式.test(目标))return env.DB.prepare('SELECT 用户.手机号,用户.禁用 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.用户键=?').bind(目标).first();
  return null;
}
async function 申请好友({env,cors,我,request,hash,json,限流}){
  await 限流(env,'好友申请:'+await hash(我),30);
  const {目标}=await request.json();
  const 用户=await 查找用户(env,目标);
  if(!用户)return json({error:'未找到该道友，请核对手机号或道友码'},404,cors);
  if(用户.手机号===我)return json({error:'不能添加自己为好友'},400,cors);
  if(Number(用户.禁用)===1)return json({error:'该账号不可添加'},403,cors);
  const 对方=用户.手机号;await 确保资料(env,hash,对方);await 确保资料(env,hash,我);
  const 资料=await env.DB.prepare('SELECT 允许好友 FROM 社交资料 WHERE 手机号=?').bind(对方).first();
  if(Number(资料?.允许好友)!==1)return json({error:'对方暂不接受好友申请'},403,cors);
  const 已有=await env.DB.prepare('SELECT * FROM 好友关系 WHERE (发起人=? AND 接收人=?) OR (发起人=? AND 接收人=?)').bind(我,对方,对方,我).all();
  const 时间=Date.now();
  for(const r of (已有.results||[])){
    if(r.状态==='已接受')return json({error:'你们已经是好友'},409,cors);
    if(r.状态==='待确认'&&r.发起人===我)return json({error:'申请已发送，等待对方确认'},409,cors);
    if(r.状态==='待确认'&&r.接收人===我){
      await env.DB.prepare("UPDATE 好友关系 SET 状态='已接受',更新时间=? WHERE 编号=?").bind(时间,r.编号).run();
      return json({success:true,已接受:true,message:'对方也向你发过申请，已直接成为好友'},200,cors);
    }
  }
  const 我发过=(已有.results||[]).find(r=>r.发起人===我);
  if(我发过)await env.DB.prepare("UPDATE 好友关系 SET 状态='待确认',创建时间=?,更新时间=? WHERE 编号=?").bind(时间,时间,我发过.编号).run();
  else await env.DB.prepare("INSERT INTO 好友关系 (编号,发起人,接收人,状态,创建时间,更新时间) VALUES (?,?,?,'待确认',?,?)").bind(crypto.randomUUID(),我,对方,时间,时间).run();
  return json({success:true,已接受:false,message:'好友申请已发送'},200,cors);
}
async function 处理好友({env,cors,我,request,json}){
  const {编号,动作}=await request.json();
  if(typeof 编号!=='string'||!['接受','拒绝','删除'].includes(动作))return json({error:'参数无效'},400,cors);
  const r=await env.DB.prepare('SELECT * FROM 好友关系 WHERE 编号=?').bind(编号).first();
  if(!r||(r.发起人!==我&&r.接收人!==我))return json({error:'好友关系不存在'},404,cors);
  const 时间=Date.now();
  if(动作==='删除'){await env.DB.prepare('DELETE FROM 好友关系 WHERE 编号=?').bind(编号).run();return json({success:true},200,cors);}
  if(r.接收人!==我||r.状态!=='待确认')return json({error:'只能处理发给你的待确认申请'},400,cors);
  await env.DB.prepare('UPDATE 好友关系 SET 状态=?,更新时间=? WHERE 编号=?').bind(动作==='接受'?'已接受':'已拒绝',时间,编号).run();
  return json({success:true},200,cors);
}
function 论道视图(r,我,资料){
  const 我是发起人=r.发起人===我,人=号=>{const p=资料.get(号);return p?{用户键:p.用户键,名称:p.名称||`学习者${String(号).slice(-4)}`,尾号:String(号).slice(-4)}:{用户键:'',名称:'道友',尾号:String(号).slice(-4)};};
  let 题目编号=[];try{题目编号=JSON.parse(r.题目编号);}catch{}
  let 结果=null;
  if(r.状态==='已结束'){
    const 我分=我是发起人?r.发起人分数:r.对手分数,他分=我是发起人?r.对手分数:r.发起人分数,我时=我是发起人?r.发起人用时:r.对手用时,他时=我是发起人?r.对手用时:r.发起人用时;
    结果=我分>他分?'胜':我分<他分?'负':我时<他时?'胜':我时>他时?'负':'平';
  }
  return {编号:r.编号,模块:r.模块,题目编号,状态:r.状态,我是发起人,发起人:人(r.发起人),对手:人(r.对手),发起人分数:r.发起人分数,发起人用时:r.发起人用时,对手分数:r.对手分数,对手用时:r.对手用时,创建时间:Number(r.创建时间)||0,更新时间:Number(r.更新时间)||0,结果};
}
async function 载入相关资料(env,hash,号码){
  const 列表=[...new Set(号码)];if(!列表.length)return new Map();
  for(const 号 of 列表)await 确保资料(env,hash,号);
  const 行=await env.DB.prepare(`SELECT 社交资料.手机号,社交资料.用户键,用户.名称 FROM 社交资料 JOIN 用户 ON 用户.手机号=社交资料.手机号 WHERE 社交资料.手机号 IN (${列表.map(()=>'?').join(',')})`).bind(...列表).all();
  return new Map((行.results||[]).map(r=>[r.手机号,r]));
}
async function 论道列表({env,cors,我,hash,json}){
  const 现在=Date.now();
  await env.DB.prepare("UPDATE 对战 SET 状态='已过期',更新时间=? WHERE 状态='待应战' AND 创建时间<? AND (发起人=? OR 对手=?)").bind(现在,现在-论道有效期,我,我).run();
  const 结果=await env.DB.prepare('SELECT * FROM 对战 WHERE 发起人=? OR 对手=? ORDER BY 更新时间 DESC LIMIT 60').bind(我,我).all();
  const 行列表=结果.results||[];
  const 资料=await 载入相关资料(env,hash,行列表.flatMap(r=>[r.发起人,r.对手]));
  const 全部=行列表.map(r=>论道视图(r,我,资料));
  return json({收到:全部.filter(x=>x.状态==='待应战'&&!x.我是发起人),发出:全部.filter(x=>x.状态==='待应战'&&x.我是发起人),已结束:全部.filter(x=>x.状态!=='待应战').slice(0,30)},200,cors);
}
function 校验成绩(分数,用时,题数){
  const 分=Number(分数),时=Number(用时);
  if(!Number.isInteger(分)||分<0||分>题数)return '分数无效';
  if(!Number.isInteger(时)||时<0||时>3600000)return '用时无效';
  return null;
}
async function 发起论道({env,cors,我,request,hash,json,限流}){
  await 限流(env,'发起论道:'+await hash(我),30);
  const {对手,模块='单选',题目编号,分数,用时}=await request.json();
  const 用户=await 查找用户(env,对手);
  if(!用户||用户.手机号===我)return json({error:'请选择一位好友作为对手'},400,cors);
  const 好友=await 好友手机号集合(env,我);
  if(!好友.has(用户.手机号))return json({error:'只能与好友论道，请先添加好友'},403,cors);
  if(模块!=='单选')return json({error:'当前只支持单选论道'},400,cors);
  if(!Array.isArray(题目编号)||题目编号.length!==论道题数||new Set(题目编号).size!==论道题数||!题目编号.every(x=>typeof x==='string'&&x.length>0&&x.length<=60&&!/[\u0000-\u001f]/.test(x)))return json({error:`题目编号需为 ${论道题数} 道不重复的题`},400,cors);
  const 错误=校验成绩(分数,用时,论道题数);if(错误)return json({error:错误},400,cors);
  const 现在=Date.now();
  const 未完=await env.DB.prepare("SELECT 编号 FROM 对战 WHERE 发起人=? AND 对手=? AND 状态='待应战' AND 创建时间>?").bind(我,用户.手机号,现在-论道有效期).first();
  if(未完)return json({error:'对方还有一局你发起的论道未应战，请稍后再约'},409,cors);
  const 编号=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO 对战 (编号,发起人,对手,模块,题目编号,状态,发起人分数,发起人用时,创建时间,更新时间) VALUES (?,?,?,?,?,'待应战',?,?,?,?)").bind(编号,我,用户.手机号,模块,JSON.stringify(题目编号),Number(分数),Number(用时),现在,现在).run();
  return json({success:true,编号},200,cors);
}
async function 回应论道({env,cors,我,request,hash,json}){
  const {编号,动作,分数,用时}=await request.json();
  if(typeof 编号!=='string'||!['应战','拒绝'].includes(动作))return json({error:'参数无效'},400,cors);
  const r=await env.DB.prepare('SELECT * FROM 对战 WHERE 编号=?').bind(编号).first();
  if(!r||r.对手!==我)return json({error:'论道不存在'},404,cors);
  const 现在=Date.now();
  if(r.状态!=='待应战'||r.创建时间<现在-论道有效期)return json({error:'这局论道已经结束或过期'},409,cors);
  if(动作==='拒绝'){
    await env.DB.prepare("UPDATE 对战 SET 状态='已拒绝',更新时间=? WHERE 编号=? AND 状态='待应战'").bind(现在,编号).run();
    return json({success:true},200,cors);
  }
  const 错误=校验成绩(分数,用时,论道题数);if(错误)return json({error:错误},400,cors);
  const 写入=await env.DB.prepare("UPDATE 对战 SET 状态='已结束',对手分数=?,对手用时=?,更新时间=? WHERE 编号=? AND 状态='待应战'").bind(Number(分数),Number(用时),现在,编号).run();
  if(!写入.meta?.changes)return json({error:'这局论道已被处理'},409,cors);
  const 新=await env.DB.prepare('SELECT * FROM 对战 WHERE 编号=?').bind(编号).first();
  const 资料=await 载入相关资料(env,hash,[新.发起人,新.对手]);
  return json({success:true,对战:论道视图(新,我,资料)},200,cors);
}


const 切磋题数=10,切磋有效期=论道有效期,基础伤害=12,大招伤害=28;

function 解析武器(文){
  try{const o=JSON.parse(文||'');return o&&typeof o==='object'?o:{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};}catch{return {编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};}
}
function 竞技场视图(r,我,资料){
  const 我是发起人=r.发起人===我;
  const 人=号=>{const p=资料.get(号);return p?{用户键:p.用户键,名称:p.名称||`学习者${String(号).slice(-4)}`,尾号:String(号).slice(-4)}:{用户键:'',名称:'道友',尾号:String(号).slice(-4)};};
  let 题目编号=[],回合日志=[],发起人答卷={},对手答卷={};
  try{题目编号=JSON.parse(r.题目编号);}catch{}
  try{回合日志=JSON.parse(r.回合日志||'[]');}catch{}
  try{发起人答卷=JSON.parse(r.发起人答卷||'{}');}catch{}
  try{对手答卷=JSON.parse(r.对手答卷||'{}');}catch{}
  return {
    编号:r.编号,状态:r.状态,我是发起人,题目编号,
    发起人:人(r.发起人),对手:人(r.对手),
    我的血量:我是发起人?r.发起人血量:r.对手血量,
    对方血量:我是发起人?r.对手血量:r.发起人血量,
    我的连击:我是发起人?r.发起人连击:r.对手连击,
    对方连击:我是发起人?r.对手连击:r.发起人连击,
    我的进度:我是发起人?r.发起人进度:r.对手进度,
    对方进度:我是发起人?r.对手进度:r.发起人进度,
    我的武器:解析武器(我是发起人?r.发起人武器:r.对手武器),
    对方武器:解析武器(我是发起人?r.对手武器:r.发起人武器),
    我的答卷:我是发起人?发起人答卷:对手答卷,
    回合日志,胜者:r.胜者?人(r.胜者):null,胜者是我:r.胜者===我,我的手机号:我,
    创建时间:Number(r.创建时间)||0,更新时间:Number(r.更新时间)||0
  };
}
async function 竞技场查询({env,cors,我,url,hash,json}){
  await 补齐社交表(env);
  const 编号=url.searchParams.get('id');
  const 现在=Date.now();
  await env.DB.prepare("UPDATE 竞技场 SET 状态='已过期',更新时间=? WHERE 状态='待接受' AND 创建时间<? AND (发起人=? OR 对手=?)").bind(现在,现在-切磋有效期,我,我).run();
  if(编号){
    const r=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 编号=?').bind(编号).first();
    if(!r||(r.发起人!==我&&r.对手!==我))return json({error:'对局不存在'},404,cors);
    const 资料=await 载入相关资料(env,hash,[r.发起人,r.对手]);
    return json({对局:竞技场视图(r,我,资料)},200,cors);
  }
  const 结果=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 发起人=? OR 对手=? ORDER BY 更新时间 DESC LIMIT 40').bind(我,我).all();
  const 行列表=结果.results||[];
  const 资料=await 载入相关资料(env,hash,行列表.flatMap(r=>[r.发起人,r.对手]));
  const 全部=行列表.map(r=>竞技场视图(r,我,资料));
  return json({
    待接受:全部.filter(x=>x.状态==='待接受'&&!x.我是发起人),
    已发出:全部.filter(x=>x.状态==='待接受'&&x.我是发起人),
    进行中:全部.filter(x=>x.状态==='进行中'),
    已结束:全部.filter(x=>!['待接受','进行中'].includes(x.状态)).slice(0,20)
  },200,cors);
}
async function 发起切磋({env,cors,我,request,hash,json,限流}){
  await 补齐社交表(env);
  await 限流(env,'发起切磋:'+await hash(我),30);
  const {对手,题目编号,武器}=await request.json();
  const 用户=await 查找用户(env,对手);
  if(!用户||用户.手机号===我)return json({error:'请选择一位好友发起切磋'},400,cors);
  const 好友=await 好友手机号集合(env,我);
  if(!好友.has(用户.手机号))return json({error:'只能与好友切磋'},403,cors);
  if(!Array.isArray(题目编号)||题目编号.length!==切磋题数||new Set(题目编号).size!==切磋题数||!题目编号.every(x=>typeof x==='string'&&x.length>0&&x.length<=60))return json({error:`题目编号需为 ${切磋题数} 道不重复的题`},400,cors);
  const 武=武器&&typeof 武器==='object'?{编号:String(武器.编号||'').slice(0,40),名称:String(武器.名称||'青芒木剑').slice(0,40),特效:String(武器.特效||'木剑').slice(0,20),色:String(武器.色||'#5eead4').slice(0,20),战力:Math.min(2000,Math.max(0,Number(武器.战力)||10))}:{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};
  const 现在=Date.now();
  const 进行中=await env.DB.prepare("SELECT 编号 FROM 竞技场 WHERE 状态 IN ('待接受','进行中') AND ((发起人=? AND 对手=?) OR (发起人=? AND 对手=?)) AND 创建时间>?").bind(我,用户.手机号,用户.手机号,我,现在-切磋有效期).first();
  if(进行中)return json({error:'你们已有一局未完成的切磋'},409,cors);
  const 编号=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO 竞技场 (编号,发起人,对手,题目编号,状态,发起人武器,创建时间,更新时间) VALUES (?,?,?,?,'待接受',?,?,?)").bind(编号,我,用户.手机号,JSON.stringify(题目编号),JSON.stringify(武),现在,现在).run();
  return json({success:true,编号,状态:'待接受'},200,cors);
}
async function 回应切磋({env,cors,我,request,hash,json,限流}){
  await 补齐社交表(env);
  const 体=await request.json();
  const {编号,动作}=体;
  if(typeof 编号!=='string'||!['接受','拒绝','答题','放弃'].includes(动作))return json({error:'参数无效'},400,cors);
  const r=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 编号=?').bind(编号).first();
  if(!r||(r.发起人!==我&&r.对手!==我))return json({error:'对局不存在'},404,cors);
  const 现在=Date.now();
  const 资料=await 载入相关资料(env,hash,[r.发起人,r.对手]);

  if(动作==='拒绝'){
    if(r.对手!==我||r.状态!=='待接受')return json({error:'只能拒绝发给你的切磋邀请'},400,cors);
    await env.DB.prepare("UPDATE 竞技场 SET 状态='已拒绝',更新时间=? WHERE 编号=? AND 状态='待接受'").bind(现在,编号).run();
    return json({success:true},200,cors);
  }
  if(动作==='放弃'){
    if(r.状态!=='进行中'&&r.状态!=='待接受')return json({error:'对局已结束'},409,cors);
    const 胜者=r.发起人===我?r.对手:r.发起人;
    await env.DB.prepare("UPDATE 竞技场 SET 状态='已结束',胜者=?,更新时间=? WHERE 编号=?").bind(胜者,现在,编号).run();
    const 新=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 编号=?').bind(编号).first();
    return json({success:true,对局:竞技场视图(新,我,资料)},200,cors);
  }
  if(动作==='接受'){
    if(r.对手!==我||r.状态!=='待接受')return json({error:'只能接受发给你的切磋邀请'},400,cors);
    if(r.创建时间<现在-切磋有效期)return json({error:'邀请已过期'},409,cors);
    const 武=体.武器&&typeof 体.武器==='object'?{编号:String(体.武器.编号||'').slice(0,40),名称:String(体.武器.名称||'青芒木剑').slice(0,40),特效:String(体.武器.特效||'木剑').slice(0,20),色:String(体.武器.色||'#5eead4').slice(0,20),战力:Math.min(2000,Math.max(0,Number(体.武器.战力)||10))}:{编号:'默认-木剑',名称:'青芒木剑',特效:'木剑',色:'#5eead4',战力:10};
    const 写入=await env.DB.prepare("UPDATE 竞技场 SET 状态='进行中',对手武器=?,更新时间=? WHERE 编号=? AND 状态='待接受'").bind(JSON.stringify(武),现在,编号).run();
    if(!写入.meta?.changes)return json({error:'邀请已被处理'},409,cors);
    const 新=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 编号=?').bind(编号).first();
    return json({success:true,对局:竞技场视图(新,我,资料),跳转:true},200,cors);
  }
  // 答题
  await 限流(env,'切磋答题:'+await hash(我),120);
  if(r.状态!=='进行中')return json({error:'对局未在进行中'},409,cors);
  let 题目编号=[];try{题目编号=JSON.parse(r.题目编号);}catch{}
  const 题号=体.题目编号,选项=体.选项,正确=!!体.正确;
  if(typeof 题号!=='string'||!题目编号.includes(题号)||!/^[ABCD]$/.test(选项||''))return json({error:'答题参数无效'},400,cors);
  const 我是发起人=r.发起人===我;
  let 我答={};try{我答=JSON.parse(我是发起人?r.发起人答卷:r.对手答卷||'{}');}catch{}
  if(我答[题号])return json({error:'这道题已经答过'},409,cors);
  我答[题号]=选项;
  let 日志=[];try{日志=JSON.parse(r.回合日志||'[]');}catch{}
  let 我血=我是发起人?r.发起人血量:r.对手血量;
  let 他血=我是发起人?r.对手血量:r.发起人血量;
  let 连击=我是发起人?r.发起人连击:r.对手连击;
  let 进度=我是发起人?r.发起人进度:r.对手进度;
  const 武=解析武器(我是发起人?r.发起人武器:r.对手武器);
  let 事件=null;
  if(正确){
    连击+=1;进度+=1;
    const 大招=连击>=3;
    const 伤=Math.min(45,Math.round((大招?大招伤害:基础伤害)*(1+(武.战力||10)/800)));
    他血=Math.max(0,他血-伤);
    if(大招)连击=0;
    事件={类型:大招?'大招':'攻击',谁:我,正确:true,伤害:伤,特效:武.特效,色:武.色,武器:武.名称,连击:大招?3:连击,时间:现在,题号};
  }else{
    连击=0;进度+=1;
    事件={类型:'失手',谁:我,正确:false,伤害:0,特效:武.特效,色:武.色,武器:武.名称,连击:0,时间:现在,题号};
  }
  日志.push(事件);
  let 状态='进行中',胜者=null;
  if(他血<=0){状态='已结束';胜者=我;}
  else if(Object.keys(我答).length>=切磋题数){
    // 等双方答完或一方血空
    const 他答={};try{Object.assign(他答,JSON.parse(我是发起人?r.对手答卷:r.发起人答卷||'{}'));}catch{}
    if(Object.keys(他答).length>=切磋题数){
      状态='已结束';
      if(我血>他血)胜者=我;else if(他血>我血)胜者=我是发起人?r.对手:r.发起人;
      else 胜者=null; // 平局
    }
  }
  const 答卷字段=我是发起人?'发起人答卷':'对手答卷';
  const 血我字段=我是发起人?'发起人血量':'对手血量';
  const 血他字段=我是发起人?'对手血量':'发起人血量';
  const 连字段=我是发起人?'发起人连击':'对手连击';
  const 进度字段=我是发起人?'发起人进度':'对手进度';
  await env.DB.prepare(`UPDATE 竞技场 SET ${答卷字段}=?,${血我字段}=?,${血他字段}=?,${连字段}=?,${进度字段}=?,回合日志=?,状态=?,胜者=?,更新时间=? WHERE 编号=? AND 状态='进行中'`)
    .bind(JSON.stringify(我答),我血,他血,连击,进度,JSON.stringify(日志),状态,胜者,现在,编号).run();
  const 新=await env.DB.prepare('SELECT * FROM 竞技场 WHERE 编号=?').bind(编号).first();
  return json({success:true,事件,对局:竞技场视图(新,我,资料)},200,cors);
}
