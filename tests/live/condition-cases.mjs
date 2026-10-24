import assert from 'node:assert/strict';
import {assertNecessaryCondition} from './reader-assertions.mjs';
// Finite constraints for these authored samples, not a general semantic parser.
export function assertSufficientCondition(text){
 assert.match(text,/(?:如果|只要|假如|倘若|若|当.+时)/u,'The sufficient condition must remain recognizable');
 assert.doesNotMatch(text,/(?:只有|仅(?:在|当)|只(?:在|当)|唯有|才|当且仅当|若且唯若|充要条件)/u,'An if clause must not become a necessary or bidirectional condition');
}
export function assertBiconditional(text){
 assert.match(text,/(?:当且仅当|若且唯若|只要且仅当|充要条件)/u,'Both directions of if-and-only-if must remain');
}
export function assertNotAbove(text){
 assert.match(text,/(?<![\d.])5\.0(?![\d.])/u,'The pressure bound must retain decimal precision');
 assert.match(text,/(?:不(?:高于|超过|大于)|(?:未|没有)超过|(?:低于|小于)(?:或|且)?等于|至多|≤|<=)/u,'Not above must retain the inclusive upper bound');
}
const definitions=[
 ['only-if','necessary',false,'The estimate is valid only if the observations are independent; see Eq. (3) and Fig. 2.'],
 ['if','sufficient',false,'If the observations are independent, the estimate is valid; see Eq. (3) and Fig. 2.'],
 ['if-and-only-if','biconditional',false,'The estimate is valid if and only if the observations are independent; see Eq. (3) and Fig. 2.'],
 ['only-if-not-above','necessary',true,'The alarm stops only if the pressure is not above 5.0 bar.'],
 ['if-not-above','sufficient',true,'If the pressure is not above 5.0 bar, the alarm stops.'],
 ['if-and-only-if-not-above','biconditional',true,'The alarm stops if and only if the pressure is not above 5.0 bar.'],
 ['inverted-only-if','necessary',false,'Only if the observations are independent is the estimate valid; see Eq. (3) and Fig. 2.']
];
const checks={necessary:assertNecessaryCondition,sufficient:assertSufficientCondition,biconditional:assertBiconditional};
export const conditionCases=Object.freeze(definitions.map(([id,relation,negative,text])=>Object.freeze({id,relation,negative,text,validate(translated){
 checks[relation](translated);
 if(negative)assertNotAbove(translated);
 else assert.ok(/(?<![\d.])3(?![\d.])/u.test(translated)&&/(?<![\d.])2(?![\d.])/u.test(translated),'Equation and figure reference numbers must remain');
}})));
