/*
 * Aviso de cookies — Wire Down. Requiere wd-pixel.js y el marcado #wd-consent en la página.
 * Guarda 'granted' o 'denied' en `wd_consent`. El enlace #cookie-settings (opcional) reabre el aviso.
 */
(function () {
  var box = document.getElementById('wd-consent');
  if (!box) return;
  function save(x) { try { localStorage.setItem('wd_consent', x); } catch (e) {} box.style.display = 'none'; }
  if (!wdConsent()) box.style.display = 'block';
  document.getElementById('wd-accept').onclick = function () { save('granted'); wdLoadPixel(); };
  document.getElementById('wd-reject').onclick = function () { save('denied'); wdRevokePixel(); };
  var settings = document.getElementById('cookie-settings');
  if (settings) settings.onclick = function (e) { e.preventDefault(); box.style.display = 'block'; };
})();
