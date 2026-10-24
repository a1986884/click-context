import {parseTranslationResult,TRANSLATION_CACHE_VERSION} from './translation-service.js';
// Client validation has its own cache identity; the server protocol stays v5.
export const CLIENT_TRANSLATION_CACHE_VERSION=TRANSLATION_CACHE_VERSION+':client-v4';
const numeral='\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?';
function sourceSigns(text){
 return text.replace(new RegExp('\\bnegative\\s+('+numeral+')','gi'),'-$1')
  // A binary "5 minus 2" keeps its unsigned operand. Only clear unary contexts
  // are canonicalized, along with explicit below-zero temperature wording.
  .replace(new RegExp('(^|\\b(?:is|was|were|be|at|of|equals?|not)\\b|[=(:;,])\\s*minus\\s+('+numeral+')','gi'),(_all,before,value)=>before+' -'+value)
  .replace(new RegExp('(?<![A-Za-z\\d.])('+numeral+')(\\s*(?:degrees?(?:\\s+(?:Celsius|Fahrenheit))?|°[CF])?)\\s+below\\s+zero\\b','gi'),(_all,value,unit)=>'-'+value+unit);
}
function targetSigns(text){return text.replace(/零下\s*(?=\d)|(?<![正负負胜勝])(?:负|負)\s*(?=\d)/gu,'-');}
function temperaturePairs(text){
 const value=text.replace(/[−﹣－]/gu,'-').replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/gu,n=>n.replaceAll(',','')),pairs=[];
 const scale=unit=>/^(?:c|celsius|摄氏)$/iu.test(unit)?'C':'F';
 for(const match of value.matchAll(new RegExp('(?<![A-Za-z\\d.])[-+]?'+numeral,'gu'))){
  const end=match.index+match[0].length,after=value.slice(end,end+40),before=value.slice(Math.max(0,match.index-24),match.index);
  const tail=after.match(/^\s*(?:degrees?\s*(Celsius|Fahrenheit)\b|°\s*([CF])\b|(?:度\s*)?(?:\(\s*)?(摄氏|华氏)(?:度)?(?:\s*\))?)/iu),head=before.match(/(摄氏|华氏)(?:度)?\s*$/u);
  if(!tail&&!head)continue;
  const suffix=tail&&scale(tail[1]||tail[2]||tail[3]),prefix=head&&scale(head[1]);
  pairs.push({number:match[0].replace(/^[-+]/u,''),unit:suffix&&prefix&&suffix!==prefix?'conflict':suffix||prefix});
 }
 return pairs;
}
function temperatureMismatch(source,target){
 const required=temperaturePairs(source);if(!required.length)return false;
 const available=new Map();for(const pair of temperaturePairs(target)){
  if(pair.unit==='conflict')return true;
  const key=pair.unit+'|'+pair.number;available.set(key,(available.get(key)||0)+1);
 }
 for(const pair of required){const key=pair.unit+'|'+pair.number,count=available.get(key)||0;if(pair.unit==='conflict'||!count)return true;available.set(key,count-1);}
 return false;
}
function magnitudeCopy(source,target){
 // A loss may describe a negative return; a decrease BY an amount may describe
 // a negative change. Neither licenses a negative final level or another value.
 const losses=[],changes=[];
 for(const match of source.matchAll(new RegExp('\\b(?:loss(?:es)?|deficit)\\s+(?:(?:of|was|is|were|are)\\s+)?('+numeral+')(?![\\d]|[.,]\\d)','gi')))losses.push(match[1]);
 for(const match of source.matchAll(new RegExp('\\b(?:fell|fallen|decreas(?:e|ed)|declin(?:e|ed)|drop(?:ped)?|reduc(?:e|ed))\\s+by\\s+('+numeral+')(?![\\d]|[.,]\\d)','gi')))changes.push(match[1]);
 return target.replace(new RegExp('((?:回报|收益)(?:率)?(?:为|是)?|(?:变化|变动)(?:幅度)?(?:为|是)?)\\s*-('+numeral+')(?![\\d]|[.,]\\d)','gu'),(all,label,value)=>{
  const pools=/^(?:变化|变动)/u.test(label)?[changes,losses]:[losses];
  for(const pool of pools){const at=pool.indexOf(value);if(at>=0){pool.splice(at,1);return label+value;}}
  return all;
 });
}
const invalid=reason=>Object.assign(Error('译文未通过客户端校验'),{validationReason:reason});
export function clientTranslationText(value,input,{serverValidated=false}={}){
 if(typeof value!=='string'||typeof input?.text!=='string')throw invalid('invalid-text');
 const original=value.trim();
 if(!original||original.length>input.text.length*4+300)throw invalid('invalid-text');
 if(/^<think(?:\s[^>]*|)>/i.test(original)&&!/<\/?think\b/i.test(input.text))throw invalid('invalid-text');
 const sourceBase=input.text.normalize('NFKC'),targetBase=original.normalize('NFKC'),source=sourceSigns(sourceBase),target=targetSigns(targetBase);
 if(temperatureMismatch(source,target))throw invalid('unit-mismatch');
 const changed=source!==sourceBase||target!==targetBase;
 if(!serverValidated||changed){
  // A bare "负2.0" is valid Chinese. Keep a Chinese marker only in the
  // validation copy if canonicalizing its sign removes its sole Chinese word.
  const checked=target!==targetBase&&!/[\u3400-\u9fff]/u.test(target)&&/[\u3400-\u9fff]/u.test(original)?'数值'+target:target;
  try{parseTranslationResult({response:changed?checked:original},{...input,text:changed?source:input.text});}
  catch(error){
   if(error.validationReason!=='number-mismatch'||source!==sourceBase||original.includes('零下'))throw error;
   const magnitude=magnitudeCopy(source,target);
   if(magnitude===target)throw error;
   parseTranslationResult({response:magnitude},{...input,text:source});
  }
 }
 return original;
}
