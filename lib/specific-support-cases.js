// Fixed quality expectations before changing follow-up/support routing. Fictitious adult text.
export const specificSupportCases=[
 {id:'luna-negative',lessonId:'some',text:'Faltan datos, así que Luna no lleva un collar azul.',focus:'tiene o no|ausencia|afirm'},
 {id:'luna-positive',lessonId:'some',text:'Faltan datos, pero Luna lleva un collar azul.',focus:'tiene o no|ausencia|afirm'},
 {id:'pipo-negative',lessonId:'birds',text:'Pipo no tiene plumas amarillas, aunque faltan datos.',focus:'tiene o no|ausencia|afirm'},
 {id:'brisa-negative',lessonId:'boats-transfer',text:'Brisa no tiene una vela blanca, aunque faltan datos.',focus:'tiene o no|ausencia|afirm'},
 {id:'luna-certainty',lessonId:'some',text:'Luna seguro lleva un collar azul. Faltan datos.',focus:'segur'},
 {id:'pipo-certainty',lessonId:'birds',text:'Pipo tiene plumas amarillas sin duda. Faltan datos.',focus:'segur'},
 {id:'brisa-certainty',lessonId:'boats-transfer',text:'Brisa tiene una vela blanca seguro. Faltan datos.',focus:'segur'},
 {id:'group-universal',lessonId:'some',text:'Algunos significa todos.',focus:'todo el grupo'},
 {id:'group-exception',lessonId:'some',text:'Solo algunos perros llevan collar azul.',focus:'alguien'},
];
