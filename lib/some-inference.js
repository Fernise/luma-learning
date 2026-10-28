// Authored Spanish constructions, not a general semantic parser.
// Receives normalized text. 'Some' establishes existence, not an exception.
export function someInferenceIssue(value, lesson) {
  const facts={some:['luna','lleva','(?:un )?collar azul'],birds:['pipo','tiene','plumas amarillas'],'boats-transfer':['brisa','tiene','(?:una )?vela blanca']};
  const fact=facts[lesson?.id];
  if(fact){
    const [subject,verb,property]=fact;
    // Neither the property nor its absence follows for this named individual.
    // Check the assertion before generic missing-data wording can earn credit.
    const assertion=new RegExp(`\\b${subject} (?:(?:seguro|sin duda) )?(?:no )?${verb} ${property}(?: (?:seguro|sin duda))?\\b`,'g');
    for(const clause of value.split(/[.!?;]+|\b(?:pero|porque|por eso|asi que)\b/))for(const match of clause.matchAll(assertion)){
      const prefix=clause.slice(0,match.index);
      const scoped=/(?:no sabemos si|no se sabe si|no podemos asegurar que|no se puede asegurar que|no significa que|no implica que|no es cierto que|no es verdad que|puede que|podria ser que|quiza|tal vez|pensaba que|creia que)\s*$/.test(prefix);
      // An opening Spanish question mark scopes a question, not later sentences.
      if(!prefix.includes('¿')&&!scoped)return /seguro|sin duda/.test(match[0])?'unsupported-certainty':'unsupported-individual';
    }
  }
  const clauses = value.split(/[.!?;]+|\b(?:pero|porque|por eso|asi que|ya que)\b/);
  for (const clause of clauses) {
    const claims = [...clause.matchAll(/\b(?:solo algun[oa]s|no tod[oa]s|algun[oa]s\s+(?:significa[n]?|son|implica[n]?)\s+(?:que\s+)?tod[oa]s|algun[oa]s(?:\s+\w+){0,4}\s+no\s+(?:tienen|llevan|son|cumplen|permiten))\b/g)];
    for (const claim of claims) {
      const prefix = clause.slice(0, claim.index);
      // A possibility, a negated inference or a corrected prior thought is not an assertion.
      if (/\b(?:puede que|podria(?:n)?(?: ser| haber)?|quiza|tal vez|no sabemos si|no se sabe si|no podemos asegurar que|no se puede asegurar que|no significa que|no quiere decir que|no implica que|no dice que|no demuestra que|pensaba que|creia que)\b[^:]*$/.test(prefix)) continue;
      return /tod[oa]s$/.test(claim[0]) && !/^no /.test(claim[0]) ? 'unsupported-universal' : 'unsupported-exception';
    }
  }
  return null;
}
