import {selectVocabulary,vocabularyKey,BACKUP_FILE_LIMIT} from './vocabulary-data.js';
export function mountVocabulary({root,store}){
 root.insertAdjacentHTML('beforeend','<div class="vocab-tools"><label>搜索生词 <input id="vocab-search" type="search" placeholder="单词、释义或原句"></label><label>排序 <select id="vocab-sort"><option value="recent">最近收藏</option><option value="alpha">字母顺序</option></select></label></div><p id="vocab-count" role="status"></p><div id="vocab-list"></div><button id="vocab-more" hidden>显示更多</button><div class="row"><button id="export">导出 JSON</button><label class="file-label">导入 JSON <input id="import-words" type="file" accept=".json,application/json"></label><button id="vocab-undo" hidden>撤销删除</button></div><p id="vocab-status" role="status" aria-live="polite"></p>');
 const $=selector=>root.querySelector(selector);let words=[],limit=100,sequence=0,removed=null,undoPending=false;
 const status=text=>{$('#vocab-status').textContent=text;};
 function render(){
  const shown=selectVocabulary(words,$('#vocab-search').value,$('#vocab-sort').value),list=$('#vocab-list');list.replaceChildren();
  $('#vocab-count').textContent=shown.length===words.length?`${words.length} 个收藏`:`找到 ${shown.length} / ${words.length} 个收藏`;
  if(!shown.length)list.textContent=words.length?'没有匹配的生词，请换个关键词。':'还没有生词。点击英文单词后选择收藏。';
  for(const item of shown.slice(0,limit)){
   const row=document.createElement('article');row.className='word-row';const title=document.createElement('h2');title.textContent=item.lemma||item.word;
   const zh=document.createElement('p');zh.textContent=item.zh;const sentence=document.createElement('p');sentence.textContent=item.sentence||'未记录句子';
   const meta=document.createElement('small');meta.textContent=(item.source||'未知来源')+' · '+(item.savedAt?new Date(item.savedAt).toLocaleDateString():'历史收藏');
   const remove=document.createElement('button');remove.textContent='删除 '+(item.lemma||item.word);remove.onclick=async()=>{remove.disabled=true;try{await store.removeWord(vocabularyKey(item));removed=item;$('#vocab-undo').hidden=false;await refresh();status('已删除 '+(item.lemma||item.word)+'，可以撤销。');}catch(error){status(error.message);remove.disabled=false;}};
   row.append(title,zh,sentence,meta,remove);list.append(row);
  }
  $('#vocab-more').hidden=shown.length<=limit;
 }
 async function refresh(){const seq=++sequence;try{const next=await store.words();if(seq!==sequence)return;words=next;render();}catch(error){status('生词本读取失败：'+error.message);}}
 $('#vocab-search').oninput=()=>{limit=100;render();};$('#vocab-sort').onchange=()=>{limit=100;render();};$('#vocab-more').onclick=()=>{limit+=100;render();};
 async function exportWords(){try{const all=await store.words();const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,words:all},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='lextide-words.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已导出全部 '+all.length+' 个收藏。');}catch(error){status('导出失败：'+error.message);}}
 $('#export').onclick=exportWords;
 $('#import-words').onchange=async event=>{const input=event.target,file=input.files?.[0];if(!file)return;try{if(file.size>BACKUP_FILE_LIMIT)throw Error('文件不得超过 16 MB。');const result=await store.importWords(JSON.parse(await file.text()));await refresh();status(`导入完成：新增 ${result.added}，保留已有 ${result.duplicates}。`);}catch(error){status('导入失败：'+error.message);}finally{input.value='';}};
 $('#vocab-undo').onclick=async()=>{
  if(!removed||undoPending)return;const item=removed;undoPending=true;$('#vocab-undo').disabled=true;
  try{await store.importWords({version:2,words:[item]});if(removed===item){removed=null;$('#vocab-undo').hidden=true;}await refresh();status('已恢复 '+(item.lemma||item.word)+(removed?'；还可撤销 '+(removed.lemma||removed.word)+' 的删除。':'。'));}
  catch(error){status('恢复失败：'+error.message);}
  finally{undoPending=false;$('#vocab-undo').disabled=false;}
 };
 return {refresh,exportWords};
}
