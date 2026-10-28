// Bounded relations shared by the local assessor and pre-provider checks.
// Input is normalized and (for copy claims) number words have been converted.
import {claimIsNegated} from './learner-language.js';
export function copyClaims(value){
 const claims=[];
 for(const pattern of [/\b(?:junto|reuno|sumo|combino)\s+(\d+)\s+copias?\s+del numero anterior\b/g,/\b(?:termino|numero)\s+(?:vale|es)\s+(\d+)\s+veces el anterior\b/g])for(const match of value.matchAll(pattern))claims.push({amount:Number(match[1]),negated:/\bno\s*$/.test(value.slice(0,match.index))});
 return claims;
}
export function copyIssue(claims){return claims.some(c=>c.negated?c.amount===2:c.amount!==2);}
export function fractionRelationIssue(value,lesson){
 const parts='(?:partes?|trozos?|pedazos?|cachos?|porcion(?:es)?)';
 const asserted=pattern=>[...value.matchAll(pattern)].some(match=>!claimIsNegated(value.slice(0,match.index)));
 if(lesson.kind==='same-numerator'){
  if(asserted(new RegExp(`\\bmenos ${parts} cada ${parts} (?:es|sale|resulta) (?:menor|mas pequen[oa])\\b|\\bmas ${parts} cada ${parts} (?:es|sale|resulta) (?:mayor|mas grande)\\b`,'g')))return 'denominator-error';
 }
 if(lesson.kind==='same-denominator'&&asserted(new RegExp(`\\bmenos ${parts} (?:dan|da|consigo|tengo|hay|obtengo|ocupan|representan) (?:mas|mayor) cantidad\\b`,'g')))return 'unclear';
 return null;
}
