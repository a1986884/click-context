// A narrow guard for an explicit confidence percentage plus interval endpoints.
// It declines ambiguous shapes; it is not a general scientific meaning checker.
export function confidenceRoleMismatch(source,translated){
 const input=source.normalize('NFKC'),output=translated.normalize('NFKC');
 const intervals=input.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*%\s+confidence\s+intervals?\s*(?:of|is|=|:)?\s*[\[(]\s*([^\])]+)[\])]/giu);
 for(const [,level,bounds]of intervals){
  const endpoints=bounds.match(/[-+]?\d+(?:\.\d+)?/gu)||[];
  if(endpoints.length!==2||endpoints.some(value=>Number(value)===Number(level)))continue;
  const literal=level.replaceAll('.',String.raw`\.`);
  if(new RegExp(String.raw`置信区间\s*(?:为|是|等于|=|:)\s*${literal}\s*%`,'u').test(output))return true;
 }
 return false;
}
