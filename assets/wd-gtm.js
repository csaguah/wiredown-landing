/*
 * Google Tag Manager con Consent Mode v2 — Wire Down.
 * Se incluye sin `defer` al principio del <head>, antes de cualquier otro script de medición:
 * fija el consentimiento por defecto (todo denegado), aplica la decisión guardada y recién
 * entonces carga GTM. wd-pixel.js y wd-consent.js usan las funciones globales de este archivo.
 *
 * Decisión guardada: `wd_consent_v2` en localStorage = {analytics: bool, marketing: bool, ts}.
 * Vigencia: 180 días. La clave antigua `wd_consent` ('granted' / 'denied') se migra y se borra.
 */
var WD_GTM_ID = 'GTM-T47WBMN9';
var WD_CONSENT_KEY = 'wd_consent_v2';
var WD_CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// Devuelve {analytics, marketing, ts} o null si no hay una decisión vigente.
function wdGetConsent() {
  try {
    var raw = localStorage.getItem(WD_CONSENT_KEY);
    if (raw) {
      var c = JSON.parse(raw);
      if (c && typeof c.ts === 'number' && Date.now() - c.ts < WD_CONSENT_MAX_AGE) {
        return { analytics: c.analytics === true, marketing: c.marketing === true, ts: c.ts };
      }
      return null; // Vencida o con formato inválido: se vuelve a preguntar.
    }
    // Migración desde `wd_consent`: a quien ya decidió no se le vuelve a preguntar.
    // Se borra la clave antigua para que no reviva cuando venza la nueva.
    var old = localStorage.getItem('wd_consent');
    if (old === 'granted' || old === 'denied') {
      var yes = old === 'granted';
      var migrated = wdSaveConsent(yes, yes);
      localStorage.removeItem('wd_consent');
      return migrated;
    }
  } catch (e) {}
  return null;
}

function wdSaveConsent(analytics, marketing) {
  var c = { analytics: !!analytics, marketing: !!marketing, ts: Date.now() };
  try { localStorage.setItem(WD_CONSENT_KEY, JSON.stringify(c)); } catch (e) {}
  return c;
}

// Traduce la decisión a las señales de Consent Mode v2.
function wdConsentSignals(c) {
  var ads = c.marketing ? 'granted' : 'denied';
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads
  };
}

// Revocación de Analítica: borra las cookies propias de Google Analytics (_ga, _ga_<ID>, _gid).
function wdClearAnalyticsCookies() {
  var host = location.hostname;
  var domains = [host, '.' + host.replace(/^www\./, '')];
  document.cookie.split(';').forEach(function (part) {
    var name = part.split('=')[0].trim();
    if (!/^(_ga|_ga_.+|_gid|_gat.*)$/.test(name)) return;
    domains.forEach(function (domain) {
      document.cookie = name + '=; Max-Age=0; path=/; domain=' + domain;
    });
    document.cookie = name + '=; Max-Age=0; path=/';
  });
}

gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
gtag('set', 'url_passthrough', true);
gtag('set', 'ads_data_redaction', true);

(function () {
  var saved = wdGetConsent();
  if (saved) gtag('consent', 'update', wdConsentSignals(saved));
})();

// Google Tag Manager
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',WD_GTM_ID);
