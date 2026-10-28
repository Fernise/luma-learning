// Adult-authored definitions. Only a word present in this lesson may be queried.
const definitions={
 capacidad:'La capacidad es la cantidad que puede caber en un recipiente.',
 deposito:'Un depósito es un recipiente donde se guarda agua u otra cosa.',
 mosaico:'Un mosaico es un dibujo formado por piezas pequeñas.',
 tramos:'Los tramos son partes de un camino.',
 insignia:'Una insignia es un pequeño distintivo, como una chapa o un dibujo que identifica un grupo.',
 observatorio:'Un observatorio es un lugar para mirar y estudiar el cielo.',
 impar:'Un número impar deja uno sin pareja cuando agrupas sus objetos en parejas.',
 par:'Un número par permite agrupar todos sus objetos en parejas sin que sobre ninguno.',
 algunos:'Algunos indica que hay miembros del grupo con esa característica; esa palabra por sí sola no dice si la tienen todos.',
 todas:'Todas indica que la regla se aplica a cada una de las cosas del grupo.',
 todos:'Todos indica que la regla se aplica a cada uno de los miembros del grupo.',
 regla:'Una regla describe la relación que intentas mantener en los pasos del juego.',
 patron:'Un patrón es una relación que se repite o se mantiene entre elementos.',
};
const plain=text=>String(text).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
export function vocabularyHelp(value,lesson){
 const request=value.replace(/[¿?¡!.,;:«»"']/g,'').trim().match(/^(?:que significa|que quiere decir|no entiendo la palabra|explicame la palabra)\s+(?:la palabra\s+)?([a-z]+)(?: por favor)?$/);
 if(!request)return null;
 const word=request[1];const context=plain(`${lesson.context??''} ${lesson.prompt??''} ${lesson.title??''}`).split(/[^a-z]+/);
 if(!context.includes(word))return null;
 return definitions[word]?`${definitions[word]} ¿Te ayuda a entender lo que pide el ejercicio?`:'Esa palabra aparece en el ejercicio. ¿Qué parte de la frase donde aparece te resulta confusa?';
}
