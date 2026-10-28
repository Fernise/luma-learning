// Authored facts only; these bounded checks are not a general language parser.
const facts = {
  cards: { condition: 'roja', plural: 'rojas', property: 'estrella', group: 'tarjetas' },
  tickets: { condition: 'azul', plural: 'azules', property: 'observatorio', group: 'entradas' },
  'badges-transfer': { condition: 'verde', plural: 'verdes', property: 'luna', group: 'insignias' },
};
const uncertain = /\b(?:no sabemos(?: si)?|no se sabe(?: si)?|no dice que|no significa que|no implica que|no podemos asegurar que|no se puede asegurar que|puede que|podria|quiza|pensaba que|creia que)\b(?:\s+(?:esta|esa|la|tarjeta|entrada|insignia))*\s*$/;

function ruleIssue(value, lesson) {
  const fact = facts[lesson.id];
  if (!fact) return null;
  const { condition, plural, property, group } = fact;
  const propertyClaim = `(?:tiene[n]?|tenga[n]?|lleva[n]?|(?:puede[n]?|permite[n]?) entrar)\\s+(?:(?:un|una|el|la|al)\\s+)?${property}`;
  const colourClaim = `(?:es|sea|son|sean)\\s+(?:${condition}|${plural})`;
  const reversals = [
    new RegExp(`\\b(?:si|como)\\s+(?:esta\\s+(?:tarjeta|entrada|insignia)\\s+)?${propertyClaim}.{0,40}\\b${colourClaim}\\b`, 'g'),
    new RegExp(`\\b${propertyClaim}\\s*(?:,\\s*)?(?:entonces|por eso|asi que|por tanto|por lo tanto|lo que demuestra que|lo que prueba que)\\s+${colourClaim}\\b`, 'g'),
    new RegExp(`\\b${colourClaim}\\s+porque\\s+${propertyClaim}\\b`, 'g'),
    new RegExp(`\\b(?:todas las|las)\\s+${group}\\s+(?:con|que\\s+${propertyClaim}\\s*)\\s*(?:(?:un|una|el|la)\\s+)?(?:${property}\\s+)?son\\s+${plural}\\b`, 'g'),
  ];
  const denials = [
    new RegExp(`\\bno todas las\\s+(?:${group}\\s+)?${plural}\\s+${propertyClaim}\\b`, 'g'),
    new RegExp(`\\b(?:todas las|las)\\s+(?:${group}\\s+)?${plural}\\s+no\\s+${propertyClaim}\\b`, 'g'),
  ];
  // Do not split causal links: their direction is the thing being checked.
  for (const clause of value.split(/[.!?;]+/)) {
    for (const claim of denials.flatMap(pattern => [...clause.matchAll(pattern)])) {
      if (!uncertain.test(clause.slice(0, claim.index))) return 'negated-rule';
    }
    for (const claim of reversals.flatMap(pattern => [...clause.matchAll(pattern)])) {
      if (!uncertain.test(clause.slice(0, claim.index))) return 'unsupported-converse';
    }
  }
  return null;
}

// Bounded checks for the three authored universal-rule activities.
// A rule proving one property does not prove absence of another property.
export function allInferenceIssue(value, lesson) {
  const issue = ruleIssue(value, lesson);
  if (issue) return issue;
  const other = String(lesson.options[1 - lesson.correct]).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').split(' ').at(-1);
  if (!['circulo', 'sol', 'jardin'].includes(other)) return null;
  const clauses = value.split(/[.!?;]+|\b(?:pero|porque|por eso|asi que)\b/);
  const known = String(lesson.options[lesson.correct]).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').split(' ').at(-1);
  const denial = new RegExp(`\\b(?:no|nunca|jamas)\\s+(?:tiene[n]?|tenga[n]?|lleva[n]?|puede[n]? tener|permite[n]? (?:entrar|ir)|se puede entrar)\\s+(?:(?:un|una|el|la|al|ningun|ninguna)\\s+)?${other}\\b`, 'g');
  const exclusive = new RegExp(`\\b(?:solo|solamente|unicamente)\\s+(?:tiene[n]?|tenga[n]?|lleva[n]?|permite[n]? (?:entrar|ir)|puede[n]? (?:entrar|ir))\\s+(?:(?:un|una|el|la|al)\\s+)?${known}\\b`, 'g');
  const noOtherDrawing=/\bno puede[n]? (?:tener|llevar) (?:otro|ningun otro) dibujo\b/g;
  for (const clause of clauses) for (const claim of [...clause.matchAll(denial), ...clause.matchAll(exclusive), ...(['estrella','luna'].includes(known)?clause.matchAll(noOtherDrawing):[])]) {
    const prefix = clause.slice(0, claim.index);
    if (uncertain.test(prefix)) continue;
    // A single star/moon may describe a count or exclude other drawing types. Ask, do not decide.
    if (['estrella', 'luna'].includes(known) && /^(?:solo|solamente|unicamente)\s+(?:tiene|lleva)\s+una\s+/.test(claim[0])) return 'ambiguous-quantity';
    return 'unsupported-exclusion';
  }
  return null;
}

// Remove only a complete, explicitly unknown extra-property clause.
// Remaining negations stay available to the conservative local check.
export function allProofText(value, lesson) {
  const other = String(lesson.options[1 - lesson.correct]).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').split(' ').at(-1);
  if (!['circulo', 'sol', 'jardin'].includes(other)) return value;
  const unknown = new RegExp(`^(?:no sabemos|no se sabe|no podemos asegurar|la regla no dice)(?: si| que)?\\s+(?:tambien\\s+)?(?:tiene[n]?|tenga[n]?|lleva[n]?|puede[n]? (?:entrar|ir)|permite[n]? entrar)\\s+(?:(?:un|una|el|la|al)\\s+)?${other}$`);
  const fact = facts[lesson.id];
  const rejectedConverse = fact && new RegExp(`^(?:tener|llevar|entrar)\\s+(?:(?:un|una|el|la|al)\\s+)?${fact.property}\\s+no (?:significa|implica) que (?:sea|es) ${fact.condition}$`);
  return value.split(/[.!?;]+/).map(clause => clause.trim()).filter(clause => !unknown.test(clause) && !rejectedConverse?.test(clause)).join('. ');
}
