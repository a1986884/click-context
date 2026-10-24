// Deterministic, entirely local candidate ranking. No model, network or generated definitions.
const stop=new Set('a an the and or but if of to for with without in on at by from into as is are was were be been being have has had do does did can could may might must shall should will would you your he his she her they their we our it its this that these those someone something person people thing things word also such very not than when where which who what how then there here'.split(' '));
const concepts=[
 ['money','bank','financial','finance','loan','credit','deposit','salary','cash','payment','account','withdraw','saving'],
 ['river','stream','water','shore','fishing','fish','lake','flood','boat','coast','edge'],
 ['company','business','manage','management','organization','organize','enterprise','director','staff'],
 ['run','jog','race','marathon','athlete','exercise','sport','track','runner'],
 ['light','bright','brightness','lamp','dark','shine','sunlight','illuminate'],
 ['weight','heavy','weigh','kilogram','carry','load'],
 ['plant','flower','leaf','tree','grow','garden','root','seed'],
 ['factory','manufacture','production','industrial','machinery','facility'],
 ['music','song','album','singer','vinyl','concert','listen','audio'],
 ['record','document','write','information','meeting','note','store','data']
];
function stem(value){
 const word=value.toLowerCase().replaceAll('’',"'").replace(/'s$/,'');
 const irregular={ran:'run',running:'run',sat:'sit',leaves:'leaf',wrote:'write',written:'write',took:'take',taken:'take',went:'go'};
 if(irregular[word])return irregular[word];
 if(word.length>5&&word.endsWith('ies'))return word.slice(0,-3)+'y';
 if(word.length>6&&word.endsWith('ing'))return word.slice(0,-3).replace(/([b-df-hj-np-tv-z])\1$/,'$1');
 if(word.length>5&&word.endsWith('ed'))return word.slice(0,-2);
 if(word.length>4&&word.endsWith('s')&&!word.endsWith('ss'))return word.slice(0,-1);
 return word;
}
const groups=concepts.map(words=>new Set(words.map(stem)));
const words=text=>[...String(text||'').toLowerCase().matchAll(/[a-z]+(?:['’-][a-z]+)*/g)].map(m=>({word:m[0],at:m.index}));
const terms=(text,excluded)=>new Set(words(text).map(t=>stem(t.word)).filter(t=>!stop.has(t)&&!excluded.has(t)&&t.length>1));
function guessedPOS(tokens,index){
 const before=tokens[index-1]?.word,after=tokens[index+1]?.word;
 if(['to','will','would','can','could','should','must','may','might'].includes(before))return 'V';
 if(['a','an','the','my','your','his','her','our','their','this','that'].includes(before))return 'N';
 if(['he','she','they','we','i','you'].includes(before)&&['the','a','an','my','your'].includes(after))return 'V';
 return '';
}
function posOf(label){if(/^ADV/.test(label))return 'ADV';if(/^ADJ/.test(label))return 'ADJ';if(/^V/.test(label)||/PHRASAL VERB/.test(label))return 'V';if(/^N/.test(label))return 'N';return '';}
export function rankCollinsSenses(senses,{word='',sentence='',offset=null}={}){
 const candidates=(senses||[]).slice(0,64),excluded=new Set(words(word).map(t=>stem(t.word))),context=terms(sentence,excluded);
 const tokens=words(sentence),needle=words(word)[0]?.word;
 let index=tokens.findIndex(t=>offset!==null&&offset>=t.at&&offset<t.at+t.word.length);
 if(index<0)index=tokens.findIndex(t=>t.word===needle);
 const pos=index<0?'':guessedPOS(tokens,index),near=terms(tokens.slice(Math.max(0,index-6),index+7).map(t=>t.word).join(' '),excluded);
 const sets=candidates.map(s=>terms([s.definition,...(s.examples||[]).map(e=>e.en)].join(' '),excluded));
 const frequencies=new Map();for(const set of sets)for(const term of set)frequencies.set(term,(frequencies.get(term)||0)+1);
 const contextGroups=groups.map((group,i)=>({i,matches:[...context].filter(t=>group.has(t))})).filter(g=>g.matches.length);
 const scored=candidates.map((sense,i)=>{
  const overlap=[...context].filter(t=>sets[i].has(t));
  let score=overlap.reduce((n,t)=>n+Math.log(1+candidates.length/(frequencies.get(t)||1))*(near.has(t)?1.4:1),0);
  const matchedGroups=contextGroups.filter(g=>[...sets[i]].some(t=>groups[g.i].has(t)));
  score+=matchedGroups.reduce((n,g)=>n+Math.min(2.4,1.2+g.matches.length*.4),0);
  if(pos)score+=posOf(sense.pos)===pos ? 0.7 : posOf(sense.pos) ? -0.7 : 0;
  return {sense,index:i,score,overlap,matchedGroups};
 });
 scored.sort((a,b)=>b.score-a.score||a.index-b.index);
 const first=scored[0],second=scored[1],margin=first?first.score-(second?.score||0):0;
 const supported=!!first&&context.size>0&&first.score>=2.3&&margin>=1.4&&(first.overlap.length>0||first.matchedGroups.length>0);
 // Weak evidence must not silently replace dictionary order with a guessed answer.
 const ordered=supported?scored.map(s=>s.sense):candidates;
 return {ordered,status:candidates.length<2?'single':supported?'supported':'uncertain',evidence:supported?[...(pos?['词性线索']:[]),...(first.overlap.length?['上下文与释义/例句重合']:[]),...(first.matchedGroups.length?['相关语义词线索']:[])]:[],method:'local-rules-v1'};
}
