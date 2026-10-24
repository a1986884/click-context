import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupCollinsBilingual,parseCollinsBilingual,parseCollinsSenses} from '../src/collins-bilingual.js';
const html='<div id="phrsListTab">wrong ordinary translation 错误</div><div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">unit</span><em class="phonetic">/test/</em></h4><div class="collinsMajorTrans"><span>1.</span><p><span class="additional">N-COUNT</span> A <b>unit</b> is a single thing. 单位 <span class="additional">[标签]</span></p></div><div class="collinsMajorTrans"><p>Second synthetic sense. 不混入</p></div><script>wrong()</script></div></div>';
test('bilingual parser uses only the explicitly labeled Collins section and pairs the same sense',()=>{
 assert.deepEqual(parseCollinsBilingual(html),{head:'unit',pos:'N-COUNT',phonetic:'/test/',definition:'A unit is a single thing.',zh:'单位'});
 assert.throws(()=>parseCollinsBilingual(html.replace('柯林斯英汉双解大词典','普通英汉词典')),e=>e.code==='COLLINS_ENTRY_UNAVAILABLE');
 assert.throws(()=>parseCollinsBilingual('<div id="phrsListTab">单位</div>'),e=>e.code==='COLLINS_ENTRY_UNAVAILABLE');
 assert.throws(()=>parseCollinsBilingual(html.replace('单位','translation')),e=>e.code==='COLLINS_ENTRY_UNAVAILABLE');
});
test('multiple Collins senses keep their own bilingual examples; derivatives and cross references are not ranked as senses',()=>{
 const page='<div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">bank</span></h4><ul>'+[
  '<li><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span>A synthetic place holding money. 金融义</p></div><div class="examples"><p>Invented money example.</p><p>金融例句。</p></div></li>',
  '<li><div class="collinsMajorTrans"><p><span class="additional">N-COUNT</span>A synthetic river edge. 河岸义</p></div><div class="examples"><p>Invented river example.</p><p>河岸例句。</p></div></li>',
  '<li><div class="collinsMajorTrans"><p><span class="additional">N</span>banking 派生词</p></div></li>',
  '<li><div class="collinsMajorTrans"><p>→ see also another entry</p></div></li>'
 ].join('')+'</ul></div></div>';
 const entry=parseCollinsSenses(page);assert.equal(entry.senses.length,2);assert.equal(entry.related[0].word,'banking');assert.match(entry.senses[0].examples[0].en,/money/);assert.match(entry.senses[1].examples[0].en,/river/);
});
test('phrases use only their exact public source path and source-confirmed listed/list redirects remain explicit',async()=>{
 const calls=[];const phrase=await lookupCollinsBilingual('take off',{online:true,fetcher:async url=>{calls.push(url);return new Response(html.replace('>unit<','>take off<'));}});assert.equal(phrase.word,'take off');assert.equal(calls[0],'https://dict.youdao.com/w/eng/take_off/');
 const redirected=await lookupCollinsBilingual('listed',{online:true,fetcher:async()=>new Response(html.replace('>unit<','>list<'))});assert.equal(redirected.lemma,'list');assert.match(redirected.morphology,/来源返回的规则词形/);
});
test('Collins bilingual lookup requires consent and performs one exact-word public page request',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return new Response(html);};
 await assert.rejects(lookupCollinsBilingual('unit',{fetcher}),e=>e.code==='ONLINE_REQUIRED');assert.equal(calls.length,0);
 const entry=await lookupCollinsBilingual('unit',{online:true,fetcher});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://dict.youdao.com/w/eng/unit/');
 assert.equal(calls[0].options.credentials,'omit');assert.equal(entry.zh,'单位');assert.equal(entry.kind,'collins');assert.match(entry.source,/有道公开词条/);assert.equal(entry.sourceUrls.length,3);
});
test('Collins bilingual rejects a substituted headword and never retries an access denial',async()=>{
 await assert.rejects(lookupCollinsBilingual('wrong',{online:true,fetcher:async()=>new Response(html)}),e=>e.code==='COLLINS_ENTRY_MISMATCH');
 let calls=0;await assert.rejects(lookupCollinsBilingual('unit',{online:true,fetcher:async()=>{calls++;return new Response('',{status:403});}}),e=>e.code==='COLLINS_ACCESS_DENIED'&&e.upstreamStatus===403);assert.equal(calls,1);
});

