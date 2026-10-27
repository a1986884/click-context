import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {writeFile,mkdir} from 'node:fs/promises';import {heldoutAccuracyCases} from '../tests/live/context-accuracy-heldout.mjs';import {cleanContext,contextPrompt} from '../src/context-meaning.js';
const run=promisify(execFile),dir='test-results/semantic-heldout';await mkdir(dir,{recursive:true});const dictionaries=new Map(),cases=[];
for(const c of heldoutAccuracyCases){const lemma=c.word.toLowerCase();if(!dictionaries.has(lemma)){const {stdout}=await run('curl',['-sS','--max-time','30','--max-filesize','300000','https://v04-preview.lextide.pages.dev/api/dictionary?'+new URLSearchParams({word:lemma})],{maxBuffer:500000});const r=JSON.parse(stdout);dictionaries.set(lemma,r.ok?r.data.senses:[]);}
 const input=cleanContext({word:c.word,sentence:c.sentence,offset:c.sentence.indexOf(c.word),senses:dictionaries.get(lemma),contextRevision:'ai-context-v5'});cases.push({...c,input,prompt:contextPrompt(input)});console.log(c.id);
}
await writeFile(dir+'/cohort.json',JSON.stringify(cases));console.log('Prepared '+cases.length+' held-out cases');
