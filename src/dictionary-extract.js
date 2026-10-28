// Read-only normalized document contract: querySelector/querySelectorAll/textContent/getAttribute.
import {matchesPhraseDefinition} from './phrases.js';
const officialClean=node=>node?.textContent.replace(/\s+/g,' ').trim()||'';
const excerpt=(text,limit)=>text.split(/\s+/).filter(Boolean).slice(0,limit).join(' ');
export function extractCollinsPage(document,language){
 const root=document.querySelector(language==='zh'?'.dictionary.biling':'.dictentry');
 if(!root)throw Object.assign(Error('官网未返回可识别的词条，请打开官网查看。'),{code:'COLLINS_UNAVAILABLE'});
 const head=officialClean(root.querySelector('.orth'));
 if(!head)throw Object.assign(Error('官网词条格式发生变化，请打开官网查看。'),{code:'COLLINS_UNAVAILABLE'});
 if(language==='zh'){
  const zh=officialClean(root.querySelector('.cit.type-translation .quote'));
  if(!/[\u3400-\u9fff]/.test(zh))throw Error('该词暂未读取到中文释义，请查看 Collins 官网。');
  return {head,zh:zh.slice(0,24),phonetic:officialClean(root.querySelector('.pron')),pos:officialClean(root.querySelector('.pos'))};
 }
 const definition=excerpt(officialClean(root.querySelector('.def')),20);
 if(!definition)throw Error('该词暂未读取到英文解释，请查看 Collins 官网。');
 const remaining=Math.max(0,20-definition.split(/\s+/).length);
 return {head,definition,example:remaining>5?excerpt(officialClean(root.querySelector('.cit.type-example .quote')),remaining):'',pos:officialClean(root.querySelector('.pos')),phonetic:officialClean(root.querySelector('.pron'))};
}

const translationAt=text=>{const at=text.search(/[\u3400-\u9fff]/);return at>0&&/[（(]/.test(text[at-1])?at-1:at;};
const clean=node=>node?.textContent.replace(/\s+/g,' ').trim()||'';
const short=(text,max)=>{const words=text.split(/\s+/).filter(Boolean);return words.slice(0,max).join(' ')+(words.length>max?'…':'');};
export function extractCollinsBilingual(document){
 // Never consume Youdao's general translations, machine translations or other dictionaries.
 const root=document.querySelector('#collinsResult');
 const heading=document.querySelector('#authTrans h3');
 if(!root||!clean(heading).includes('柯林斯英汉双解'))throw Object.assign(Error('公开词条中没有 Collins 英汉双解栏目，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 const head=clean(root.querySelector('h4 .title'));
 const sense=root.querySelector('.collinsMajorTrans p');
 const pos=clean(sense?.querySelector('.additional'));
 if(!head||!sense)throw Object.assign(Error('Collins 词条结构发生变化，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 const content=sense;
 const text=clean(content),chinese=translationAt(text);
 if(chinese<=0)throw Object.assign(Error('该 Collins 义项缺少中英文对照，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 const english=text.slice(0,chinese).trim(),zh=text.slice(chinese).trim();
 if(!/[a-z]/i.test(english))throw Object.assign(Error('该 Collins 义项缺少英文解释，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 return {head,pos,definition:short(english,20),zh:zh.slice(0,40)+(zh.length>40?'…':''),phonetic:clean(root.querySelector('h4 .phonetic'))};
}
export function extractCollinsSenses(document,{phrase=null}={}){
 const root=document.querySelector('#collinsResult');
 if(!root||!clean(document.querySelector('#authTrans h3')).includes('柯林斯英汉双解'))throw Object.assign(Error('公开词条中没有 Collins 英汉双解栏目，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 const heading=root.querySelector('h4'),head=clean(heading?.querySelector('.title')),senses=[],related=[],references=[];
 // Only forms explicitly listed beside this Collins headword may confirm a
 // nontrivial redirect. Never infer them from examples or neighboring entries.
 const forms=[...new Set([...heading?.querySelectorAll('.additional.pattern')||[]].flatMap(node=>clean(node).toLowerCase().replaceAll('’',"'").split(/[(),;]/).map(s=>s.trim()).filter(s=>s.length<=80&&/^[a-z]+(?:['-][a-z]+)*$/.test(s))))].slice(0,64);
 if(!head)throw Object.assign(Error('Collins 词条结构发生变化，请查看词条来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 for(const node of root.querySelectorAll('.collinsMajorTrans')){
  if(senses.length>=64)break;
  const p=node.querySelector('p');if(!p)continue;
  const pos=clean(p.querySelector('.additional')),grammar=[...p.querySelectorAll('.additional')].map(clean).slice(1,5).join(' ');
  const copy=p;
  const text=clean(copy),at=translationAt(text);if(at<=0)continue;
  const english=text.slice(0,at).trim(),zh=text.slice(at).trim();
  if(phrase&&(pos!=='PHRASE'||!matchesPhraseDefinition(english,phrase)))continue;
  const reference=(english.toLowerCase().startsWith(head.toLowerCase()+' is ')||english.toLowerCase().startsWith(head.toLowerCase()+' are '))&&/\b(?:past tense|past participle|present participle|plural|comparative|superlative|third person singular)\b/i.test(english)&&/\bof\b/i.test(english);
  if(reference){
   const targets=[...english.matchAll(/\bof\s+([a-z]+)\b/gi),...english.matchAll(/\(([a-z]+)\)/gi)].map(m=>m[1].toLowerCase());
   for(const target of targets)if(target!==head.toLowerCase()&&!references.includes(target)&&!['the','a','an','and'].includes(target))references.push(target);
  }

  if(!/[a-z]/i.test(english))continue;
  if(/^[a-z]+(?:['-][a-z]+)*$/i.test(english)&&english.toLowerCase()!==head.toLowerCase()){
   if(related.length<8)related.push({word:english,pos,zh:zh.slice(0,40)});continue;
  }
  const container=[...document.querySelectorAll('li')].findLast(li=>[...li.querySelectorAll('.collinsMajorTrans')].includes(node)),examples=[];
  if(container&&container.querySelectorAll('.collinsMajorTrans').length===1)for(const example of container.querySelectorAll('.examples')){
   const paragraphs=[...example.querySelectorAll('p')].map(clean);if(paragraphs.length<2)continue;
   if(/[a-z]/i.test(paragraphs[0])&&/[\u3400-\u9fff]/.test(paragraphs[1]))examples.push({en:short(paragraphs[0],20),zh:paragraphs[1].slice(0,70)});
   if(examples.length===1)break;
  }
  senses.push({id:'collins-'+(senses.length+1),pos,grammar,reference,definition:short(english,20),displayDefinition:english.startsWith(pos)&&pos?english.slice(pos.length).trim():english,zh:zh.slice(0,80)+(zh.length>80?'…':''),examples});
 }
 if(!senses.length)throw Object.assign(Error('该 Collins 栏目暂无可读取的英汉双解义项，请查看来源。'),{code:'COLLINS_ENTRY_UNAVAILABLE'});
 return {head,phonetic:clean(root.querySelector('h4 .phonetic')),senses,related,forms,references:references.slice(0,4)};
}

export function extractDictionary(document,kind,{phrase=null}={}){
 if(kind==='collins-zh')return extractCollinsPage(document,'zh');
 if(kind==='collins-en')return extractCollinsPage(document,'en');
 if(kind==='youdao-first')return extractCollinsBilingual(document);
 if(kind==='youdao-senses')return extractCollinsSenses(document,{phrase});
 throw Object.assign(Error('不支持的词条解析类型'),{code:'INVALID_PARSE_KIND'});
}
