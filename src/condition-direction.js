// A conservative guard for one recognizable English conditional. It does not
// parse arbitrary prose, nested logic, counterfactuals or general translation.
export function conditionalRelation(source){
 if(typeof source!=='string'||/\b(?:even\s+if|as\s+if|what\s+if|whether|unless)\b/i.test(source))return null;
 const matches=[...source.matchAll(/\b(?:if\s+and\s+only\s+if|only\s+if|if)\b/gi)];if(matches.length!==1)return null;
 const match=matches[0],before=source.slice(0,match.index),after=source.slice(match.index+match[0].length);
 if(!/[A-Za-z]/u.test(after)||/["'“‘]\s*$/u.test(before)||/^\s*["'”’]/u.test(after)||/\b(?:word|phrase|expression|term|conjunction)\s*$/i.test(before))return null;
 const marker=match[0].toLowerCase().replace(/\s+/g,' ');
 if(marker==='if and only if')return 'biconditional';if(marker==='only if')return 'necessary';
 if(/\b(?:only|necessary)\b/i.test(source))return null;
 if(!before.trim()&&!after.includes(','))return null;
 return 'sufficient';
}
export function conditionDirectionMismatch(source,translation){
 const relation=conditionalRelation(source);if(!relation)return false;
 const both=/(?:当且仅当|若且唯若|只要且仅当|充要条件|充分必要条件|有且只有|等价|等同|⇔|↔|<=>)/u.test(translation);
 const necessary=/(?:只有|唯有|仅(?:在|当)|只(?:在|当)|必要条件)/u.test(translation);
 const sufficient=/(?:如果|假如|倘若|只要|若)/u.test(translation);
 if(relation==='biconditional')return !both;
 if(relation==='sufficient')return both||necessary;
 return both||sufficient&&!necessary&&!/(?:必须|前提)/u.test(translation);
}
