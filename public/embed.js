/**
 * LILLE IN LOVE — pont entre la page WordPress et le formulaire.
 *
 * Posé sur in-love.fr/inscription/, ce script :
 *   1. remplace le conteneur par une iframe vers le formulaire ;
 *   2. ajuste sa hauteur au fil des étapes (plus de barre de défilement interne) ;
 *   3. ramène la vue en haut du formulaire à chaque changement d'étape ;
 *   4. conduit la page entière vers le remerciement une fois la candidature
 *      envoyée, si data-lil-merci indique où aller.
 *
 * Rien à installer côté WordPress : un simple bloc HTML suffit.
 */
(function () {
  'use strict';

  // L'adresse de l'application se lit sur la balise <script> elle-même.
  // Mais les extensions de cache de WordPress (LiteSpeed Cache chez Hostinger)
  // peuvent regrouper ou différer les scripts : l'adresse lue deviendrait
  // alors celle du site WordPress. D'où data-lil-app sur le conteneur, qui
  // l'emporte toujours quand il est renseigné.
  var SCRIPT_ORIGIN = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src).origin
    : '';

  function mount(container) {
    if (container.getAttribute('data-lil-ready') === '1') return;
    container.setAttribute('data-lil-ready', '1');

    var ORIGIN = (container.getAttribute('data-lil-app') || SCRIPT_ORIGIN).replace(/\/+$/, '');
    if (!ORIGIN) {
      container.textContent = 'Formulaire indisponible : adresse de l’application introuvable.';
      return;
    }

    // data-lil-form="court" pour le parcours réduit, vide (ou "complet")
    // pour les 16 étapes. Changer ce seul mot suffit à basculer.
    // data-lil-merci : l'adresse vers laquelle emmener TOUTE la page une fois
    // la candidature envoyée. Sans elle, le remerciement s'affiche dans
    // l'iframe — la personne reste sur la page WordPress, ce qui convient
    // aussi, mais l'adresse du navigateur ne change pas.
    var MERCI = (container.getAttribute('data-lil-merci') || '').trim();

    var version = (container.getAttribute('data-lil-form') || '').trim();
    var path = version === 'court' ? '/embed/court' : '/embed';

    var iframe = document.createElement('iframe');
    iframe.src = ORIGIN + path;
    iframe.title = 'Formulaire d’inscription Lille in Love';
    iframe.loading = 'lazy';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.cssText =
      'width:100%;border:0;display:block;background:transparent;' +
      'height:' + (container.getAttribute('data-min-height') || '680') + 'px;' +
      'transition:height 260ms cubic-bezier(.22,1,.36,1);';

    container.appendChild(iframe);

    window.addEventListener('message', function (event) {
      if (event.origin !== ORIGIN) return;
      if (event.source !== iframe.contentWindow) return;

      var data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'lil:height' && typeof data.height === 'number') {
        // Une marge de sécurité évite qu'une ombre ou un focus soit rogné.
        iframe.style.height = Math.max(data.height + 8, 320) + 'px';
      }

      // Candidature envoyée : le pixel de CETTE page est celui que Meta
      // rattache au clic publicitaire, pas celui de l'iframe. On lui passe
      // le même identifiant d'événement, pour que les deux envois soient
      // reconnus comme un seul.
      if (data.type === 'lil:done' && !data.already && typeof window.fbq === 'function') {
        try {
          window.fbq(
            'track',
            'Lead',
            { content_name: 'Candidature Lille in Love' },
            data.id ? { eventID: data.id } : undefined
          );
        } catch (e) {
          /* le suivi ne doit jamais gêner la page */
        }
      }

      // Une fois la conversion envoyée, on emmène la page entière vers le
      // remerciement. Le court délai laisse partir l'événement du pixel
      // avant que le navigateur ne quitte la page.
      if (data.type === 'lil:done' && MERCI) {
        setTimeout(function () {
          try {
            window.top.location.href = MERCI;
          } catch (e) {
            window.location.href = MERCI;
          }
        }, 500);
      }

      if (data.type === 'lil:step') {
        // On ne fait remonter la page que si le haut du formulaire est sorti
        // de l'écran : sinon, on laisse la personne où elle est.
        var box = iframe.getBoundingClientRect();
        if (box.top < 0) {
          window.scrollTo({
            top: window.pageYOffset + box.top - 24,
            behavior: 'smooth',
          });
        }
      }
    });
  }

  function init() {
    var containers = document.querySelectorAll('[data-lil-form]');
    for (var i = 0; i < containers.length; i++) mount(containers[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
