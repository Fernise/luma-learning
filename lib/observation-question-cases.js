// Expectations fixed before the observation follow-up edit. Fictitious adult
// examples; repeated known proposals are regressions, not independent accuracy.
const echo='¿Qué has comparado entre los tamaños de los trozos?';
export const observationQuestionCases=[
 {id:'size-numerator-local',lessonId:'pizza',text:'He comparado el tamaño de los trozos.',observation:true,contains:'divisiones',shown:false},
 {id:'size-denominator-local',lessonId:'chocolate',text:'Comparé el tamaño de las partes.',observation:true,contains:'cuántas',shown:false},
 {id:'count-denominator-local',lessonId:'chocolate',text:'He contado los trozos.',observation:true,contains:'tamaño',shown:false},
 {id:'size-numerator-echo',lessonId:'juice',text:'Comparé el tamaño de los trozos.',question:echo,observation:true,contains:'divisiones',shown:false},
 {id:'size-denominator-echo',lessonId:'mosaic',text:'Comparé el tamaño de los trozos.',question:echo,observation:true,contains:'cuántas',shown:false},
 {id:'useful-relation-retained',lessonId:'pizza',text:'He comparado el tamaño de los trozos.',question:'¿Cómo relacionas el tamaño de las partes con las cantidades del ejercicio?',shown:true},
 {id:'general-observation-retained',lessonId:'pizza',text:'He mirado las partes.',question:'¿Qué has comparado entre las partes de las cantidades?',shown:true},
 {id:'mixed-contradiction-first',lessonId:'pizza',text:'He comparado el tamaño de los trozos. Más partes dan trozos más grandes.',question:echo,guard:'contradiction',shown:false},
 {id:'support-first',lessonId:'pizza',text:'¿Por qué?',question:echo,guard:'support-request',shown:false},
 {id:'wrong-choice-remains-wrong',lessonId:'pizza',text:'Comparé el tamaño de los trozos.',question:echo,observation:true,contains:'divisiones',shown:false,wrong:true},
];
