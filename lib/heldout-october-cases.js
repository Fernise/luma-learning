// New fictitious expectations frozen before classification changes on 22 October.
export const octoberHeldoutCases=[
 {id:'double-copies-valid',lessonId:'doubling',text:'Junto dos copias del número anterior.',expect:'supported'},
 {id:'double-times-valid',lessonId:'doubling',text:'Cada término vale dos veces el anterior.',expect:'supported'},
 {id:'double-copies-wrong',lessonId:'doubling',text:'Junto tres copias del número anterior.',expect:'not-supported',guard:true},
 {id:'double-times-wrong',lessonId:'doubling',text:'Cada término vale tres veces el anterior.',expect:'not-supported',guard:true},
 {id:'pieces-fewer-valid',lessonId:'pizza',text:'Si parto el mismo entero en menos pedazos cada pedazo es mayor.',expect:'supported'},
 {id:'pieces-more-valid',lessonId:'pizza',text:'Con más partes del mismo entero los trozos salen más pequeños.',expect:'supported'},
 {id:'pieces-fewer-wrong',lessonId:'pizza',text:'Con menos partes cada trozo es menor.',expect:'not-supported',guard:true},
 {id:'pieces-more-wrong',lessonId:'pizza',text:'Con más partes cada trozo es mayor.',expect:'not-supported',guard:true},
 {id:'equal-pieces-valid',lessonId:'chocolate',text:'Cada pedazo mide lo mismo y tomo una cantidad mayor de partes.',expect:'supported'},
 {id:'equal-amount-valid',lessonId:'chocolate',text:'Los trozos tienen igual tamaño y al juntar más trozos hay más cantidad.',expect:'supported'},
 {id:'equal-fewer-wrong',lessonId:'chocolate',text:'Cada pedazo mide lo mismo pero con menos partes consigo más cantidad.',expect:'not-supported',guard:true},
 {id:'equal-fewer-conflicting',lessonId:'chocolate',text:'Los trozos son iguales y más partes dan más cantidad pero menos partes dan más cantidad.',expect:'not-supported',guard:true},
 {id:'all-group-valid',lessonId:'cards',text:'Esta tarjeta roja está dentro del grupo de todas las que llevan estrella.',expect:'supported'},
 {id:'all-rule-valid',lessonId:'cards',text:'La regla habla de todas las rojas y esta es roja por eso tiene estrella.',expect:'supported'},
 {id:'all-converse-wrong',lessonId:'cards',text:'Como lleva estrella podemos asegurar que es roja.',expect:'not-supported',guard:true},
 {id:'all-exclusive-wrong',lessonId:'cards',text:'Todas las rojas llevan estrella y por eso no pueden llevar otro dibujo.',expect:'not-supported',guard:true},
];
