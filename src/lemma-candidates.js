import {resolveForm} from './morphology.js';
// Generate bounded hypotheses only. A hypothesis is never a dictionary fact:
// the returned Collins headword must explicitly confirm the queried surface.
export function lemmaCandidates(word,references=[]){
 if(!/^[a-z]+$/.test(word))return [];
 const out=[],add=w=>{if(w!==word&&/^[a-z]{2,80}$/.test(w)&&!out.includes(w))out.push(w);};
 references.forEach(add);const reviewed=resolveForm(word);if(reviewed.confirmed)add(reviewed.lemma);
 const unDouble=s=>/([b-df-hj-np-tv-z])\1$/.test(s)?s.slice(0,-1):null;
 if(/ing$/.test(word)){
  const stem=word.slice(0,-3),short=unDouble(stem);
  if(/ying$/.test(word)&&word.length<=5)add(word.slice(0,-4)+'ie');
  if(short){add(short);add(stem);}else{if(/(?:[^aeiou]|^)[aeiou][^aeiouwxy]$/.test(stem)&&!/[aeiou]{2}/.test(stem))add(stem+'e');add(stem);add(stem+'e');}
 }else if(/ied$/.test(word)){add(word.slice(0,-3)+'y');add(word.slice(0,-1));}
 else if(/ed$/.test(word)){const stem=word.slice(0,-2),short=unDouble(stem);if(short)add(short);add(word.slice(0,-1));add(stem);}
 else if(/ies$/.test(word)){add(word.slice(0,-3)+'y');add(word.slice(0,-1));}
 else if(/ves$/.test(word)){add(word.slice(0,-3)+'f');add(word.slice(0,-3)+'fe');add(word.slice(0,-1));}
 else if(/s$/.test(word)&&!/(?:ss|us|is)$/.test(word)){if(/(?:[sxz]|ch|sh|o)es$/.test(word))add(word.slice(0,-2));add(word.slice(0,-1));}
 else if(/(?:ier|iest)$/.test(word)){add(word.replace(/(?:ier|iest)$/,'y'));}
 else if(/(?:er|est)$/.test(word)){const stem=word.replace(/(?:er|est)$/,'');const short=unDouble(stem);if(short)add(short);add(stem);add(stem+'e');}
 return out.slice(0,2);
}
