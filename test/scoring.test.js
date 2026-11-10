// Ejecutar desde la raíz del repo con: node --test test/scoring.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('./test-data.js');
const S = require('./scoring.js');

// Respuestas a partir de un mapa parcial; las demás quedan en 0.
function answers(partial = {}) {
  const a = {};
  data.questions.forEach(q => { a[q.id] = 0; });
  return Object.assign(a, partial);
}

// Construye respuestas que suman exactamente `score` (llenando de 3 en 3).
function answersWithScore(score) {
  const a = answers();
  let left = score;
  for (const q of data.questions) {
    const v = Math.min(3, left);
    a[q.id] = v;
    left -= v;
  }
  assert.equal(left, 0);
  return a;
}

const Q = { hiper: [1, 4, 7], colapso: [5, 8, 9], tension: [2, 6, 10], neutra: 3 };
const ids = res => S.getProfiles(data, res);

test('el puntaje suma de 0 a 30', () => {
  assert.equal(S.totalScore(data, answers()), 0);
  const all3 = answers();
  Object.keys(all3).forEach(k => { all3[k] = 3; });
  assert.equal(S.totalScore(data, all3), 30);
});

test('límites de rango', () => {
  const cases = [
    [0, 'regulado'], [8, 'regulado'],
    [9, 'moderada'], [16, 'moderada'],
    [17, 'significativa'], [24, 'significativa'],
    [25, 'severa'], [30, 'severa']
  ];
  for (const [score, expected] of cases) {
    assert.equal(S.getRange(data, score).id, expected, `puntaje ${score}`);
    assert.equal(S.evaluate(data, answersWithScore(score)).range.id, expected, `evaluate ${score}`);
  }
});

test('puntaje fuera de rango lanza error', () => {
  assert.throws(() => S.getRange(data, 31), RangeError);
  assert.throws(() => S.getRange(data, -1), RangeError);
});

test('perfil Hiperalerta', () => {
  assert.deepEqual(ids(answers({ 1: 2, 4: 3, 2: 2 })), ['hiperalerta']);
});

test('perfil Colapso / Desconexión', () => {
  assert.deepEqual(ids(answers({ 5: 3, 8: 2, 9: 2, 1: 3 })), ['colapso']);
});

test('perfil Tensión física', () => {
  assert.deepEqual(ids(answers({ 2: 2, 6: 2, 10: 3, 5: 2 })), ['tension']);
});

test('empate de dos perfiles', () => {
  assert.deepEqual(ids(answers({ 1: 2, 4: 2, 2: 3, 6: 3, 5: 2 })), ['hiperalerta', 'tension']);
});

test('empate triple', () => {
  assert.deepEqual(ids(answers({ 1: 2, 5: 2, 2: 2 })), ['hiperalerta', 'colapso', 'tension']);
  const all3 = answers();
  Object.keys(all3).forEach(k => { all3[k] = 3; });
  assert.deepEqual(ids(all3), ['hiperalerta', 'colapso', 'tension']);
});

test('todas < 2 y puntaje 0–8 → Regulado', () => {
  assert.deepEqual(ids(answers()), ['regulado']);                                // 0 puntos
  assert.deepEqual(ids(answers({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 })), ['regulado']); // 8 puntos
});

test('todas < 2 y puntaje 9 o más → Sin un perfil que destaque', () => {
  const nine = answers({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }); // 9 puntos
  assert.deepEqual(ids(nine), ['sinPerfil']);

  const allOnes = answers();                                                       // todo «A veces» = 10
  Object.keys(allOnes).forEach(k => { allOnes[k] = 1; });
  const r = S.evaluate(data, allOnes);
  assert.equal(r.score, 10);
  assert.equal(r.range.id, 'moderada');
  assert.deepEqual(r.profiles.map(p => p.id), ['sinPerfil']);
  assert.equal(r.profiles[0].name, 'Sin un perfil que destaque');
  assert.equal(r.profiles[0].priority, null);
});

test('Regulado nunca aparece con puntaje de 9 o más', () => {
  // Recorre todas las combinaciones de respuestas 0/1 (todas < 2).
  for (let mask = 0; mask < 1 << 10; mask++) {
    const a = answers();
    data.questions.forEach((q, i) => { a[q.id] = (mask >> i) & 1; });
    const r = S.evaluate(data, a);
    assert.equal(r.profiles[0].id, r.score <= 8 ? 'regulado' : 'sinPerfil', `puntaje ${r.score}`);
  }
});

test('la pregunta 3 no cuenta para ningún perfil', () => {
  for (const v of [0, 1, 2, 3]) {
    assert.deepEqual(S.profileCounts(data, answers({ 3: v, 1: 2 })), { hiperalerta: 1, tension: 0, colapso: 0 });
  }
});

test('la pregunta 3 suma al puntaje pero no altera el perfil', () => {
  for (const base of [answers(), answers({ 1: 2 }), answers({ 1: 2, 5: 2 }), answers({ 6: 3, 9: 3 })]) {
    const before = S.evaluate(data, Object.assign({}, base, { [Q.neutra]: 0 }));
    for (const v of [1, 2, 3]) {
      const after = S.evaluate(data, Object.assign({}, base, { [Q.neutra]: v }));
      assert.deepEqual(after.profiles, before.profiles);
      assert.equal(after.score, before.score + v);
    }
  }
  // Solo la pregunta 3 alta: sigue siendo Regulado.
  assert.deepEqual(ids(answers({ 3: 3 })), ['regulado']);
});

test('ninguna pregunta de perfil queda fuera de los tres grupos', () => {
  const grouped = [...Q.hiper, ...Q.colapso, ...Q.tension].sort((a, b) => a - b);
  const fromData = data.questions.filter(q => q.profile).map(q => q.id);
  assert.deepEqual(fromData, grouped);
});
