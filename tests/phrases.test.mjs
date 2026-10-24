import {test} from 'node:test';import assert from 'node:assert/strict';
import {phraseAt} from '../src/phrases.js';import {cleanContext} from '../src/context-meaning.js';
test('recognize the containing contiguous expression, including regular and irregular inflections',()=>{
 for(const sentence of ['We take into account costs.','We took into account costs.','We carried out the trial.']){const word=sentence.includes('account')?'account':'carried',at=sentence.indexOf(word);const result=phraseAt(sentence,at+2,word);assert.ok(result);assert.equal(sentence.slice(result.offset,result.offset+result.word.length),result.word);assert.ok(cleanContext({...result,sentence,senses:[]}));}
});
test('do not bridge punctuation, unrelated repetitions, or expand explicit phrase selections',()=>{
 const sentence='They take risks into account. That account is closed.';assert.equal(phraseAt(sentence,sentence.lastIndexOf('account'),'account'),null);
 assert.equal(phraseAt('They take, into account costs.',16,'account'),null);
 assert.equal(phraseAt('We take into account costs.',3,'take into account'),null);
 const repeated='We take into account costs and take into account time.';assert.equal(phraseAt(repeated,repeated.lastIndexOf('account'),'account').offset,repeated.lastIndexOf('take'));
});

test('normalize only reviewed whole phrase inflections and leave arbitrary selections intact',async()=>{
 const {phraseLemma}=await import('../src/phrases.js');
 for(const [surface,lemma] of [['took into account','take into account'],['carried out','carry out'],['gave rise to','give rise to'],['dealt with','deal with'],['referred to','refer to'],['focused on','focus on'],['focussed on','focus on'],['made use of','make use of']])assert.equal(phraseLemma(surface),lemma);
 for(const word of ['took a book','carried luggage','found objects','statistically significant','standing room','taking into careful account'])assert.equal(phraseLemma(word),word);
});
test('expanded expressions retain occurrence boundaries and reject discontinuous matches',()=>{
 for(const phrase of ['made use of','in the absence of','referred to','at the expense of']){const sentence='They '+phrase+' the evidence.',word=phrase.split(' ').at(-1);assert.equal(phraseAt(sentence,sentence.indexOf(word,5),word)?.word,phrase);}
 assert.equal(phraseAt('They carried the work out.',5,'carried'),null);
 assert.equal(phraseAt('They referred, to the evidence.',5,'referred'),null);
});
test('canonical phrase cache shares candidates but retains the caller surface and independent context',async()=>{
 const {cacheWordLookup}=await import('../src/dictionary-cache.js');let calls=0;
 const lookup=cacheWordLookup(async word=>{calls++;return {lemma:'carry out',word:'carry out',original:word,senses:[{id:'one',zh:'执行'}]};});
 await lookup('carried out',{online:true});const second=await lookup('carrying out',{online:true});assert.equal(calls,1);assert.equal(second.original,'carrying out');assert.match(second.morphology,/carrying out → carry out/);
 second.senses[0].zh='changed';assert.equal((await lookup('carry out',{online:true})).senses[0].zh,'执行');
});
test('preview client sends the canonical expression while retaining its original spelling',async()=>{
 const {lookupCollinsClient}=await import('../src/dictionary-client.js');const calls=[];
 const result=await lookupCollinsClient('took into account',{online:true,fetcher:async url=>{calls.push(url);return Response.json({ok:true,data:{word:'take into account',lemma:'take into account',kind:'collins',senses:[]}});}});
 assert.equal(new URL(calls[0],'https://preview.test').searchParams.get('word'),'take into account');assert.equal(result.original,'took into account');assert.match(result.morphology,/took into account → take into account/);
});
