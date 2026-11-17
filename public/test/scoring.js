/*
 * Test orientativo Wire Down — cálculo.
 * Funciones puras: reciben datos y respuestas, devuelven resultados. No tocan el DOM,
 * no guardan nada y no hacen llamadas de red.
 *
 * `answers` es un objeto { [idPregunta]: 0|1|2|3 }.
 */
(function (root) {
  function totalScore(data, answers) {
    return data.questions.reduce(function (sum, q) {
      return sum + (Number(answers[q.id]) || 0);
    }, 0);
  }

  function getRange(data, score) {
    for (var i = 0; i < data.ranges.length; i++) {
      var r = data.ranges[i];
      if (score >= r.min && score <= r.max) return r;
    }
    throw new RangeError('Puntaje fuera de rango: ' + score);
  }

  // Cuenta, por perfil, cuántas de sus preguntas tienen respuesta >= umbral.
  function profileCounts(data, answers) {
    var counts = {};
    data.questions.forEach(function (q) {
      if (!q.profile) return;
      if (!(q.profile in counts)) counts[q.profile] = 0;
      if ((Number(answers[q.id]) || 0) >= data.profileThreshold) counts[q.profile]++;
    });
    return counts;
  }

  // Devuelve los ids de perfil predominantes (varios si hay empate), en el orden de data.profiles.
  function getProfiles(data, answers) {
    var counts = profileCounts(data, answers);
    var max = 0;
    Object.keys(counts).forEach(function (k) { if (counts[k] > max) max = counts[k]; });
    if (max === 0) {
      var rangeId = getRange(data, totalScore(data, answers)).id;
      return [data.fallbackProfileByRange[rangeId] || data.noDominantProfile];
    }
    return Object.keys(data.profiles).filter(function (k) { return counts[k] === max; });
  }

  function evaluate(data, answers) {
    var score = totalScore(data, answers);
    return {
      score: score,
      range: getRange(data, score),
      profiles: getProfiles(data, answers).map(function (id) {
        return Object.assign({ id: id }, data.profiles[id]);
      })
    };
  }

  var api = {
    totalScore: totalScore,
    getRange: getRange,
    profileCounts: profileCounts,
    getProfiles: getProfiles,
    evaluate: evaluate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WD_SCORING = api;
})(typeof window !== 'undefined' ? window : this);