test('source-listed inflections confirm doubling, silent-e, ie and irregular forms without guessing another request',async()=>{
 for(const [surface,head,forms] of [['Hugging','hug','hugging, hugged, hugs'],['hugged','hug','hugging, hugged, hugs'],['making','make','makes, making, made'],['lying','lie','lies, lying, lay, lain'],['stopped','stop','stops, stopping, stopped'],['written','write','writes, writing, wrote, written']]){
  const page=html.replace('>unit<','>'+head+'<').replace('</h4>','<span class="additional pattern">( '+forms+' )</span></h4>');const requests=[];
  const entry=await lookupCollinsBilingual(surface,{online:true,fetcher:async url=>{requests.push(url);return new Response(page);}});
  assert.equal(entry.lemma,head);assert.equal(entry.original,surface);assert.match(entry.morphology,/Collins 词头变形表已确认/);assert.equal(requests.length,1);assert.equal(requests[0],'https://dict.youdao.com/w/eng/'+surface.toLowerCase()+'/');
 }
});
test('inflection confirmation never consumes examples, derived words or a different headword pattern',async()=>{
 const page=html.replace('>unit<','>hug<').replace('</h4>','<span class="additional pattern">( hugs )</span></h4>')+'<h4><span class="additional pattern">( hugging )</span></h4><p>hugging in an unrelated example</p>';
 await assert.rejects(lookupCollinsBilingual('hugging',{online:true,fetcher:async()=>new Response(page)}),e=>e.code==='COLLINS_ENTRY_MISMATCH');
 const parsed=parseCollinsSenses(html.replace('</h4>','<span class="additional pattern">( UNITS, units, not a form, &lt;script&gt; )</span></h4>'));assert.deepEqual(parsed.forms,['units']);
});

test('reviewed inflected phrases query one complete lemma and still require that source headword',async()=>{
 for(const [surface,lemma] of [['took into account','take into account'],['carried out','carry out'],['gave rise to','give rise to'],['made use of','make use of']]){
  const calls=[];const entry=await lookupCollinsBilingual(surface,{online:true,fetcher:async url=>{calls.push(url);return new Response(html.replace('>unit<','>'+lemma+'<'));}});
  assert.deepEqual(calls,['https://dict.youdao.com/w/eng/'+lemma.replaceAll(' ','_')+'/']);assert.equal(entry.original,surface);assert.equal(entry.lemma,lemma);assert.match(entry.morphology,/短语词形/);
 }
 let calls=0;await assert.rejects(lookupCollinsBilingual('carried out',{online:true,fetcher:async()=>{calls++;return new Response(html);}}),e=>e.code==='COLLINS_ENTRY_MISMATCH');assert.equal(calls,1);
 calls=0;await assert.rejects(lookupCollinsBilingual('took into account',{online:true,fetcher:async()=>{calls++;return new Response('',{status:403});}}),e=>e.code==='COLLINS_ACCESS_DENIED');assert.equal(calls,1);
});

