/*
 * Protección de los botones de checkout frente al widget de Hotmart — Wire Down.
 *
 * Problema: https://static.hotmart.com/checkout/widget.min.js hace un "health check" con fetch a
 * https://api-checkout-vue.hotmart.com/api/version y, si ese fetch falla, borra del DOM todos los
 * a[href*="hotmart.com"]. Ese host dejó de existir en DNS, así que el fetch falla siempre y los tres
 * botones (#cta-hero, #cta-final y el de .sticky-cta) desaparecían, aunque pay.hotmart.com funciona.
 *
 * Solución: si se quita del DOM un enlace de checkout (.hotmart-fb hacia pay.hotmart.com), se vuelve
 * a insertar el MISMO nodo en el mismo lugar. Los MutationObserver corren antes del siguiente
 * pintado, así que el botón no llega a desaparecer. Al ser el mismo nodo conserva atributos
 * (data-cta-location, href con UTM) y listeners (InitiateCheckout); el widget sigue haciendo el
 * resto: fancybox con iframe en escritorio y navegación directa en móvil (checkoutMode=2).
 * Si Hotmart arregla el health check, este script no hace nada.
 *
 * Se incluye sin `defer` en el <head>, antes de cargar el widget.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root && root.document) api.init(root.document);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function isCheckoutLink(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'A') return false;
    if (!node.classList || !node.classList.contains('hotmart-fb')) return false;
    return /^https:\/\/pay\.hotmart\.com\//.test(node.getAttribute('href') || '');
  }

  // Vuelve a poner un nodo quitado en su lugar, según el registro de la mutación.
  function restore(node, record) {
    if (node.isConnected) return false; // se movió a otra parte, no se toca
    var parent = record.target;
    if (!parent || !parent.isConnected) return false;
    var next = record.nextSibling, prev = record.previousSibling;
    if (next && next.parentNode === parent) parent.insertBefore(node, next);
    else if (prev && prev.parentNode === parent) parent.insertBefore(node, prev.nextSibling);
    else parent.appendChild(node);
    return true;
  }

  function handle(records) {
    var restored = 0;
    records.forEach(function (rec) {
      Array.prototype.forEach.call(rec.removedNodes || [], function (n) {
        if (isCheckoutLink(n) && restore(n, rec)) restored++;
      });
    });
    return restored;
  }

  function init(doc) {
    if (!('MutationObserver' in doc.defaultView)) return;
    new doc.defaultView.MutationObserver(handle).observe(doc.documentElement, { childList: true, subtree: true });
  }

  return { isCheckoutLink: isCheckoutLink, restore: restore, handle: handle, init: init };
});
