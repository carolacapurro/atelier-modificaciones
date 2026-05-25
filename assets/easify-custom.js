(function () {
  'use strict';

  /* ============================================================
     ATELIER — Easify / Globo Product Options enhancements
     ============================================================
     1. Ocultar tooltips de hover
     2. Convertir Plateado/Dorado a chips con círculo de color
     3. Validación de grabado:
        - Solo letras del abecedario (incluye ñ y tildes)
        - Sin números ni caracteres especiales
        - Sin letras iguales consecutivas (ej: "aa" → bloqueado)
     ============================================================ */

  /* ── Config ─────────────────────────────────────────────── */
  var METAL_OPTIONS = {
    plateado: {
      label: 'Plateado',
      dotClass: 'atelier-metal-dot--silver',
    },
    dorado: {
      label: 'Dorado',
      dotClass: 'atelier-metal-dot--gold',
    },
  };

  /* Regex: solo letras españolas y espacio */
  var VALID_CHARS = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]$/;
  var NUMBERS_OR_SPECIAL = /[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]/;

  /* Selectores de contenedores de apps de opciones */
  var APP_SELECTORS = [
    '[class*="easify"]',
    '[class*="globo"]',
    '[class*="gpo-"]',
    '[id*="easify"]',
    '[id*="globo"]',
  ].join(', ');

  /* Selectores de tooltips para ocultar */
  var TOOLTIP_SELECTORS = [
    '[class*="tooltip"]',
    '[class*="tippy"]',
    '[class*="popup"]',
    '[class*="Tooltip"]',
  ].join(', ');

  /* ── 1. Ocultar tooltips ─────────────────────────────────── */
  function hideTooltips(root) {
    root = root || document;
    root.querySelectorAll(TOOLTIP_SELECTORS).forEach(function (el) {
      /* Sólo ocultar si está dentro de un contenedor de app de opciones */
      if (el.closest(APP_SELECTORS)) {
        el.style.cssText += 'display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;';
      }
    });

    /* Tippy.js global (si está en la página) */
    if (window._tippy) {
      try { window._tippy.destroy(); } catch (e) {}
    }
  }

  /* Interceptar mouseover para evitar que se abran nuevos tooltips */
  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    if (!el.closest) return;
    var appEl = el.closest(APP_SELECTORS);
    if (!appEl) return;

    /* Si el elemento o algún hijo tiene tooltip-class, ocultarlo */
    var tooltip = appEl.querySelector(TOOLTIP_SELECTORS);
    if (tooltip) {
      tooltip.style.cssText += 'display:none!important;opacity:0!important;visibility:hidden!important;';
    }
  }, true);

  /* ── 2. Chips de Plateado / Dorado ───────────────────────── */
  function enhanceMetalOptions(root) {
    root = root || document;

    root.querySelectorAll(APP_SELECTORS).forEach(function (container) {
      /* Buscar todos los items/botones de opción dentro del contenedor */
      var items = container.querySelectorAll(
        '[class*="option-item"], [class*="swatch-item"], [class*="option-value"], ' +
        '[class*="item-label"], [class*="radio-item"], [class*="color-item"], ' +
        'label, li, .option-item'
      );

      items.forEach(function (item) {
        if (item.dataset.atelierMetal) return; /* ya procesado */

        var text = item.textContent.trim().toLowerCase();

        var metalKey = null;
        if (text === 'plateado' || text.includes('plateado')) metalKey = 'plateado';
        if (text === 'dorado'   || text.includes('dorado'))   metalKey = 'dorado';

        if (!metalKey) return;

        var config = METAL_OPTIONS[metalKey];
        item.dataset.atelierMetal = metalKey;
        item.classList.add('atelier-metal-chip');

        /* Crear círculo de color */
        var dot = document.createElement('span');
        dot.className = 'atelier-metal-dot ' + config.dotClass;
        dot.setAttribute('aria-hidden', 'true');

        /* Insertar círculo antes del texto */
        item.insertBefore(dot, item.firstChild);

        /* Detectar selección y sincronizar clase is-selected */
        var input = item.querySelector('input[type="radio"], input[type="checkbox"]');
        if (input) {
          syncSelected(item, input);
          input.addEventListener('change', function () {
            /* Desmarcar todos los hermanos con mismo name */
            var name = input.name;
            if (name) {
              document.querySelectorAll('input[name="' + name + '"]').forEach(function (sibling) {
                var siblingItem = sibling.closest('[data-atelier-metal]');
                if (siblingItem) siblingItem.classList.remove('is-selected');
              });
            }
            syncSelected(item, input);
          });
        }

        /* Click en el chip también */
        item.addEventListener('click', function () {
          /* Quitar is-selected de los hermanos metal */
          var parent = item.parentElement;
          if (parent) {
            parent.querySelectorAll('[data-atelier-metal]').forEach(function (sibling) {
              sibling.classList.remove('is-selected');
            });
          }
          item.classList.add('is-selected');
        });
      });
    });
  }

  function syncSelected(item, input) {
    if (input.checked) {
      item.classList.add('is-selected');
    } else {
      item.classList.remove('is-selected');
    }
  }

  /* ── 3. Validación del grabado ───────────────────────────── */
  function isGrabadoInput(input) {
    /* Revisar si el input está relacionado con "grabado" */
    var checks = [
      input.name || '',
      input.placeholder || '',
      input.id || '',
      input.getAttribute('aria-label') || '',
    ];

    /* Revisar label asociada */
    if (input.id) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) checks.push(label.textContent);
    }

    /* Revisar contenedor padre */
    var parent = input.closest('[class*="option"], [class*="field"], [class*="item"], li, div');
    if (parent) {
      var labelEl = parent.querySelector(
        'label, [class*="label"], [class*="title"], [class*="name"], [class*="heading"]'
      );
      if (labelEl) checks.push(labelEl.textContent);

      /* También texto directo del contenedor padre */
      checks.push(parent.textContent.substring(0, 100));
    }

    return checks.some(function (text) {
      return /grabado/i.test(text);
    });
  }

  function applyGrabadoValidation(input) {
    if (input.dataset.atelierGrabado) return; /* ya vinculado */
    input.dataset.atelierGrabado = 'true';

    /* Agregar mensaje de error debajo del input */
    var errorMsg = document.createElement('p');
    errorMsg.className = 'atelier-grabado-error';
    errorMsg.textContent = 'Solo letras. No se permiten números, símbolos ni letras repetidas consecutivas.';
    if (input.parentElement) input.parentElement.insertAdjacentElement('beforeend', errorMsg);

    function showError() {
      errorMsg.classList.add('is-visible');
      input.style.borderColor = '#c0392b';
      clearTimeout(input._errorTimer);
      input._errorTimer = setTimeout(function () {
        errorMsg.classList.remove('is-visible');
        input.style.borderColor = '';
      }, 2500);
    }

    /* ── keydown: prevenir caracteres inválidos antes de que se escriban */
    input.addEventListener('keydown', function (e) {
      var key = e.key;

      /* Dejar pasar teclas de control */
      if (key.length > 1) return; /* Backspace, Delete, ArrowLeft, Tab, etc. */

      /* Bloquear números */
      if (/[0-9]/.test(key)) {
        e.preventDefault();
        showError();
        return;
      }

      /* Bloquear caracteres especiales (permitir letras españolas y espacio) */
      if (!VALID_CHARS.test(key)) {
        e.preventDefault();
        showError();
        return;
      }

      /* Bloquear letra igual a la inmediatamente anterior al cursor */
      var pos = input.selectionStart;
      var currentValue = input.value;
      var charBefore = currentValue[pos - 1];

      if (charBefore && charBefore.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        showError();
        return;
      }
    });

    /* ── input: limpiar en caso de paste o autocompletar ─────── */
    input.addEventListener('input', function () {
      var value = input.value;

      /* Quitar caracteres inválidos */
      var cleaned = value.replace(NUMBERS_OR_SPECIAL, '');

      /* Quitar letras consecutivas repetidas */
      cleaned = cleaned.replace(/(.)\1+/gi, '$1');

      if (cleaned !== value) {
        var pos = input.selectionStart;
        input.value = cleaned;
        /* Restaurar posición del cursor lo más cerca posible */
        try { input.setSelectionRange(pos, pos); } catch (e) {}
        showError();
      }
    });

    /* ── paste: limpiar antes de insertar ────────────────────── */
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      var pasted = (e.clipboardData || window.clipboardData).getData('text') || '';

      /* Limpiar: solo letras, sin consecutivos */
      var cleaned = pasted
        .replace(NUMBERS_OR_SPECIAL, '')
        .replace(/(.)\1+/gi, '$1');

      var start = input.selectionStart;
      var end   = input.selectionEnd;
      var current = input.value;
      var newValue = current.substring(0, start) + cleaned + current.substring(end);

      /* Aplicar también la regla al texto completo resultante */
      newValue = newValue.replace(/(.)\1+/gi, '$1');
      input.value = newValue;

      /* Posicionar cursor */
      var newPos = start + cleaned.length;
      try { input.setSelectionRange(newPos, newPos); } catch (e) {}
    });
  }

  function findAndValidateGrabadoInputs(root) {
    root = root || document;
    root.querySelectorAll('input[type="text"], textarea').forEach(function (input) {
      if (isGrabadoInput(input)) {
        applyGrabadoValidation(input);
      }
    });
  }

  /* ── Init y MutationObserver ─────────────────────────────── */
  function runAll(root) {
    hideTooltips(root);
    enhanceMetalOptions(root);
    findAndValidateGrabadoInputs(root);
  }

  /* Correr en carga inicial */
  function init() {
    runAll(document);

    /* Observar cambios en el DOM (las apps de opciones cargan dinámicamente) */
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return; /* solo elementos */
          runAll(node);
          /* También revisar el nodo en sí mismo */
          if (node.matches && node.matches(APP_SELECTORS)) {
            runAll(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
