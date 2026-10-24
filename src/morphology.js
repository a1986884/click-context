// Explicit reviewed inflections only: no suffix stripping and no guessed entries.
const forms={studying:'study',studied:'study',studies:'study',researchers:'researcher',went:'go',gone:'go',going:'go',goes:'go',ran:'run',running:'run',children:'child',mice:'mouse',feet:'foot',teeth:'tooth',was:'be',were:'be',is:'be',are:'be',been:'be',am:'be',did:'do',done:'do',does:'do',had:'have',has:'have',learning:'learn',learned:'learn',scientists:'scientist',ecosystems:'ecosystem',creatures:'creature',wonders:'wonder',holds:'hold',carries:'carry',waiting:'wait',discovered:'discover',changing:'change',begins:'begin',tools:'tool',ideas:'idea',problems:'problem',patterns:'pattern',gives:'give',questions:'question',built:'build'};
export function resolveForm(word){const original=word.toLowerCase().replaceAll('’',"'").trim();return {original,lemma:forms[original]||original,confirmed:Boolean(forms[original]),note:forms[original]?`已确认词形：${original} → ${forms[original]}`:'未做词形改写，按原词查询；不确定的变形不会自动猜测。'};}
export const localEntries={
 study:{zh:'学习；研究',pos:'verb / noun',phonetic:'/ˈstʌdi/',english:'To learn about a subject by reading, practising, or investigating.'},
 researcher:{zh:'研究人员',pos:'noun',english:'A person who investigates a subject to discover or establish knowledge.'},
 go:{zh:'去；前往',pos:'verb',english:'To move or travel from one place to another.'},
 ocean:{zh:'海洋',pos:'noun',phonetic:'/ˈəʊʃən/',english:'A very large body of salt water covering part of the Earth.'},
 scientist:{zh:'科学家',pos:'noun',english:'A person who studies the natural world using evidence and experiments.'},
 learn:{zh:'学习；了解',pos:'verb',english:'To gain knowledge or a skill through study or experience.'},
 ecosystem:{zh:'生态系统',pos:'noun',english:'Living things and their physical environment interacting as a system.'},
 curiosity:{zh:'好奇心',pos:'noun',english:'A desire to know or learn more about something.'}
};