const phrasePage=(head,defs)=>'<div id="authTrans"><h3>柯林斯英汉双解大词典</h3><div id="collinsResult"><h4><span class="title">'+head+'</span></h4>'+defs.map(([pos,en,zh])=>'<div class="collinsMajorTrans"><p><span class="additional">'+pos+'</span>'+en+' '+zh+'</p></div>').join('')+'</div></div>';
test('missing phrase gets exactly one reviewed entry and only its explicitly confirmed phrase senses',async()=>{
 const calls=[];const result=await lookupCollinsBilingual('took into account',{online:true,fetcher:async url=>{calls.push(url);return new Response(calls.length===1?'<p>No Collins section</p>':phrasePage('account',[
 ['N-COUNT','A fictional report of events.','叙述测试'],['PHRASE','If you take something into account, you include it in your reasoning.','考虑测试'],['PHRASE','To take account of something means to consider it.','相邻短语'],['PHRASE','This account is a fictional explanation.','无关短语']
 ]));}});
 assert.deepEqual(calls,['https://dict.youdao.com/w/eng/take_into_account/','https://dict.youdao.com/w/eng/account/']);assert.equal(result.kind,'collins');assert.equal(result.senses.length,1);assert.equal(result.senses[0].zh,'考虑测试');assert.equal(result.senses[0].lemma,'take into account');assert.equal(result.senses[0].sourceHead,'account');assert.equal(result.phraseSource.head,'account');assert.equal(result.original,'took into account');assert.match(result.sourceUrls[0],/\/account\//);
});
test('embedded phrase recognition requires its PHRASE label, not examples, synonyms or punctuation bridges',async()=>{
 const page=phrasePage('place',[
 ['N-COUNT','This place is where the fictional event takes place.','普通名词'],['PHRASE','A fictional event occurs here.','无明确搭配'],['PHRASE','Take second place to an alternative.','不同短语'],['PHRASE','The take, place example is malformed.','跨标点']
 ])+'<p class="examples">An event takes place.</p>';
 let calls=0;const result=await lookupCollinsBilingual('take place',{online:true,fetcher:async()=>new Response(++calls===1?'<p>missing</p>':page)});assert.equal(result.kind,'unavailable');assert.equal(calls,2);
 const good=await lookupCollinsBilingual('take place',{online:true,fetcher:async url=>new Response(url.includes('/take_place/')?'<p>missing</p>':phrasePage('place',[['PHRASE','When an event takes place, it happens.','发生测试']]))});assert.equal(good.senses.length,1);assert.equal(good.lemma,'take place');
});
test('phrase fallback never expands after access denial, wrong source head, cancellation or an unreviewed phrase',async()=>{
 for(const [word,status,expectedCalls]of [['take into account',403,1],['unknown phrase',200,1]]){let calls=0;await lookupCollinsBilingual(word,{online:true,fetcher:async()=>{calls++;return new Response('<p>missing</p>',{status});}}).catch(()=>{});assert.equal(calls,expectedCalls);}
 let calls=0;await assert.rejects(lookupCollinsBilingual('take into account',{online:true,fetcher:async()=>new Response(++calls===1?'<p>missing</p>':phrasePage('wrong',[['PHRASE','You take something into account in your reasoning.','错误来源']]))}),e=>e.code==='COLLINS_ENTRY_MISMATCH');assert.equal(calls,2);
 const controller=new AbortController();calls=0;await assert.rejects(lookupCollinsBilingual('take place',{online:true,signal:controller.signal,fetcher:async()=>{calls++;controller.abort();return new Response('<p>missing</p>');}}));assert.equal(calls,1);
});
test('Chinese parenthetical usage labels retain their opening punctuation',()=>{
 const entry=parseCollinsSenses(phrasePage('place',[['PHRASE','When an event takes place, it happens.','(限定场景) 发生']]));assert.equal(entry.senses[0].zh,'(限定场景) 发生');assert.ok(!entry.senses[0].definition.endsWith('('));
});

test('example scope retains the nearest li even when it wraps the dictionary root',()=>{
 const page='<li>'+phrasePage('unit',[['N','A synthetic unit.','单位']])+'<div class="examples"><p>A synthetic sentence.</p><p>一个测试句子。</p></div></li>';
 assert.equal(parseCollinsSenses(page).senses[0].examples.length,1);
});
