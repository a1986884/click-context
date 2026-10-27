import {test} from 'node:test';import assert from 'node:assert/strict';
import {contextReviewPrompt,contextReviewOutputLimit,parseContextReview,CONTEXT_STAGE_OUTPUT_LIMIT} from '../src/context-review.js';
const input={word:'port',sentence:'The port is closed.',offset:4,contextRevision:'ai-context-v5',senses:[{id:'one',lemma:'port',pos:'NOUN',zh:'端口',definition:'A computer connection.'}]},meaning={lemma:'port',pos:'NOUN',senseId:null,zh:'电脑端口'};
test('semantic review is separate, bounded and never receives candidate dictionary anchors',()=>{const p=contextReviewPrompt(input,meaning);assert.equal(p.max_output_tokens,450);assert.equal(CONTEXT_STAGE_OUTPUT_LIMIT*2,900);assert.equal(p.temperature,0);const data=JSON.parse(p.input);assert.equal(data.proposedGloss,'电脑端口');assert.equal(data.senses,undefined);assert.ok(!p.input.includes('A computer connection.'));});
test('a correction stays explicitly independent even if its broader gloss matches a narrow dictionary alias',()=>{const r=parseContextReview({supported:false,sameTarget:true,zh:'端口',cue:null},input,meaning);assert.equal(r.zh,'端口');assert.equal(r.senseId,null);assert.equal(r.dictionaryMatchAllowed,false);});
test('a supported answer cannot be silently replaced by unrelated reviewer prose',()=>{const r=parseContextReview({supported:true,sameTarget:true,zh:'无关改写',cue:'closed'},input,meaning);assert.equal(r.zh,meaning.zh);});
test('malformed review, incomplete output and invented evidence never become final interpretations',()=>{for(const raw of [{supported:false,sameTarget:true,zh:'端口',cue:'invented cue'},{supported:'yes',zh:'端口',cue:null},{status:'incomplete',output:[]},{response:'not JSON'}])assert.throws(()=>parseContextReview(raw,input,meaning));});
test('semantic corrections can also repair an inflected lemma and preserve their no-match marker across parsing',async()=>{
 const {parseContextResult}=await import('../src/context-meaning.js');const data={...input,word:'saw',sentence:'She saw the tool.',offset:4,senses:[{id:'see',lemma:'see',pos:'VERB',zh:'看见',definition:'To see.'}]};const r=parseContextReview({supported:false,sameTarget:true,lemma:'see',pos:'VERB',zh:'看见',cue:'saw' },data,{lemma:'saw',pos:'NOUN',senseId:null,zh:'锯子'});assert.equal(r.lemma,'see');assert.equal(r.pos,'VERB');assert.equal(r.zh,'看见');assert.equal(r.senseId,null);assert.equal(parseContextResult(r,data).senseId,null);
});

test('unused generation tokens can fund semantic review without raising the combined 900-token cap',()=>{for(const used of [1,64,120,300,450]){const limit=contextReviewOutputLimit({usage:{output_tokens:used}});assert.equal(used+limit,900);assert.equal(contextReviewPrompt(input,meaning,{outputLimit:limit}).max_output_tokens,limit);}for(const used of [0,-1,451,NaN,undefined,'100'])assert.equal(contextReviewOutputLimit({usage:{output_tokens:used}}),450);});
test('review receives the same visually marked occurrence, including repeated spellings',()=>{
 const sentence='She saw the saw on the bench.';
 for(const offset of [4,12]){const data={...input,word:'saw',sentence,offset},p=JSON.parse(contextReviewPrompt(data,{lemma:offset===4?'see':'saw',pos:offset===4?'VERB':'NOUN',zh:offset===4?'看见':'锯子'}).input);assert.equal(p.offset,offset);assert.equal(p.markedSentence,sentence.slice(0,offset)+'⟦saw⟧'+sentence.slice(offset+3));assert.equal((p.markedSentence.match(/⟦/g)||[]).length,1);}
});
test('an explicitly out-of-scope review cannot replace the original word with its head noun or another occurrence',()=>{
 const data={...input,word:'bass',sentence:'The bass player cooked dinner.',offset:4,senses:[]},first={lemma:'bass',pos:'NOUN',senseId:null,zh:'低音乐器'};
 const r=parseContextReview({supported:false,sameTarget:false,lemma:'bass',pos:'NOUN',zh:'贝斯手',cue:'player'},data,first);assert.equal(r.zh,first.zh);assert.equal(r.lemma,first.lemma);assert.equal(r.reviewStatus,'scope-unconfirmed');assert.equal(r.dictionaryMatchAllowed,false);
});
test('a review missing target confirmation cannot silently replace a word interpretation',()=>{
 const r=parseContextReview({supported:false,zh:'无关改写',cue:null},input,meaning);assert.equal(r.zh,meaning.zh);assert.equal(r.reviewStatus,'scope-unconfirmed');assert.equal(r.dictionaryMatchAllowed,false);
});
test('a correction without a cited original cue stays explicitly unconfirmed across parsing',async()=>{
 const {parseContextResult}=await import('../src/context-meaning.js');
 const r=parseContextReview({supported:false,sameTarget:true,zh:'港口或端口',cue:null},input,meaning);
 assert.equal(r.reviewStatus,'evidence-unconfirmed');assert.equal(r.senseId,null);assert.equal(r.dictionaryMatchAllowed,false);
 const again=parseContextResult(r,input);assert.equal(again.reviewStatus,'evidence-unconfirmed');assert.equal(again.senseId,null);
});
test('out-of-scope corrections take precedence over missing evidence warnings',()=>{
 const r=parseContextReview({supported:false,sameTarget:false,zh:'无关的人或物',cue:null},input,meaning);
 assert.equal(r.zh,meaning.zh);assert.equal(r.reviewStatus,'scope-unconfirmed');assert.equal(r.senseId,null);
});
