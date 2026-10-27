import {createDraftAutosave} from './draft-autosave.js';
import {selectVocabulary,vocabularyKey,vocabularyReviewState,vocabularyOccurrence,BACKUP_FILE_LIMIT,vocabularyDraftKey} from './vocabulary-data.js';
export function mountVocabulary({root,store,onLookup}){
 root.insertAdjacentHTML('beforeend','<div class="vocab-tools"><label>搜索生词 <input id="vocab-search" type="search" placeholder="单词、释义或原句"></label><label>排序 <select id="vocab-sort"><option value="recent">最近收藏</option><option value="alpha">字母顺序</option></select></label><label>核对状态 <select id="vocab-review" aria-label="核对状态"><option value="all">全部收藏</option><option value="pending">待核对</option></select></label></div><p id="vocab-count" role="status"></p><button id="vocab-clear-filter" hidden>显示全部收藏</button><div id="vocab-list"></div><button id="vocab-more" hidden>显示更多</button><div class="row"><button id="export">导出 JSON</button><label class="file-label">导入 JSON <input id="import-words" type="file" accept=".json,application/json"></label><button id="vocab-undo" hidden>撤销删除</button></div><p id="vocab-status" role="status" aria-live="polite"></p>');
 const $=selector=>root.querySelector(selector);let words=[],limit=100,sequence=0,removed=[],undoPending=false,editorSequence=0,drafts=[],disposed=false,leaveGuard=false;
 const viewWindow=root.ownerDocument.defaultView;
 const beforeLeave=event=>{event.preventDefault();event.returnValue=true;};
 function protectLeaving(value){value=Boolean(value)&&!disposed;if(value===leaveGuard)return;leaveGuard=value;viewWindow?.[value?'addEventListener':'removeEventListener']('beforeunload',beforeLeave);}
 const notice=document.createElement('div');notice.id='vocab-filter-notice';notice.hidden=true;const noticeText=document.createElement('p');noticeText.setAttribute('role','status');noticeText.textContent='筛选已暂存。保存或取消当前修改后，会应用新筛选。';const returnToEditor=document.createElement('button');returnToEditor.textContent='继续编辑';returnToEditor.onclick=()=>root.querySelector('.vocab-editor textarea')?.focus();notice.append(noticeText,returnToEditor);$('#vocab-count').before(notice);$('#vocab-count').tabIndex=-1;
 const newDraftId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const status=text=>{$('#vocab-status').textContent=text;};
 const undoBar=document.createElement('div');undoBar.id='vocab-undo-bar';undoBar.hidden=true;const undoMessage=document.createElement('p');undoMessage.id='vocab-undo-message';undoMessage.setAttribute('role','status');undoMessage.setAttribute('aria-live','polite');undoBar.append(undoMessage,$('#vocab-undo'));root.append(undoBar);
 function syncUndo(message){const next=removed.at(-1);undoBar.hidden=!next;$('#vocab-undo').hidden=!next;$('#vocab-undo').disabled=undoPending;$('#vocab-undo').textContent=undoPending?'正在恢复…':'撤销删除'+(removed.length>1?'（'+removed.length+' 条）':'');undoMessage.textContent=message||(next?'已删除 '+(next.lemma||next.word)+'。可逐条撤销；刷新页面后不再保留撤销记录。':'');}
 const recovery=document.createElement('div');recovery.id='vocab-draft-recovery';recovery.hidden=true;$('#vocab-count').before(recovery);
 function renderDrafts(){
  recovery.replaceChildren();recovery.hidden=!drafts.length||!!root.querySelector('.vocab-editor');
  for(const draft of drafts){
   const box=document.createElement('section'),message=document.createElement('p');box.dataset.key=draft.key;
   const item=words.find(w=>vocabularyKey(w)===draft.key),compatible=item&&JSON.stringify(item)===JSON.stringify(draft.entry);
   message.textContent=(draft.entry?.lemma||draft.entry?.word||'生词')+'：发现未保存的草稿。'+(compatible?'可继续编辑；不会自动覆盖收藏。':'原收藏已变化或删除。请复制草稿重新核对，不会覆盖或恢复旧词条。');
   const meta=document.createElement('p'),siblings=drafts.filter(d=>d.key===draft.key);meta.className='vocab-draft-meta';meta.textContent=(siblings.length>1?'同一用法有 '+siblings.length+' 份草稿，请逐份核对。 ':'')+(draft.at&&!Number.isNaN(Date.parse(draft.at))?'暂存于 '+new Date(draft.at).toLocaleString():'');
   const text=document.createElement('textarea');text.readOnly=true;text.value=draft.text;text.setAttribute('aria-label','未保存的释义草稿');
   const restore=document.createElement('button');restore.textContent='恢复编辑';restore.hidden=!compatible;restore.onclick=()=>{
    $('#vocab-search').value='';for(const o of $('#vocab-review').options)o.selected=o.value==='all';limit=words.length;render();
    const row=[...root.querySelectorAll('.word-row')].find(r=>r.dataset.key===draft.key);row?.querySelector('.vocab-edit')?.onclick(draft);
   };
   const discard=document.createElement('button');discard.textContent='放弃这条草稿';discard.onclick=async()=>{discard.disabled=true;try{await store.removeVocabularyDraft(vocabularyDraftKey(draft),draft);await refresh();status('已放弃这条草稿，原收藏未修改。');}catch(error){if(error.code==='DRAFT_CONFLICT'){await refresh();status('草稿已在其他窗口变化，请核对最新内容后再操作。');}else{status('草稿未删除：'+error.message);discard.disabled=false;}}};
   const context=document.createElement('p');context.textContent=draft.entry.sentence||'未记录原句';box.append(message,meta,context,text,restore,discard);recovery.append(box);
  }
 }
 function render(){
  notice.hidden=true;
  const shown=selectVocabulary(words,$('#vocab-search').value,$('#vocab-sort').value,$('#vocab-review').value),list=$('#vocab-list');list.replaceChildren();
  $('#vocab-count').textContent=shown.length===words.length?`${words.length} 个收藏`:`找到 ${shown.length} / ${words.length} 个收藏`;
  if(!shown.length)list.textContent=words.length?($('#vocab-review').value==='pending'?'没有符合条件的待核对词条。':'没有匹配的生词，请换个关键词。'):'还没有生词。点击英文单词后选择收藏。';
  for(const item of shown.slice(0,limit)){
   const row=document.createElement('article');row.className='word-row';row.dataset.key=vocabularyKey(item);const title=document.createElement('h2');title.textContent=item.lemma||item.word;
   const zh=document.createElement('p');zh.textContent=item.zh;const sentence=document.createElement('p');sentence.textContent=item.sentence||'未记录句子';
   const meta=document.createElement('small');meta.textContent=(item.source||'未知来源')+' · '+(item.savedAt?new Date(item.savedAt).toLocaleDateString():'历史收藏');
   const remove=document.createElement('button');remove.textContent='删除 '+(item.lemma||item.word);remove.onclick=async()=>{remove.disabled=true;try{await store.removeWord(vocabularyKey(item));removed.push(item);syncUndo();await refresh();status('已删除 '+(item.lemma||item.word)+'，可以撤销。');if(!root.querySelector('.vocab-editor'))$('#vocab-undo').focus({preventScroll:true});}catch(error){status(error.message);remove.disabled=false;}};
   row.append(title,zh);
   const reviewState=vocabularyReviewState(item);
   if(reviewState||item.editedAt){const note=document.createElement('p');note.className='vocab-review-state';note.dataset.state=reviewState||'edited';note.textContent=(reviewState==='pending'?'待核对':reviewState==='reviewed'?'已人工核对':'')+(item.editedAt?' · 释义已手动修改':'');row.append(note);}
   // Keep the uncertainty/provenance visible during review as well as lookup.
   // Imported backups are untrusted text and must never become markup.
   if(typeof item.dictionarySource==='string'&&item.dictionarySource.trim()){
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='vocab-source-details';summary.textContent='查看释义来源';const provenance=document.createElement('p');provenance.className='vocab-provenance';provenance.textContent=(item.editedAt||reviewState==='reviewed'?'最初收藏时的来源：':'')+item.dictionarySource;details.append(summary,provenance);row.append(details);
   }
   row.append(sentence,meta,remove);
   if(typeof store.updateWord==='function'){
    const edit=document.createElement('button');edit.textContent='修改释义 '+(item.lemma||item.word);edit.className='vocab-edit';
    edit.onclick=(restored)=>{
     const explicit=!!restored?.key,matches=drafts.filter(d=>d.key===vocabularyKey(item));if(!explicit&&matches.length>1){status('这条用法有多份草稿，请先在上方选择要恢复的一份。');[...recovery.querySelectorAll('section')].find(s=>s.dataset.key===vocabularyKey(item))?.querySelector('button')?.focus();return;}restored=explicit?restored:matches[0];if(restored&&JSON.stringify(restored.entry)!==JSON.stringify(item)){status('原收藏已变化，请先在草稿恢复区复制并核对旧草稿。');return;}
     const activeEditor=root.querySelector('.vocab-editor');if(activeEditor){activeEditor.querySelector('textarea').focus();status('请先保存或取消当前这条修改。');return;}
     const previousButtons=[...row.querySelectorAll('button')];for(const button of previousButtons)button.disabled=true;
     const editor=document.createElement('div');editor.className='vocab-editor';const label=document.createElement('label');label.textContent='修改中文释义（最多 500 字符）';const input=document.createElement('textarea');input.maxLength=500;input.value=restored?.key===vocabularyKey(item)?restored.text:(item.zh||'');label.append(input);
     const help=document.createElement('p');help.textContent='修改后保留原句和最初来源，并列入待核对；核实后可标记已核对。';const save=document.createElement('button');save.textContent='保存修改';const cancel=document.createElement('button');cancel.textContent='取消修改';
     const feedback=document.createElement('p');feedback.className='vocab-edit-status';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.id='vocab-edit-status-'+(++editorSequence);input.setAttribute('aria-describedby',feedback.id);
     const draftRetry=document.createElement('button');draftRetry.textContent='重试暂存草稿';draftRetry.hidden=true;const draftStatus=document.createElement('p');draftStatus.className='vocab-draft-status';draftStatus.setAttribute('role','status');draftStatus.setAttribute('aria-live','polite');
     let expectedDraft=restored||null,draftId=restored?(restored.id||null):newDraftId(),forked=false,formallySaved=false,editorClosed=false;
     const autosave=createDraftAutosave({
      write:async text=>{if(typeof store.saveVocabularyDraft!=='function')throw Error('当前环境不支持自动暂存，请保存修改。');let saved;try{saved=await store.saveVocabularyDraft(item,text,expectedDraft,draftId);}catch(error){if(error.code!=='DRAFT_CONFLICT')throw error;const id=newDraftId();saved=await store.saveVocabularyDraft(item,text,null,id);draftId=id;forked=true;}expectedDraft=saved??null;return saved;},
      onPending:()=>{protectLeaving(true);draftRetry.hidden=true;draftStatus.dataset.state='pending';draftStatus.textContent='正在暂存草稿，请稍候…';},
      onSaved:(_saved,text)=>{protectLeaving(false);draftStatus.dataset.state='saved';draftStatus.textContent=text===(item.zh||'')?'未修改原释义，其他草稿仍保留。':forked?'检测到其他窗口修改；本窗口草稿已独立暂存，刷新后可恢复。':'草稿已暂存于此浏览器，刷新后可恢复。';},
      onError:error=>{protectLeaving(!formallySaved);draftStatus.dataset.state='error';draftStatus.textContent='草稿暂存失败，请勿关闭或刷新：'+error.message;draftRetry.hidden=false;}
     });
     const persistDraft=()=>{if(editorClosed||disposed||input.disabled)return;return autosave.schedule(input.value);};
     draftRetry.onclick=()=>{if(!draftRetry.disabled)persistDraft();};
     if(restored?.key===vocabularyKey(item))draftStatus.textContent='已恢复草稿，尚未保存到收藏。';
     const count=document.createElement('small');count.className='vocab-edit-count';const updateCount=()=>{count.textContent=input.value.length+' / 500';};updateCount();input.oninput=()=>{if(editorClosed||disposed||input.disabled)return;updateCount();persistDraft();if($('#vocab-status').textContent===feedback.textContent)status('');feedback.textContent='';input.removeAttribute('aria-invalid');};input.oncompositionend=input.oninput;
     save.onclick=async()=>{if(save.disabled)return;save.disabled=true;cancel.disabled=true;save.textContent='保存中…';input.disabled=true;draftRetry.disabled=true;try{const updated=await store.updateWord(vocabularyKey(item),{zh:input.value},item);formallySaved=true;protectLeaving(false);await autosave.flush();let cleanupError='';try{await store.removeVocabularyDraft?.(draftId||vocabularyKey(item),expectedDraft);drafts=drafts.filter(d=>vocabularyDraftKey(d)!==(draftId||vocabularyKey(item)));}catch(error){cleanupError=error.code==='DRAFT_CONFLICT'?'其他窗口的新草稿已保留，请重新核对。':'草稿清理失败：'+error.message;}editorClosed=true;editor.remove();await refresh();status('已保存释义修改。'+cleanupError);const next=[...root.querySelectorAll('.word-row')].find(r=>r.dataset.key===vocabularyKey(updated));(next?.querySelector('.vocab-edit')||$('#vocab-count')).focus();}catch(error){feedback.textContent=error.message;if(!input.value.trim()||input.value.length>500)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');status(error.message);save.disabled=false;cancel.disabled=false;save.textContent='保存修改';input.disabled=false;draftRetry.disabled=false;input.focus();}};
     cancel.onclick=async()=>{if(cancel.disabled)return;cancel.disabled=true;save.disabled=true;input.disabled=true;draftRetry.disabled=true;try{await autosave.flush();let kept=false;try{await store.removeVocabularyDraft?.(draftId||vocabularyKey(item),expectedDraft);}catch(error){if(error.code!=='DRAFT_CONFLICT')throw error;kept=true;}if(!kept)drafts=drafts.filter(d=>vocabularyDraftKey(d)!==(draftId||vocabularyKey(item)));protectLeaving(false);editorClosed=true;editor.remove();await refresh();status(kept?'已取消当前编辑，其他窗口的新草稿已保留。':'已取消本次修改。');const next=[...root.querySelectorAll('.word-row')].find(r=>r.dataset.key===vocabularyKey(item));(next?.querySelector('.vocab-edit')||$('#vocab-count')).focus();}catch(error){draftStatus.textContent='草稿未清除：'+error.message;cancel.disabled=false;save.disabled=false;input.disabled=false;draftRetry.disabled=false;}};
     input.onkeydown=async event=>{if(event.isComposing||event.keyCode===229){event.stopPropagation();return;}if(event.key==='Escape'&&!cancel.disabled){event.preventDefault();event.stopPropagation();await cancel.onclick();}else if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();await save.onclick();}};
     editor.append(label,count,help,draftStatus,draftRetry,feedback,save,cancel);row.append(editor);recovery.hidden=true;input.focus();
    };
    const review=document.createElement('button');review.textContent=reviewState==='reviewed'?'重新标记待核对':'标记已核对';review.className='vocab-review-action';
    review.onclick=async()=>{if(review.disabled)return;review.disabled=true;try{await store.updateWord(vocabularyKey(item),{reviewState:reviewState==='reviewed'?'pending':'reviewed'});await refresh();status(reviewState==='reviewed'?'已标记为待核对。':'已记录你对该条释义的人工核对。');}catch(error){status(error.message);review.disabled=false;}};
    row.append(edit,review);
   }
   if(onLookup&&item.sentence){
    const lookup=document.createElement('button');lookup.textContent='按原句重新查词 '+(item.lemma||item.word);lookup.className='vocab-relookup';lookup.onclick=async()=>{if(vocabularyOccurrence(item)===null){status('原记录未保存可确认的选词位置，请返回原句重新点选。');return;}lookup.disabled=true;try{await onLookup(item);}catch(error){status(error.message);}finally{lookup.disabled=false;}};row.append(lookup);
   }
   list.append(row);
  }
  renderDrafts();$('#vocab-more').hidden=shown.length<=limit;$('#vocab-clear-filter').hidden=!($('#vocab-search').value.trim()||$('#vocab-review').value==='pending');
 }
 async function refresh(){const seq=++sequence;try{const next=await store.words();if(seq!==sequence)return;words=next;try{drafts=await store.vocabularyDrafts?.()||[];}catch(error){status('草稿读取失败：'+error.message);}if(seq!==sequence)return;if(!root.querySelector('.vocab-editor'))render();}catch(error){status('生词本读取失败：'+error.message);}}
 function requestRender(){if(root.querySelector('.vocab-editor')){notice.hidden=false;return false;}render();return true;}
 $('#vocab-clear-filter').onclick=()=>{$('#vocab-search').value='';for(const option of $('#vocab-review').options)option.selected=option.value==='all';limit=100;if(requestRender())$('#vocab-count').focus();};
 $('#vocab-search').oninput=()=>{limit=100;requestRender();};$('#vocab-review').onchange=()=>{limit=100;requestRender();};$('#vocab-sort').onchange=()=>{limit=100;requestRender();};$('#vocab-more').onclick=()=>{limit+=100;requestRender();};
 async function exportWords(){try{const all=await store.words();const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,words:all},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='lextide-words.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已导出全部 '+all.length+' 个收藏。');}catch(error){status('导出失败：'+error.message);}}
 $('#export').onclick=exportWords;
 $('#import-words').onchange=async event=>{const input=event.target,file=input.files?.[0];if(!file)return;try{if(file.size>BACKUP_FILE_LIMIT)throw Error('文件不得超过 16 MB。');const result=await store.importWords(JSON.parse(await file.text()));await refresh();status(`导入完成：新增 ${result.added}，保留已有 ${result.duplicates}。`);}catch(error){status('导入失败：'+error.message);}finally{input.value='';}};
 $('#vocab-undo').onclick=async()=>{
  if(!removed.length||undoPending)return;const item=removed.at(-1);undoPending=true;syncUndo('正在恢复 '+(item.lemma||item.word)+'…');
  try{await store.importWords({version:2,words:[item]});const index=removed.indexOf(item);if(index>=0)removed.splice(index,1);await refresh();const shown=selectVocabulary(words,$('#vocab-search').value,$('#vocab-sort').value,$('#vocab-review').value),visible=shown.slice(0,limit).some(w=>vocabularyKey(w)===vocabularyKey(item));status('已恢复 '+(item.lemma||item.word)+(visible?'。':'。当前筛选或显示范围未显示它，可调整筛选或显示更多。'));if(!root.querySelector('.vocab-editor')){const row=[...root.querySelectorAll('.word-row')].find(r=>r.dataset.key===vocabularyKey(item));(removed.length?$('#vocab-undo'):row?.querySelector('.vocab-edit')||$('#vocab-count')).focus({preventScroll:true});}}
  catch(error){status('恢复失败：'+error.message);syncUndo('恢复失败：'+error.message+'；可以重试。');}
  finally{undoPending=false;syncUndo($('#vocab-status').textContent.startsWith('恢复失败：')?$('#vocab-status').textContent+'；可以重试。':undefined);if(removed.length&&!root.querySelector('.vocab-editor'))$('#vocab-undo').focus({preventScroll:true});}
 };
 return {refresh,exportWords,destroy(){disposed=true;protectLeaving(false);}};
}
