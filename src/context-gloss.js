// Compare complete dictionary text or complete top-level aliases only. A list
// inside a qualifier is not a collection of independent dictionary meanings.
const formatted=value=>value.normalize('NFKC').trim().replace(/\s*([()])\s*/gu,'$1').replace(/[。.!！]+$/u,'');
const pairs=new Map([['(',')'],['[',']'],['{','}'],['【','】'],['「','」'],['『','』'],['《','》'],['〈','〉'],['“','”'],['"','"']]);
const closers=new Set(pairs.values());
export function matchesDictionaryGloss(meaning,dictionary){
 if(typeof meaning!=='string'||typeof dictionary!=='string')return false;
 const target=formatted(meaning);if(!target)return false;
 if(target===formatted(dictionary))return true;
 const text=dictionary.normalize('NFKC'),stack=[],aliases=[];let start=0;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(stack.length&&char===stack.at(-1)){stack.pop();continue;}
  if(pairs.has(char)){stack.push(pairs.get(char));continue;}
  if(closers.has(char))return false;
  if(!stack.length&&/[;、]/u.test(char)){aliases.push(text.slice(start,i));start=i+1;}
 }
 if(stack.length)return false;
 aliases.push(text.slice(start));return aliases.some(alias=>target===formatted(alias));
}
