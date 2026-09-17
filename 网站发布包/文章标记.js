// 只保存纯文本位置与标记类型，不从存档插入 HTML。
export function 读取选区(容器){
 const s=getSelection();if(!容器||!s?.rangeCount||s.isCollapsed)return null;
 const r=s.getRangeAt(0);if(!容器.contains(r.startContainer)||!容器.contains(r.endContainer))return null;
 const before=document.createRange();before.selectNodeContents(容器);before.setEnd(r.startContainer,r.startOffset);
 return {开始:before.toString().length,结束:before.toString().length+r.toString().length};
}
export function 绘制标记(容器,列表=[]){
 if(!容器)return;
 const 文本长度=容器.textContent.length;
 const 范围=列表.filter(x=>Number.isInteger(x.开始)&&Number.isInteger(x.结束)&&x.开始>=0&&x.结束>x.开始&&x.结束<=文本长度&&['重点','疑问'].includes(x.类型)).slice(-100);
 const 遍历=document.createTreeWalker(容器,NodeFilter.SHOW_TEXT);let 节点,位置=0;const 文本=[];
 while(节点=遍历.nextNode()){文本.push({节点,开始:位置,结束:位置+节点.length});位置+=节点.length;}
 for(const x of 文本){
  const 命中=范围.filter(r=>r.开始<x.结束&&r.结束>x.开始);if(!命中.length)continue;
  const 切点=[...new Set([x.开始,x.结束,...命中.flatMap(r=>[Math.max(r.开始,x.开始),Math.min(r.结束,x.结束)])])].sort((a,b)=>a-b),frag=document.createDocumentFragment();
  for(let i=0;i<切点.length-1;i++){
   const 文=x.节点.textContent.slice(切点[i]-x.开始,切点[i+1]-x.开始),记=命中.findLast(r=>r.开始<=切点[i]&&r.结束>=切点[i+1]);
   if(记){const mark=document.createElement('mark');mark.className=`标记 ${记.类型}`;mark.textContent=文;frag.append(mark);}else frag.append(document.createTextNode(文));
  }x.节点.replaceWith(frag);
 }
}
