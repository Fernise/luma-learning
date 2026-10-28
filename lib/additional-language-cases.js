// Fictitious adult-authored expectations fixed before inspecting this corpus's results.
// 'Some' gives no individual property, including its negation. Questions are not assertions.
const proofs={some:'Faltan datos sobre Luna para saber si lleva un collar azul.',birds:'Faltan datos sobre Pipo para saber si tiene plumas amarillas.','boats-transfer':'Faltan datos sobre Brisa para saber si tiene una vela blanca.'};
const retry=(id,lessonId,text)=>({id,lessonId,turns:[{text,expect:'open',guard:true,reason:'contradiction'},{text,expect:'open',guard:true,reason:'contradiction'},{text:proofs[lessonId],expect:'supported'}]});
const accepted=(id,lessonId,text)=>({id,lessonId,turns:[{text,expect:'supported'}]});
export const additionalLanguageCases=[
 retry('luna-plain-positive','some','Faltan datos sobre Luna, pero Luna lleva un collar azul.'),
 retry('luna-plain-negative','some','Faltan datos sobre Luna, así que Luna no lleva un collar azul.'),
 retry('pipo-plain-negative','birds','No tenemos información de Pipo, pero Pipo no tiene plumas amarillas.'),
 retry('brisa-plain-negative','boats-transfer','Faltan datos sobre Brisa, pero Brisa no tiene una vela blanca.'),
 retry('luna-front-certainty','some','Seguro que Luna lleva un collar azul. Faltan datos sobre Luna.'),
 retry('pipo-front-certainty','birds','Sin duda Pipo tiene plumas amarillas. No sabemos más sobre Pipo.'),
 retry('brisa-positive-and-missing','boats-transfer','Brisa tiene una vela blanca, aunque faltan datos sobre Brisa.'),
 retry('pipo-retracted-but-still-asserted','birds','Antes pensaba que Pipo tenía otro color. Ahora Pipo no tiene plumas amarillas, aunque faltan datos.'),
 accepted('luna-negative-possibility','some','Puede que Luna no lleve un collar azul. Faltan datos de Luna.'),
 accepted('luna-negative-embedded-question','some','No sabemos si Luna no lleva un collar azul. Faltan datos sobre Luna.'),
 accepted('pipo-positive-question','birds','¿Pipo tiene plumas amarillas? Faltan datos para responder.'),
 accepted('brisa-negated-assertion','boats-transfer','No podemos asegurar que Brisa tiene una vela blanca. Faltan datos de Brisa.'),
 accepted('luna-positive-possibility','some','Tal vez Luna lleva un collar azul, pero faltan datos sobre Luna.'),
 accepted('pipo-explicit-retraction','birds','Antes pensaba que Pipo no tiene plumas amarillas. Ahora faltan datos de Pipo.'),
 {id:'pattern-incomplete-rule',lessonId:'steps',turns:[{text:'Los números cambian.',expect:'open'},{text:'Cada vez hay tres más.',expect:'supported'}]},
 {id:'fraction-incomplete-size',lessonId:'pizza',turns:[{text:'He comparado el tamaño de los trozos.',expect:'open'},{text:'Con menos partes cada trozo es más grande.',expect:'supported'}]},
];
