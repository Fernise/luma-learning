// Provisional AI-assisted design judgement, never a human educator approval.
export const pedagogicalCriteria = {
  'same-numerator': { objective: 'Relacionar el número de divisiones con su tamaño, manteniendo entero y cantidad de partes seleccionadas.', prerequisites: 'Enteros iguales, reparto en partes iguales y contar las partes seleccionadas.', younger: 'Empezar con barras y señalar todas las partes elegidas; leer el contexto acompañado si hace falta.', older: 'Explicar por qué la regla depende de mantener iguales el entero y el numerador.' },
  'same-denominator': { objective: 'Comparar cuántas partes del mismo tamaño se toman.', prerequisites: 'Contar, comparar cantidades y reconocer partes iguales.', younger: 'Contar partes coloreadas en cada barra antes de introducir nombres formales.', older: 'Relacionar tamaño igual y número de partes; justificar con otro ejemplo.' },
  add: { objective: 'Identificar un incremento constante y comprobarlo en términos conocidos.', prerequisites: 'Sumas y diferencias entre números vecinos.', younger: 'Usar saltos dibujados y comprobar una pareja cada vez.', older: 'Comprobar la misma operación en dos parejas y distinguirla de una conjetura sobre un solo salto.' },
  subtract: { objective: 'Comprobar tamaño y dirección de un cambio descendente.', prerequisites: 'Resta y orden de números.', younger: 'Leer el camino de izquierda a derecha y dibujar la bajada.', older: 'Separar la magnitud del salto de su dirección; comprobar dos parejas.' },
  double: { objective: 'Reconocer una relación multiplicativa, también mediante suma consigo mismo.', prerequisites: 'Duplicar grupos; no es obligatorio conocer el signo de multiplicación.', younger: 'Juntar dos grupos iguales o sumar el término consigo mismo.', older: 'Contrastar doble con incremento constante en dos parejas.' },
  exclude: { objective: 'Descartar posibilidades de un conjunto cerrado usando todas las pistas.', prerequisites: 'Comprender negaciones y mantener tres alternativas.', younger: 'Marcar una exclusión cada vez sin exigir repetir todo el enunciado.', older: 'Explicar por qué queda una posibilidad dentro del conjunto dado.' },
  all: { objective: 'Aplicar una regla a un caso sin invertirla ni excluir propiedades compatibles.', prerequisites: 'Entender todas, condición y característica.', younger: 'Separar la regla del dato del objeto en dos hechos visibles.', older: 'Distinguir lo que asegura la regla de su inversa y de propiedades adicionales.' },
  some: { objective: 'Separar existencia en un grupo de certeza sobre un individuo.', prerequisites: 'Distinguir seguro, posible y desconocido.', younger: 'Comparar dos escenarios posibles sin afirmar una excepción inexistente.', older: 'Explicar por qué el dato del grupo no identifica al individuo; todos podría ser compatible.' },
  bounds: { objective: 'Comprobar paridad y dos límites estrictos sin afirmar unicidad fuera de las opciones.', prerequisites: 'Par/impar y mayor/menor, excluyendo los extremos.', younger: 'Revisar una condición a la vez en el tablero, con apoyo de una recta en papel.', older: 'Comprobar las tres condiciones y buscar si existen otras soluciones fuera de las opciones.' }
};
const notes = {
 pizza: 'Una porción por pizza y enteros iguales: el apoyo conecta reparto con tamaño sin exigir vocabulario de numerador.',
 chocolate: 'Contar 3 y 5 partes iguales; el avance directo inicial solo observa elección, no comprensión.',
 garden: 'Las dos partes con flores deben compararse juntas; no comparar solo un trozo.',
 ribbon: 'Aclarado que se compara la longitud total de los trozos seleccionados, no un trozo individual.',
 transfer: 'Distinguir capacidad del recipiente y cantidad de agua; transferencia cercana, no prueba de retención.',
 juice: 'Capacidad puede requerir explicación con una jarra; no confundirla con número de personas.',
 mosaic: 'Explicar mosaico como dibujo dividido en partes si el sustantivo resulta desconocido.',
 sails: 'Velas de barco aclaradas; las barras comparan cantidad y no representan necesariamente su forma.',
 trail: 'Tramos significa partes del camino; contar todos los iluminados, sin usar brillo como medida.',
 reservoir: 'Depósito puede requerir apoyo oral; 3/5 frente a 3/10 sigue siendo comparación visual, no diagnóstico de nivel.',
 'paint-transfer': 'El contexto de pintura cambia el objeto, pero conserva la comparación de una parte de enteros iguales.',
 'rope-transfer': 'La opción mayor aparece segunda; comparar tres trozos completos evita una estrategia de posición.',
 steps: 'Comprobar el incremento en más de una pareja; acertar por descarte no prueba la regla.',
 doubling: 'Semillas se cuentan por maceta; no suponer un incremento constante ni exigir multiplicación formal.',
 countdown: 'El robot registra posiciones descendentes; el avance directo no acredita una explicación.',
 'new-jumps': 'Piedras contadas en cada parada, evitando confundir cantidades por parada con una acumulación no declarada.',
 shells: 'Comparar cantidades contadas en cada parada; no sumar todas las paradas para responder.',
 lanterns: 'La tercera pista usa otro incremento para enseñar un procedimiento sin entregar el del ejercicio.',
 robot: 'Posiciones de vuelta aclaradas; separar dirección del camino de la magnitud de la resta.',
 bubbles: 'No se anuncia la operación en el título; duplicar mediante dos grupos es una explicación disponible.',
 stairs: 'Saltos de siete añaden carga de cálculo; ofrecer dibujo y evitar convertir dificultad aritmética en falta de razonamiento.',
 'countdown-transfer': 'Energía expresada como unidades; la bajada de seis exige cálculo además de identificación del patrón.',
 'flowers-transfer': 'Transferencia cercana de suma; no atribuir dominio general por un cambio de escenario.',
 'double-transfer': 'Contar mensajes, no crecimiento exponencial social; 64 puede necesitar apoyo de grupos.',
 boxes: 'Una sola llave y conjunto cerrado de tres cajas; descartar dos hechos, no aprender un color ganador.',
 cards: 'Una tarjeta puede tener varios dibujos; la estrella asegurada no excluye un círculo.',
 some: 'Algunos no significa necesariamente no todos; falta el dato individual de Luna.',
 'number-clues': 'Seis es válido entre las opciones; comprobar paridad y ambos extremos, sin leer entre como inclusivo.',
 backpacks: 'Se siguen dos exclusiones dentro de tres mochilas; conservar referencias a los colores.',
 tickets: 'Observatorio explicado en el contexto; acceso a un lugar no excluye el acceso a otros.',
 birds: 'El grupo no identifica a Pipo; distinguir falta de información de certeza de que no tiene plumas amarillas.',
 'even-small': 'Los extremos 2 y 6 están excluidos; cuatro es la opción válida, no una regla memorizada.',
 'odd-large': '13 también cumpliría las pistas aunque no se ofrezca; la pregunta se limita a las opciones.',
 'boats-transfer': 'El nombre Brisa identifica un barco, no una característica de su vela; falta el color individual.',
 'badges-transfer': 'Insignia explicada como distintivo; una luna no excluye un sol ni demuestra color verde por inversión.',
 'odd-transfer': '7 también cumple fuera de las opciones; el contexto nuevo no demuestra generalización duradera.'
};
export function pedagogicalReview(lesson) {
  if (!notes[lesson.id] || !pedagogicalCriteria[lesson.skill]) throw new Error(`Missing provisional review: ${lesson.id}`);
  return { source: 'Revisión asistida por IA', date: '2026-10-07', status: 'Revisión provisional realizada; validación en uso pendiente', ...pedagogicalCriteria[lesson.skill], observation: notes[lesson.id], ageScope: '8–9 y 10–11 son hipótesis de apoyo, no una validación de edades ni un diagnóstico.' };
}
