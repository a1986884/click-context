import {resolveForm} from './morphology.js';
// Conservative, contiguous expressions only. Free selections need no list membership.
const VERB_FORMS={
 take:['takes','took','taken','taking'],carry:['carries','carried','carrying'],give:['gives','gave','given','giving'],look:['looks','looked','looking'],put:['puts','putting'],come:['comes','came','coming'],rule:['rules','ruled','ruling'],set:['sets','setting'],point:['points','pointed','pointing'],
 make:['makes','made','making'],bring:['brings','brought','bringing'],break:['breaks','broke','broken','breaking'],find:['finds','found','finding'],turn:['turns','turned','turning'],deal:['deals','dealt','dealing'],keep:['keeps','kept','keeping'],lead:['leads','led','leading'],result:['results','resulted','resulting'],depend:['depends','depended','depending'],refer:['refers','referred','referring'],account:['accounts','accounted','accounting'],rely:['relies','relied','relying'],consist:['consists','consisted','consisting'],focus:['focuses','focused','focussed','focusing','focussing'],contribute:['contributes','contributed','contributing'],draw:['draws','drew','drawn','drawing'],build:['builds','built','building'],stand:['stands','stood','standing'],hold:['holds','held','holding'],follow:['follows','followed','following']
};
const INFLECTED=Object.fromEntries(Object.entries(VERB_FORMS).flatMap(([lemma,forms])=>forms.map(form=>[form,lemma])));
const EXPRESSIONS=[
 'take into account','take account of','in contrast to','as opposed to','on the other hand','in terms of','with respect to','in accordance with','as a result','due to','rather than','carry out','give rise to','look forward to','put up with','come up with','rule out','set up','point out','statistically significant',
 'take place','take part in','take advantage of','make use of','make sense of','bring about','break down','find out','turn out','deal with','keep track of','lead to','result in','result from','depend on','refer to','account for','rely on','consist of','focus on','contribute to','draw on','build on','stand for','hold on to','follow up on',
 'in addition to','in spite of','on behalf of','in relation to','with regard to','by means of','in the absence of','in the presence of','for the sake of','at the expense of','in response to','in particular','in general','for instance','for example','as well as','at least','at most','in other words','in fact','so far','to some extent','on average','in turn'
];
const KNOWN=new Set(EXPRESSIONS);
const plain=word=>String(word).toLowerCase().replaceAll('’',"'").replace(/\s+/g,' ').trim();
// Change only the first verb of an explicitly reviewed whole expression.
// Never infer a new phrase by stripping a suffix from an arbitrary selection.
export function phraseLemma(value){
 const word=plain(value);if(KNOWN.has(word))return word;
 const [first,...rest]=word.split(' ');if(!rest.length||!INFLECTED[first])return word;
 const candidate=[INFLECTED[first],...rest].join(' ');return KNOWN.has(candidate)?candidate:word;
}
export function phraseAt(sentence,offset,word){
 if(!Number.isInteger(offset)||!word||word.includes(' '))return null;
 const tokens=[...sentence.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)];
 const clicked=tokens.findIndex(t=>offset>=t.index&&offset<=t.index+t[0].length&&t[0].toLowerCase()===word.toLowerCase());
 if(clicked<0)return null;
 const matches=[];
 for(const expression of EXPRESSIONS){const parts=expression.split(' ');
  for(let start=Math.max(0,clicked-parts.length+1);start<=clicked&&start+parts.length<=tokens.length;start++){
   if(clicked>=start+parts.length)continue;
   const group=tokens.slice(start,start+parts.length);
   if(!group.every((t,i)=>(t[0].toLowerCase()===parts[i]||i===0&&(INFLECTED[t[0].toLowerCase()]||resolveForm(t[0].toLowerCase()).lemma)===parts[i])&&(!i||/^\s+$/.test(sentence.slice(group[i-1].index+group[i-1][0].length,t.index)))))continue;
   const at=group[0].index,end=group.at(-1).index+group.at(-1)[0].length;
   matches.push({word:sentence.slice(at,end),offset:at});
  }
 }
 return matches.sort((a,b)=>b.word.length-a.word.length)[0]||null;
}

// One reviewed dictionary entry per expression, never a guessed search crawl.
const PHRASE_ENTRIES={
 'take into account':'account','take account of':'account','in terms of':'term','take place':'place','take advantage of':'advantage',
 'give rise to':'rise','make use of':'use','make sense of':'sense','in contrast to':'contrast','in accordance with':'accordance',
 'in spite of':'spite','on behalf of':'behalf','with respect to':'respect','with regard to':'regard','by means of':'means',
 'in the absence of':'absence','in the presence of':'presence','for the sake of':'sake','at the expense of':'expense','to some extent':'extent'
};
export function phraseEntry(word){return PHRASE_ENTRIES[phraseLemma(word)]||null;}
// Match only the definition of a PHRASE sense (the caller enforces its label).
// Punctuation, examples, arbitrary intervening words and synonyms are not evidence.
export function matchesPhraseDefinition(definition,phrase){
 const query=phraseLemma(phrase),parts=query.split(' ');if(!KNOWN.has(query))return false;
 const tokens=[...definition.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)];
 for(let start=0;start<tokens.length;start++){
  for(const length of [parts.length,...(query==='take into account'?[parts.length+1]:[])]){
   const group=tokens.slice(start,start+length);if(group.length!==length||!group.every((t,i)=>!i||/^\s+$/.test(definition.slice(group[i-1].index+group[i-1][0].length,t.index))))continue;
   const words=group.map(t=>t[0].toLowerCase());
   if(length===parts.length&&phraseLemma(words.join(' '))===query)return true;
   if(query==='take into account'&&length===4&&/^(something|someone|somebody)$/.test(words[1])&&phraseLemma([words[0],...words.slice(2)].join(' '))===query)return true;
  }
 }
 return false;
}
