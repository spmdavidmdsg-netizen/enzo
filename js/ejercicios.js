/* Rutinas de ejercicio de Enzo.
   Cada rutina tiene bloques: un circuito (vueltas, descanso entre ejercicios y entre vueltas)
   o una serie de corrido. Cada ejercicio va por repeticiones (reps) o por tiempo (seg).
   reg: qué se registra al terminarlo → 'carga' (peso y repeticiones), 'reps' (repeticiones) o nada (solo hecho).
   img: imagen en img/ej/<img>.webp; espejo la voltea para el lado contrario. */

const e = (id, n, m, img, cant, extra = {}) => ({ id, n, m, img, ...(typeof cant === 'number' ? { reps: cant } : { seg: cant.seg }), ...extra });
const seg = s => ({ seg: s });

export const RUTINAS = [
  {
    id: 'exterior', nombre: 'Rutina en exterior', sub: 'Espalda y pecho · barras y cuerda', img: 'pullup-overhand',
    bloques: [
      { titulo: 'Circuito', vueltas: 4, desc: 60, descVuelta: 90, ejercicios: [
        e('dips', 'Bar dips', 'Pecho · tríceps', 'bar-dips', 12, { reg: 'reps', que: 'Entre dos barras paralelas, brazos rectos; bajas doblando los codos y subes.' }),
        e('pull-o', 'Pull ups (overhand)', 'Espalda · bíceps', 'pullup-overhand', 8, { reg: 'reps', que: 'Colgado de la barra, palmas hacia el frente; subes hasta pasar la barbilla.' }),
        e('push', 'Push ups', 'Pecho · tríceps', 'push-ups', 15, { reg: 'reps', que: 'Plancha alta en manos; bajas el pecho al piso y subes.' }),
        e('pull-u', 'Pull ups (underhand)', 'Espalda · bíceps', 'pullup-underhand', 8, { reg: 'reps', que: 'Colgado con las palmas hacia ti; subes hasta pasar la barbilla.' })
      ] },
      { titulo: 'Al final', descAntes: 90, ejercicios: [
        e('cuerda', 'Jump rope', 'Cardio · pantorrillas', 'jump-rope', seg(900), { que: 'Saltos continuos con la cuerda.' })
      ] }
    ]
  },
  {
    id: 'interior', nombre: 'Rutina en interior', sub: 'Abdomen, luego circuito de mancuernas', img: 'crossover-crunch',
    bloques: [
      { titulo: 'Abdomen', desc: 30, ejercicios: [
        e('a1', 'Heel touch', 'Oblicuos', 'heel-touch', 26, { que: 'Boca arriba, rodillas dobladas; hombros arriba y tocas un talón y luego el otro.' }),
        e('a2', 'Crossover crunch', 'Oblicuos', 'crossover-crunch', 26, { que: 'Boca arriba, llevas el codo hacia la rodilla contraria, alternando.' }),
        e('a3', 'Mountain climber', 'Abdomen · cardio', 'mountain-climber', 20, { que: 'Plancha alta; llevas una rodilla al pecho y luego la otra, rápido.' }),
        e('a4', 'Side bridges left', 'Oblicuos', 'side-bridges', 12, { espejo: true, que: 'De lado sobre el antebrazo izquierdo; subes y bajas la cadera.' }),
        e('a5', 'Side bridges right', 'Oblicuos', 'side-bridges', 12, { que: 'De lado sobre el antebrazo derecho; subes y bajas la cadera.' }),
        e('a6', 'Butt bridge', 'Glúteos · lumbares', 'butt-bridge', 20, { que: 'Boca arriba, rodillas dobladas; subes la cadera y bajas.' }),
        e('a7', 'Bicycle crunches', 'Abdomen · oblicuos', 'bicycle-crunches', 20, { que: 'Piernas arriba; codo a la rodilla contraria mientras estiras la otra pierna.' }),
        e('a8', 'V-up', 'Abdomen', 'v-up', 20, { que: 'Acostado y estirado; subes piernas y torso a la vez formando una V.' }),
        e('a9', 'Heel touch', 'Oblicuos', 'heel-touch', 26, { que: 'Boca arriba, rodillas dobladas; hombros arriba y tocas un talón y luego el otro.' }),
        e('a10', 'Abdominal crunches', 'Abdomen', 'abdominal-crunches', 26, { que: 'Boca arriba, rodillas dobladas, brazos cruzados; subes los hombros.' }),
        e('a11', 'Plank', 'Abdomen · core', 'plank', seg(60), { que: 'Sostienes sobre los antebrazos con el cuerpo recto.' }),
        e('a12', 'Crossover crunch', 'Oblicuos', 'crossover-crunch', 26, { que: 'Boca arriba, llevas el codo hacia la rodilla contraria, alternando.' }),
        e('a13', 'Leg raises', 'Abdomen bajo', 'leg-raises', 26, { que: 'Boca arriba; subes las piernas rectas a 90° y bajas sin tocar el piso.' }),
        e('a14', 'Bicycle crunches', 'Abdomen · oblicuos', 'bicycle-crunches', 20, { que: 'Piernas arriba; codo a la rodilla contraria mientras estiras la otra pierna.' }),
        e('a15', 'Side plank right', 'Oblicuos', 'side-plank', seg(50), { que: 'Sostienes de lado sobre el antebrazo derecho.' }),
        e('a16', 'Side plank left', 'Oblicuos', 'side-plank', seg(50), { espejo: true, que: 'Sostienes de lado sobre el antebrazo izquierdo.' }),
        e('a17', 'Cobra stretch', 'Estiramiento', 'cobra-stretch', seg(30), { que: 'Boca abajo, empujas con las manos y levantas el pecho; la cadera se queda en el piso.' }),
        e('a18', 'Spine lumbar twist stretch left', 'Estiramiento', 'lumbar-twist', seg(30), { espejo: true, que: 'Boca arriba con los brazos en T; una rodilla cruza al otro lado.' }),
        e('a19', 'Spine lumbar twist stretch right', 'Estiramiento', 'lumbar-twist', seg(30), { que: 'Igual, hacia el otro lado.' })
      ] },
      { titulo: 'Mancuernas', vueltas: 3, descAntes: 90, desc: 60, descVuelta: 90, ejercicios: [
        e('curl', 'Dumbbell curl', 'Bíceps', 'dumbbell-curl', 7, { reg: 'carga', que: 'De pie, palmas al frente; subes la mancuerna doblando el codo.' }),
        e('press', 'Dumbbell shoulder press', 'Hombros', 'shoulder-press', 8, { reg: 'carga', que: 'Mancuernas a la altura de los hombros; empujas hacia arriba.' }),
        e('martillo', 'Dumbbell hammer curl', 'Bíceps · antebrazo', 'hammer-curl', 7, { reg: 'carga', que: 'Como el curl, pero con las palmas hacia ti.' }),
        e('lateral', 'Dumbbell lateral raise', 'Hombros', 'lateral-raise', 6, { reg: 'carga', que: 'Brazos a los lados; subes hasta la altura del hombro.' })
      ] }
    ]
  },
  {
    id: 'piernas', nombre: 'Rutina de piernas', sub: 'Cuádriceps y pantorrillas', img: null,
    bloques: [
      { titulo: 'Circuito', vueltas: 3, desc: 60, descVuelta: 90, ejercicios: [
        e('bss-l', 'Bulgarian split squat left', 'Cuádriceps · glúteos', null, 10, { reg: 'reps', que: 'Pie de atrás sobre una banca o silla; bajas con la pierna izquierda al frente hasta que la rodilla de atrás casi toque el piso.' }),
        e('bss-r', 'Bulgarian split squat right', 'Cuádriceps · glúteos', null, 10, { reg: 'reps', que: 'Igual, con la pierna derecha al frente.' }),
        e('stepup', 'Step-ups', 'Cuádriceps', null, 12, { reg: 'reps', que: 'Subes a una banca o escalón con una pierna, alternando.' }),
        e('wallsit', 'Wall sit', 'Cuádriceps', null, seg(45), { que: 'Espalda contra la pared, rodillas a 90°; sostienes.' }),
        e('calf-l', 'Single-leg calf raise left', 'Pantorrilla', null, 15, { reg: 'reps', que: 'De pie sobre la pierna izquierda en el borde de un escalón; subes de puntas y bajas despacio.' }),
        e('calf-r', 'Single-leg calf raise right', 'Pantorrilla', null, 15, { reg: 'reps', que: 'Igual, sobre la pierna derecha.' }),
        e('tibial', 'Tibialis raise', 'Tibial', null, 20, { reg: 'reps', que: 'Espalda contra la pared, talones al frente; subes las puntas de los pies y bajas.' })
      ] }
    ]
  }
];

