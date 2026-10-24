import assert from 'node:assert/strict';
// Constraints for the two fixed public-safe paragraphs used by the live probe.
// These catch specific omissions; they do not prove general translation quality.
// Match a negation of significance, rather than an unrelated 不 in 不同.
export function assertStatisticalNegation(text){
 assert.match(text,/(?:不(?:具有|具备|呈现|显示|达到)?|(?:未|没有)(?:能)?(?:达到|达|见|有|呈现|显示(?:出)?|观察到)?)(?:统计学(?:上)?|统计(?:上)?)?显著|(?:无|没有|不(?:具有|具备))(?:统计学|统计)(?:意义|显著性)/u,'The statistical significance must be negated');
}
export function assertNecessaryCondition(text){
 assert.doesNotMatch(text,/(?:当且仅当|若且唯若|只要且仅当|充要条件)/u,'Only-if must not gain a converse implication');
 assert.doesNotMatch(text,/(?:不仅|不只|并非(?:仅|只有)|不是(?:仅|只有))/u,'A not-only statement reverses the necessary condition');
 assert.match(text,/(?:仅(?:仅)?(?:在|当|对|适用于)|只(?:在|当|对)|只有|唯有)/u,'The necessary-only condition must remain');
}
export function assertParagraphTranslations(translations){
 assert.equal(translations.length,2,'Both public sample paragraphs must be translated');
 assert.ok(translations.every(text=>/[\u3400-\u9fff]/u.test(text)),'Each paragraph must contain Chinese');
 const [statistics,condition]=translations;
 assert.ok(/12\.5/.test(statistics)&&/8\.0/.test(statistics),'Mortality values must retain decimal precision');
 assert.ok(/0\.08/.test(statistics),'The statistical p value must remain');assertStatisticalNegation(statistics);
 assertNecessaryCondition(condition);
 assert.ok(/(?<![\d.])3(?![\d.])/.test(condition)&&/(?<![\d.])2(?![\d.])/.test(condition),'The equation and figure reference numbers must remain');
}

export function assertConfidenceInterval(text){
 const value=text.normalize('NFKC').replace(/[−﹣－]/gu,'-');
 for(const number of ['-2.0','95','1.2','2.3'])assert.ok(value.includes(number),'The original scientific value must remain: '+number);
 assert.doesNotMatch(value,/置信区间\s*(?:为|是|等于|=|:)\s*95\s*%/u,'The confidence level must not become an interval value');
 assert.match(value,/(?:95\s*%\s*(?:的)?\s*置信(?:区间|水平|度|系数)|置信区间\s*\(\s*95\s*%\s*\)|置信(?:水平|度|系数)\s*(?:为|是|:)?\s*95\s*%)/u,'The 95 percent confidence level must remain attached to the interval');
}
