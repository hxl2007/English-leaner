const 请求 = (操作) => new Promise((完成, 拒绝) => { 操作.onsuccess = () => 完成(操作.result); 操作.onerror = () => 拒绝(操作.error); });
let 数据库;
export async function 打开存档() {
  const 操作 = indexedDB.open('升本练习室', 1);
  操作.onupgradeneeded = () => 操作.result.createObjectStore('存档');
  数据库 = await 请求(操作);
  return 读取();
}
export function 空存档() { return {版本:3, 草稿:null, 记录:[], 收藏:[], 已抽原创:[], 消费金币:0, 背包:{}, 小段:1}; }
export async function 读取() {
  return (await 请求(数据库.transaction('存档').objectStore('存档').get('学习'))) || 空存档();
}
export function 更新(操作) {
  return new Promise((完成, 拒绝) => {
    const 事务 = 数据库.transaction('存档', 'readwrite');
    const 仓库 = 事务.objectStore('存档');
    const 查询 = 仓库.get('学习');
    let 最新, 异常;
    查询.onsuccess = () => {
      try { 最新 = 操作(查询.result || 空存档()); 仓库.put(最新, '学习'); }
      catch (错误) { 异常 = 错误; 事务.abort(); }
    };
    事务.oncomplete = () => 完成(最新);
    事务.onabort = 事务.onerror = () => 拒绝(异常 || 事务.error || new Error('存档写入失败'));
  });
}
export function 判题(题目编号, 作答, 答案) { return 答案[题目编号].正确选项.includes(作答); }
export function 评分(题目编号, 作答, 答案) {
  if (题目编号.length !== 25 || !题目编号.every(q => /^[ABCD]$/.test(作答[q] || ''))) throw new Error('请完成全部 25 道题后再提交。');
  const 对错 = 题目编号.map(q => 判题(q, 作答[q], 答案));
  return {对错, 分数:对错.filter(Boolean).length * 4, 金币:25};
}
export function 总金币(存档) { return 存档.记录.reduce((合计, r) => 合计 + r.金币, 0); }
