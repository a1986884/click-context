import {resolveForm} from './morphology.js';
export function collinsWord(word){
 word=String(word).trim().toLowerCase().replaceAll('’',"'");
 if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word)||word.length>80)throw Object.assign(Error('请输入一个英文单词。'),{code:'INVALID_WORD'});
 return resolveForm(word).lemma;
}
export function collinsSources(word){const path=encodeURIComponent(collinsWord(word));return ['english-chinese','english'].map(language=>'https://www.collinsdictionary.com/dictionary/'+language+'/'+path);}
export function collinsQuery(value){
 const word=String(value).trim().toLowerCase().replaceAll('’',"'").replace(/\s+/g,' ');
 if(word.length>80||!/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*){0,3}$/.test(word))throw Object.assign(Error('请选择一个英文单词或不超过四个词的短语。'),{code:'INVALID_WORD'});
 return word;
}
export function bilingualSources(word){const query=collinsQuery(word),path=encodeURIComponent(query.replaceAll(' ','-'));return ['https://dict.youdao.com/w/eng/'+encodeURIComponent(query.replaceAll(' ','_'))+'/#collinsResult',...['english-chinese','english'].map(language=>'https://www.collinsdictionary.com/dictionary/'+language+'/'+path)];}
