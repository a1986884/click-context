import test from 'node:test';import assert from 'node:assert/strict';
import {contextSamples,assertContextGloss} from './live/context-gloss-cases.mjs';
test('contextual oracle accepts frequency synonyms but rejects unmarked heads and incorrect fish subtypes',()=>{
 const speaker=contextSamples.find(sample=>sample[1]==='The bass speaker was beside the stage.'),rule={expected:speaker[2],forbidden:speaker[5]};
 for(const zh of ['低音','低频音'])assertContextGloss(zh,rule);
 for(const zh of ['低音扬声器','低频音箱'])assert.throws(()=>assertContextGloss(zh,rule));
 const fish=contextSamples.find(sample=>sample[1].includes('released the bass')),fishRule={expected:fish[2],forbidden:fish[5]};assertContextGloss('鲈鱼',fishRule);assert.throws(()=>assertContextGloss('鳜鱼',fishRule));
});
