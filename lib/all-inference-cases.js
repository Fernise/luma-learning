// Fictitious authored regression cases; not an independent precision estimate.
export const allInferenceCases = [
  { id: 'cards', positive: [
    'Esta tarjeta es roja y todas las rojas tienen estrella.',
    'Todas las rojas tienen estrella y esta es roja. No sabemos si tiene un círculo.',
    'Solo tiene que ser roja para aplicar la regla de las rojas; tiene estrella.',
  ], negative: [
    'Todas las rojas tienen estrella y esta es roja. Solo tiene una estrella.',
    'Todas las rojas tienen estrella y esta es roja. No tiene un círculo.',
    'Todas las rojas tienen estrella y esta es roja. Jamás lleva un círculo.',
    'No todas las rojas tienen estrella. Esta es roja y la regla dice estrella.',
  ], possibilities: ['La regla no dice que no tenga un círculo.', 'Puede que solo tenga una estrella.'] },
  { id: 'tickets', positive: [
    'Todas las entradas azules permiten entrar al observatorio y esta entrada es azul.',
    'Todas las entradas azules permiten entrar al observatorio y esta entrada es azul. No sabemos si permite entrar al jardín.',
  ], negative: [
    'Todas las entradas azules permiten entrar al observatorio y esta es azul. Solo permite entrar al observatorio.',
    'Todas las entradas azules permiten entrar al observatorio y esta es azul. No permite entrar al jardín.',
  ], possibilities: ['No sabemos si no permite entrar al jardín.'] },
  { id: 'badges-transfer', positive: [
    'Todas las insignias verdes tienen luna y esta insignia es verde.',
    'Todas las insignias verdes tienen luna y esta insignia es verde. No sabemos si tiene un sol.',
  ], negative: [
    'Todas las insignias verdes tienen luna y esta es verde. Solo tiene una luna.',
    'Todas las insignias verdes tienen luna y esta es verde. Nunca lleva un sol.',
  ], possibilities: ['No se puede asegurar que no tenga un sol.'] },
];

// Direction, explicit rule denial and complete negated-converse clauses.
const additions = {
  cards: {
    positive: ['Todas las rojas tienen estrella y esta es roja. Tener una estrella no significa que sea roja.'],
    negative: [
      'Todas las rojas tienen estrella. Tiene una estrella, por eso es roja.',
      'Esta es roja porque tiene una estrella. Todas las rojas tienen estrella.',
      'La regla dice que todas las tarjetas con estrella son rojas.',
      'Si tiene una estrella entonces es roja. Aplico la regla.',
      'Las rojas no tienen estrella. Esta tarjeta es roja.',
      'No sabemos si lleva un círculo, pero tiene estrella por eso es roja.',
    ],
    possibilities: ['No implica que si tiene estrella sea roja.', 'Puede que esta tarjeta tenga estrella y sea roja.'],
  },
  tickets: {
    positive: ['Todas las entradas azules permiten entrar al observatorio y esta es azul. Entrar al observatorio no implica que sea azul.'],
    negative: [
      'Todas las azules permiten entrar al observatorio. Puede entrar al observatorio, entonces es azul.',
      'Es azul porque permite entrar al observatorio. Aplico la regla.',
      'No todas las entradas azules permiten entrar al observatorio. Esta entrada es azul.',
    ],
    possibilities: ['No sabemos si puede entrar al observatorio entonces es azul.'],
  },
  'badges-transfer': {
    positive: ['Todas las verdes tienen luna y esta es verde. Tener una luna no significa que sea verde.'],
    negative: [
      'Todas las verdes tienen luna. Como tiene una luna es verde.',
      'La regla dice que todas las insignias que tienen luna son verdes.',
      'Las insignias verdes no tienen luna. Esta es verde.',
    ],
    possibilities: ['La regla no dice que es verde porque tiene luna.', 'Quizá si tiene una luna sea verde.'],
  },
};
for (const item of allInferenceCases) for (const group of ['positive', 'negative', 'possibilities']) item[group].push(...additions[item.id][group]);