export const rutina = id => RUTINAS.find(r => r.id === id);
export const ejerciciosDe = r => r.bloques.reduce((n, b) => n + b.ejercicios.length, 0);
export const imgDe = k => `img/ej/${k}.webp`;

/* La rutina como lista de pasos: ejercicios y descansos en orden. */
export function pasos(r) {
  const out = [];
  r.bloques.forEach((b, bi) => {
    const nv = b.vueltas || 1;
    if (bi > 0 && b.descAntes) out.push({ t: 'desc', seg: b.descAntes });
    for (let v = 1; v <= nv; v++) {
      b.ejercicios.forEach((x, xi) => {
        out.push({ t: 'ej', e: x, b: bi, v, nv });
        if (xi < b.ejercicios.length - 1) { if (b.desc) out.push({ t: 'desc', seg: b.desc }); }
        else if (v < nv) out.push({ t: 'desc', seg: b.descVuelta || b.desc || 60, vuelta: true });
      });
    }
  });
  return out;
}

/* Minutos aproximados: 3 s por repetición (mínimo 30 s) más los descansos. */
export function estimado(r) {
  const s = pasos(r).reduce((t, p) => t + (p.t === 'desc' ? p.seg : p.e.seg || Math.max(30, p.e.reps * 3)), 0);
  return Math.round(s / 60 / 5) * 5 || 5;
}

export const cantidad = x => x.seg ? mmss(x.seg) : '×' + x.reps;
export function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
