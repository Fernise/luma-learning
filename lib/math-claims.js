// Bounded literal arithmetic checks. True statements are not, by themselves, lesson evidence.
export function arithmeticClaims(value) {
 const claims = [];
 const pattern = /\b(\d{1,4})\s*(\+|mas|\-|menos|[×x*]|por)\s*(\d{1,4})\s*(?:=|son|da|dan)\s*(\d{1,4})\b/g;
 for (const match of value.matchAll(pattern)) {
  const [,a,op,b,c] = match;
  const prefix = value.slice(0,match.index).split(/[.!?;]+/).at(-1);
  const historical = /\b(?:antes pensaba que|pensaba que|creia que|no es cierto que|no es verdad que)\s*$/.test(prefix);
  const left=Number(a),right=Number(b),result=Number(c);
  claims.push({left,right,result,operation:['+','mas'].includes(op)?'add':['-','menos'].includes(op)?'subtract':'multiply',historical});
 }
 return claims;
}
export function falseMathClaim(value) {
 for (const c of arithmeticClaims(value)) if (!c.historical && c.result !== (c.operation==='add'?c.left+c.right:c.operation==='subtract'?c.left-c.right:c.left*c.right)) return true;
 const comparison=/\b(\d{1,4}(?:\s*\/\s*\d{1,4})?)\s*(<=|>=|<|>|=|es mayor que|es menor que|es igual a)\s*(\d{1,4}(?:\s*\/\s*\d{1,4})?)\b/g;
 for (const match of value.matchAll(comparison)) {
  const prefix=value.slice(0,match.index).split(/[.!?;]+/).at(-1);
  // The right operand of an arithmetic expression is not a standalone equality.
  if (match[2] === '=' && /\b\d{1,4}\s*(?:\+|mas|\-|menos|[×x*]|por)\s*$/.test(prefix)) continue;
  if (/\b(?:antes pensaba que|pensaba que|creia que|no es cierto que|no es verdad que)\s*$/.test(prefix)) continue;
  const parse=source=>source.split('/').map(n=>Number(n.trim()));
  const [a,b=1]=parse(match[1]);const [c,d=1]=parse(match[3]);
  if (!b || !d) return true;
  const left=a*d,right=c*b;
  const trueClaim=({'>':left>right,'<':left<right,'=':left===right,'<=':left<=right,'>=':left>=right,'es mayor que':left>right,'es menor que':left<right,'es igual a':left===right})[match[2]];
  if (!trueClaim) return true;
 }
 return false;
}
export function patternArithmeticEvidence(value,lesson) {
 const claims=arithmeticClaims(value).filter(c=>!c.historical);
 if (!claims.length) return null;
 const pairs=new Set();
 for (const c of claims) {
  let from;
  if (lesson.rule==='double') {
   if(c.operation==='add'&&c.left===c.right)from=c.left;
   if(c.operation==='multiply'&&c.right===2)from=c.left;
   if(c.operation==='multiply'&&c.left===2)from=c.right;
  }else if(c.operation===(lesson.step<0?'subtract':'add')&&c.right===Math.abs(lesson.step))from=c.left;
  const index=lesson.sequence.indexOf(from);
  if(index<0 || lesson.sequence[index+1]!==c.result)return false;
  pairs.add(index);
 }
 return pairs.size>=2;
}
