/*
 * Meta Pixel — Wire Down. Se carga solo con consentimiento (clave `wd_consent` en localStorage).
 * Se incluye sin `defer` en el <head>: las páginas y wd-consent.js usan estas funciones globales.
 */
var WD_PIXEL_ID = '4406846419603179';

function wdConsent() {
  try { return localStorage.getItem('wd_consent'); } catch (e) { return null; }
}

function wdHasConsent() {
  return wdConsent() === 'granted';
}

function wdLoadPixel() {
  // Si el Pixel ya estaba cargado (aceptar, rechazar y volver a aceptar en la misma visita), se reactiva.
  if (window.fbq) { window.fbq('consent', 'grant'); return; }
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('set', 'autoConfig', false, WD_PIXEL_ID);
  fbq('init', WD_PIXEL_ID);
  fbq('track', 'PageView');
}

// Revocación: el Pixel deja de enviar eventos en esta visita y se borran sus cookies propias.
function wdRevokePixel() {
  if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
  var host = location.hostname;
  ['_fbp', '_fbc'].forEach(function (name) {
    [host, '.' + host.replace(/^www\./, '')].forEach(function (domain) {
      document.cookie = name + '=; Max-Age=0; path=/; domain=' + domain;
    });
    document.cookie = name + '=; Max-Age=0; path=/';
  });
}

if (wdHasConsent()) wdLoadPixel();
