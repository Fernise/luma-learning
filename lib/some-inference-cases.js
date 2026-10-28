// Authored, fictitious regression examples; not held-out evaluation data.
export const someInferenceCases = [
  { id: 'some', positive: [
    'No sabemos si todos los perros llevan collar azul. Falta información sobre Luna.',
    'Puede que solo algunos perros tengan collar azul, o podrían ser todos. De Luna no tenemos ese dato.',
    'La pista no dice que no todos tengan collar azul. No sabemos si Luna lo lleva.',
    'Algunos no quiere decir que todos tengan collar azul; faltan datos de Luna.',
  ], negative: [
    'Solo algunos perros llevan collar azul.',
    'No todos los perros tienen collar azul, así que faltan datos de Luna.',
    'Algunos significa que no todos llevan collar azul.',
    'No se puede asegurar porque solo algunos tienen ese collar.',
    'No se puede asegurar porque algunos perros no tienen collar azul.',
    'No sabemos más, pero algunos son todos y Luna lleva el collar.',
  ] },
  { id: 'birds', positive: [
    'Quizá no todos tengan plumas amarillas; quizá sí. No tenemos información de Pipo.',
    'No se puede asegurar que solo algunos sean amarillos. Faltan datos de Pipo.',
  ], negative: ['Solo algunos pájaros tienen plumas amarillas.', 'No todos tienen plumas amarillas; faltan datos de Pipo.'] },
  { id: 'boats-transfer', positive: [
    'Podrían ser todos los barcos o solo algunos. No sabemos el color de la vela del Brisa.',
    'Pensaba que no todos tenían vela blanca, pero me he corregido: falta información del Brisa.',
  ], negative: ['Algunos barcos no tienen vela blanca.', 'No todos los barcos tienen vela blanca.'] },
];
