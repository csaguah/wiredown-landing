/*
 * Aviso de cookies — Wire Down. Requiere wd-gtm.js y wd-pixel.js en el <head> y el marcado
 * #wd-consent en la página. Tres opciones: Aceptar todo, Rechazar todo y Personalizar
 * (Analítica y Marketing por separado). Guarda la decisión en `wd_consent_v2` (ver wd-gtm.js).
 * window.wdOpenConsent() reabre el aviso; el enlace #cookie-settings (opcional) la usa.
 */
(function () {
  var box = document.getElementById('wd-consent');
  if (!box) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('wd-consent-panel'), mainBtns = $('wd-consent-main'), saveBtns = $('wd-consent-save-row');
  var customize = $('wd-customize'), optAnalytics = $('wd-opt-analytics'), optMarketing = $('wd-opt-marketing');

  function setPanel(open) {
    panel.hidden = !open;
    saveBtns.hidden = !open;
    mainBtns.hidden = open;
    $('wd-customize-wrap').hidden = open;
  }

  function open() {
    var c = wdGetConsent();
    optAnalytics.checked = !!(c && c.analytics);
    optMarketing.checked = !!(c && c.marketing);
    setPanel(false);
    box.style.display = 'block';
  }

  function decide(analytics, marketing) {
    var c = wdSaveConsent(analytics, marketing);
    var signals = wdConsentSignals(c);
    gtag('consent', 'update', signals);
    dataLayer.push({
      event: 'consent_update',
      analytics_storage: signals.analytics_storage,
      ad_storage: signals.ad_storage
    });
    if (!c.analytics) wdClearAnalyticsCookies();
    if (c.marketing) wdLoadPixel(); else wdRevokePixel();
    box.style.display = 'none';
  }

  $('wd-accept').onclick = function () { decide(true, true); };
  $('wd-reject').onclick = function () { decide(false, false); };
  $('wd-save').onclick = function () { decide(optAnalytics.checked, optMarketing.checked); };
  customize.onclick = function () { setPanel(true); optAnalytics.focus(); };

  window.wdOpenConsent = open;
  var settings = $('cookie-settings');
  if (settings) settings.onclick = function (e) { e.preventDefault(); open(); };

  // Se muestra en el siguiente frame para no competir con el primer pintado (LCP).
  if (!wdGetConsent()) requestAnimationFrame(open);
})();
