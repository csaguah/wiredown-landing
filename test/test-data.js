/*
 * Test orientativo Wire Down — datos.
 * Solo contenido: preguntas, rangos de puntaje y perfiles. Sin lógica ni DOM.
 * Funciona como <script> en el navegador (window.WD_TEST_DATA) y con require() en Node.
 */
(function (root) {
  var data = {
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'A veces' },
      { value: 2, label: 'Con frecuencia' },
      { value: 3, label: 'Siempre' }
    ],

    questions: [
      { id: 1, text: '¿Tienes dificultad para relajarte aunque no haya una razón concreta de estrés?', profile: 'hiperalerta' },
      { id: 2, text: '¿Sientes tensión muscular en cuello, mandíbula o espalda sin causa física clara?', profile: 'tension' },
      { id: 3, text: '¿Te despiertas con cansancio aunque hayas dormido 7-8 horas?', profile: null },
      { id: 4, text: '¿Tu mente sigue acelerada cuando intentas descansar o dormir?', profile: 'hiperalerta' },
      { id: 5, text: '¿Sientes fatiga profunda o falta de energía de forma constante?', profile: 'colapso' },
      { id: 6, text: '¿Tienes cambios digestivos frecuentes (hinchazón, colon irritable, acidez)?', profile: 'tension' },
      { id: 7, text: '¿Te sobresaltas fácilmente con ruidos o situaciones inesperadas?', profile: 'hiperalerta' },
      { id: 8, text: '¿Sientes que te desconectas emocionalmente o que «funcionas en piloto automático»?', profile: 'colapso' },
      { id: 9, text: '¿Tienes dificultad para sentir placer, motivación o alegría?', profile: 'colapso' },
      { id: 10, text: '¿El dolor o la tensión corporal aumenta en momentos de estrés emocional?', profile: 'tension' }
    ],

    // Umbral de respuesta para que una pregunta cuente hacia su perfil.
    profileThreshold: 2,

    ranges: [
      {
        id: 'regulado', min: 0, max: 8,
        name: 'Sistema regulado',
        text: 'Tus respuestas sugieren buena flexibilidad: capacidad de activarte y recuperarte con relativa facilidad. Los módulos preventivos de la guía te ayudarán a sostener este estado.',
        recommendation: 'Módulo 7 y Bitácora como hábito preventivo.'
      },
      {
        id: 'moderada', min: 9, max: 16,
        name: 'Desregulación moderada',
        text: 'Tus respuestas sugieren signos de sobrecarga sostenida. Es probable que alternes entre momentos de activación excesiva y cansancio. Es un buen momento para comenzar Wire Down de forma sistemática.',
        recommendation: 'Módulos 1, 3 y 5 primero. Práctica diaria del ritual Wire Down.'
      },
      {
        id: 'significativa', min: 17, max: 24,
        name: 'Desregulación significativa',
        text: 'Tus respuestas sugieren que tu cuerpo lleva tiempo en modo supervivencia. Los síntomas físicos, emocionales y cognitivos pueden ser expresión de esa sobrecarga acumulada. Wire Down propone herramientas simples, graduales y seguras para este estado.',
        recommendation: 'Protocolos breves de crisis del Módulo 6 primero. Luego Módulos 3 y 5.'
      },
      {
        id: 'severa', min: 25, max: 30,
        name: 'Sobrecarga severa',
        text: 'Tus respuestas sugieren un estado de alerta o agotamiento intenso. Es importante que, además de la guía, consideres apoyo profesional. Wire Down puede ser un complemento, pero no un reemplazo.',
        recommendation: 'Consulta con un profesional de salud. Usa a diario los protocolos de crisis del Módulo 6.',
        professionalFirst: true
      }
    ],

    // El orden define el orden de presentación cuando hay empate.
    profiles: {
      hiperalerta: {
        name: 'Hiperalerta',
        text: 'Mente acelerada, hipervigilancia, insomnio, dificultad para relajarte aunque no haya peligro real. Suele reflejar un sistema que se mantiene en alerta por mucho tiempo.',
        priority: 'Módulos 3 y 5. Respiración 5-5-5 y descarga somática.'
      },
      colapso: {
        name: 'Colapso / Desconexión',
        text: 'Fatiga profunda, apatía, desconexión emocional, sensación de funcionar en automático. Suele reflejar un sistema que, tras mucho tiempo en alerta, baja la energía para protegerse.',
        priority: 'Módulo 6. Grounding, movimiento suave y contacto corporal seguro.'
      },
      tension: {
        name: 'Tensión física',
        text: 'El estrés se expresa principalmente en el cuerpo: dolor muscular, contracturas, problemas digestivos. Hay una carga que el cuerpo sostiene en silencio.',
        priority: 'Módulos 2 y 5. DNS, descarga neuromuscular y automasaje.'
      },
      regulado: {
        name: 'Regulado',
        text: 'No marcaste síntomas frecuentes en ningún grupo.',
        priority: 'Módulo 7 y Bitácora para sostener tus hábitos.'
      }
    },

    fallbackProfile: 'regulado'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.WD_TEST_DATA = data;
})(typeof window !== 'undefined' ? window : this);
