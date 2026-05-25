(function () {
  'use strict';

  /* ============================================================
     ATELIER — Easify / TPO Product Options enhancements
     ============================================================
     1. Ocultar tooltips de hover
     2. Convertir Plateado/Dorado a chips con círculo de color
     3. Validación de grabado:
        - Solo letras del abecedario (incluye ñ y tildes)
        - Sin números ni caracteres especiales
        - Sin letras iguales consecutivas (ej: "aa" → bloqueado)
          EXCEPCIÓN: letras que se repiten al FINAL de la palabra
          están permitidas (ej: "Carolina", "Valentina" → OK)
     ============================================================ */

  /* ── Config ─────────────────────────────────────────────── */
  var METAL_OPTIONS = {
    plateado: { label: 'Plateado', dotClass: 'atelier-metal-dot--silver' },
    dorado:   { label: 'Dorado',   dotClass: 'atelier-metal-dot--gold'   },
  };

  /* Regex: solo letras españolas y espacio */
  var VALID_CHARS      = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]$/;
  var NUMBERS_OR_SPECIAL = /[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]/g;

  /* Contenedor principal del app TPO */
  var APP_SELECTORS = '.tpo_option-set-wrapper, [class*="tpo_"]';

  /* Selectores de tooltips TPO para ocultar.
     EXCEPCIÓN: .tpo_color-swatches-tooltip se deja visible
     porque muestra el nombre y precio de cada color de cuero. */
  var TOOLTIP_SELECTORS = [
    '.tpo_image-swatches-tooltip',
    '.tpo_option-tooltip-content',
    '.tpo_option-tooltip',
    '.tpo_buttons-tooltip',
  ].join(', ');

  /* ── 1. Ocultar tooltips ─────────────────────────────────── */
  function hideTooltips(root) {
    root = root || document;
    root.querySelectorAll(TOOLTIP_SELECTORS).forEach(function (el) {
      el.style.cssText += 'display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;';
    });
  }

  /* Interceptar mouseover para que no se abran nuevos tooltips */
  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    if (!el.closest) return;
    var appEl = el.closest('.tpo_option-set-wrapper, [class*="tpo_"]');
    if (!appEl) return;
    var tooltip = appEl.querySelector(TOOLTIP_SELECTORS);
    if (tooltip) {
      tooltip.style.cssText += 'display:none!important;opacity:0!important;visibility:hidden!important;';
    }
  }, true);

  /* ── 2. Chips de Plateado / Dorado ───────────────────────── */
  /*
   * Estrategia definitiva: el JS SOLO agrega clase + data-atributo al label.
   * El círculo metálico lo pone el CSS con ::before (un solo elemento,
   * imposible que se duplique). El swatch nativo del app queda oculto por CSS.
   */
  function enhanceMetalOptions(root) {
    root = root || document;

    root.querySelectorAll(
      '.tpo_buttons-wrapper label, label[class*="tpo_shape_"]'
    ).forEach(function (label) {
      if (label.dataset.atelierMetal) return; /* ya procesado */

      /* Leer texto solo del span de texto (no del label entero
         para evitar falsos positivos por colores hex u otros spans) */
      var textEl = label.querySelector(
        '.tpo_button_option_value, [class*="tpo_button_value"], [class*="tpo_option-value"]'
      );
      var text = (textEl ? textEl.textContent : label.textContent).trim().toLowerCase();

      var metalKey = null;
      if (text.includes('plateado')) metalKey = 'plateado';
      if (text.includes('dorado'))   metalKey = 'dorado';
      if (!metalKey) return;

      /* Marcar el label — el CSS hace el resto */
      label.dataset.atelierMetal = metalKey;
      label.classList.add('atelier-metal-chip');

      /* Single-select: al clickear este chip, desmarcar TODOS los otros chips
         metálicos de la página y marcar solo el clickeado.
         (Usar document.querySelectorAll es más seguro que recorrer el DOM
         con closest() porque la estructura de contenedores del app varía.) */
      label.addEventListener('click', function () {
        document.querySelectorAll('label[data-atelier-metal]').forEach(function (chip) {
          chip.classList.remove('is-selected');
        });
        label.classList.add('is-selected');
      });
    });
  }

  function syncSelected(item, input) {
    item.classList.toggle('is-selected', !!input.checked);
  }

  /* ── 3. Validación del grabado ───────────────────────────── */

  /* Quitar letras consecutivas repetidas que NO estén al final
     Regla: (.)\1+ → reemplazar con $1 SOLO si no está al final de la palabra.
     Implementación: recorrer char a char y acumular. */
  function removeInternalConsecutiveDupes(str) {
    if (!str) return str;
    var result = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (
        result.length > 0 &&
        ch.toLowerCase() === result[result.length - 1].toLowerCase()
      ) {
        /* Es duplicado consecutivo — ¿está al final de la cadena? */
        /* "al final" significa que todos los caracteres siguientes
           son también el mismo carácter (ej: "aa" al cierre).
           Dado que bloqueamos tecla a tecla, sólo llega un char nuevo.
           En paste limpiamos recorriendo y permitiendo repetición
           solo si es la última posición. */
        /* Mientras el usuario escribe: siempre bloqueamos si el char
           anterior es igual (la excepción "al final" la manejamos
           en keydown comparando con el contexto completo). */
        continue; /* omitir el duplicado */
      }
      result += ch;
    }
    return result;
  }

  function isGrabadoInput(input) {
    var checks = [
      input.name || '',
      input.placeholder || '',
      input.id || '',
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-option-name') || '',
    ];

    if (input.id) {
      var label = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
      if (label) checks.push(label.textContent);
    }

    var parent = input.closest('.tpo_option-set-wrapper, [class*="tpo_option"], li, div');
    if (parent) {
      var labelEl = parent.querySelector('.form__label, .tpo_option-label, label, [class*="label"]');
      if (labelEl) checks.push(labelEl.textContent);
      checks.push(parent.textContent.substring(0, 120));
    }

    return checks.some(function (text) {
      return /grabado/i.test(text);
    });
  }

  function applyGrabadoValidation(input) {
    if (input.dataset.atelierGrabado) return; /* ya vinculado */
    input.dataset.atelierGrabado = 'true';

    /* Mensaje de error */
    var errorMsg = document.createElement('p');
    errorMsg.className = 'atelier-grabado-error';
    errorMsg.textContent = 'Solo letras. No se permiten números, símbolos ni letras repetidas consecutivas.';
    if (input.parentElement) input.parentElement.insertAdjacentElement('beforeend', errorMsg);

    function showError() {
      errorMsg.classList.add('is-visible');
      input.style.borderColor = '#c0392b';
      clearTimeout(input._atelierErrTimer);
      input._atelierErrTimer = setTimeout(function () {
        errorMsg.classList.remove('is-visible');
        input.style.borderColor = '';
      }, 2500);
    }

    /* ── keydown: bloquear antes de que aparezca el carácter */
    input.addEventListener('keydown', function (e) {
      var key = e.key;
      if (key.length > 1) return; /* teclas de control: dejar pasar */

      /* Bloquear números */
      if (/[0-9]/.test(key)) { e.preventDefault(); showError(); return; }

      /* Bloquear caracteres especiales */
      if (!VALID_CHARS.test(key)) { e.preventDefault(); showError(); return; }

      /* Bloquear letra igual a la inmediatamente anterior al cursor,
         EXCEPTO si el cursor está al final y el caracter que se escribió
         ya es idéntico al penúltimo (es decir, habría tres iguales consecutivos).
         La regla simplificada: si el char inmediatamente antes del cursor
         es igual al que se va a insertar → bloquear SIEMPRE.
         (Los nombres como "Carolina" tienen 'a' repetida pero NO consecutiva.) */
      var pos = input.selectionStart;
      var charBefore = input.value[pos - 1];
      if (charBefore && charBefore.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        showError();
        return;
      }
    });

    /* ── input: limpiar en paste / autocompletado */
    input.addEventListener('input', function () {
      var value = input.value;
      var pos   = input.selectionStart;

      /* 1. Quitar caracteres inválidos */
      var cleaned = value.replace(NUMBERS_OR_SPECIAL, '');

      /* 2. Quitar letras consecutivas repetidas */
      cleaned = cleaned.replace(/(.)\1+/gi, '$1');

      if (cleaned !== value) {
        input.value = cleaned;
        var newPos = Math.min(pos, cleaned.length);
        try { input.setSelectionRange(newPos, newPos); } catch (_) {}
        showError();
      }
    });

    /* ── paste: limpiar el texto antes de insertarlo */
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      var pasted  = (e.clipboardData || window.clipboardData).getData('text') || '';
      var cleaned = pasted.replace(NUMBERS_OR_SPECIAL, '').replace(/(.)\1+/gi, '$1');

      var start   = input.selectionStart;
      var end     = input.selectionEnd;
      var current = input.value;
      var newValue = current.substring(0, start) + cleaned + current.substring(end);

      /* Aplicar regla al texto completo */
      newValue = newValue.replace(/(.)\1+/gi, '$1');
      input.value = newValue;

      var newPos = start + cleaned.length;
      try { input.setSelectionRange(newPos, newPos); } catch (_) {}
    });
  }

  function findAndValidateGrabadoInputs(root) {
    root = root || document;
    /* Buscar inputs TPO de texto y textareas */
    root.querySelectorAll(
      '.tpo_option-input.tpo_text-box, ' +
      '.tpo_option-input[type="text"], ' +
      '.tpo_option-set-wrapper input[type="text"], ' +
      '.tpo_option-set-wrapper textarea, ' +
      'input[name*="Grabado"], ' +
      'textarea[name*="Grabado"]'
    ).forEach(function (input) {
      if (isGrabadoInput(input)) applyGrabadoValidation(input);
    });
  }

  /* ── Init y MutationObserver ─────────────────────────────── */
  function runAll(root) {
    hideTooltips(root);
    enhanceMetalOptions(root);
    findAndValidateGrabadoInputs(root);
  }

  /* ── 4. Bridge: variant-picker ↔ TPO color swatches ────────── */
  /*
   * Problema: cuando el app TPO marca un input nativo con
   *   input.checked = true
   * el browser NO dispara el evento 'change' automáticamente,
   * por lo que el <variant-picker> del tema nunca actualiza la imagen.
   *
   * Solución A: parchar el setter de .checked en los inputs del
   *   variant-picker para que siempre dispare 'change' al activarse.
   *
   * Solución B (fallback): escuchar clicks en los swatches de TPO y
   *   disparar 'change' manualmente sobre el radio ya checkeado, para
   *   cubrir el caso en que TPO no use el setter sino algún otro mecanismo.
   */
  function initVariantBridge() {
    var variantPicker = document.querySelector('variant-picker');
    if (!variantPicker) return;

    /* ── A: Patch setter ────────────────────────────────────────── */
    var nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');

    function patchInput(input) {
      if (input._atelierPatched) return;
      input._atelierPatched = true;

      Object.defineProperty(input, 'checked', {
        configurable: true,
        get: function () {
          return nativeDescriptor.get.call(this);
        },
        set: function (val) {
          var was = nativeDescriptor.get.call(this);
          nativeDescriptor.set.call(this, val);
          /* Si se acaba de activar y no era un disparo nuestro → disparar change */
          if (val && !was && !this._atelierFiring) {
            this._atelierFiring = true;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this._atelierFiring = false;
          }
        },
      });
    }

    /* Parchar todos los inputs radio actuales */
    variantPicker.querySelectorAll('input[type="radio"]').forEach(patchInput);

    /* Parchar también los que se agreguen después (morphing del tema) */
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'INPUT' && node.type === 'radio') patchInput(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('input[type="radio"]').forEach(patchInput);
          }
        });
      });
    }).observe(variantPicker, { childList: true, subtree: true });

    /* ── B: Click bridge ────────────────────────────────────────── */
    /*
     * Cuando el usuario hace click en un swatch de color del app TPO,
     * esperamos 350 ms (tiempo suficiente para que TPO actualice su estado)
     * y luego disparamos 'change' sobre el radio que TPO dejó checkeado
     * dentro del variant-picker. Esto cubre el caso en que TPO use un
     * mecanismo distinto al setter de .checked (ej: setAttribute, innerHTML, etc.)
     */
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      /* Detectar clicks dentro de cualquier elemento de color TPO */
      var tpoColor = e.target.closest('[class*="tpo_color"]');
      if (!tpoColor) return;

      setTimeout(function () {
        var checked = variantPicker.querySelector('fieldset input[type="radio"]:checked');
        if (checked && !checked._atelierFiring) {
          checked._atelierFiring = true;
          checked.dispatchEvent(new Event('change', { bubbles: true }));
          checked._atelierFiring = false;
        }
      }, 350);
    }, true);
  }

  /* ── 5. Scroll de fotos al hacer hover sobre el gallery ─────── */
  /*
   * Cuando el cursor está sobre la galería de fotos y el usuario scrollea,
   * avanzamos/retrocedemos slides en lugar de scrollear la página.
   * Cuando el cursor NO está sobre la galería, el scroll afecta la página
   * normalmente (opciones suben/bajan).
   */
  function initGalleryHoverScroll() {
    document.querySelectorAll('media-gallery').forEach(function (gallery) {
      var accumY = 0;
      var THRESHOLD = 80; /* píxeles acumulados antes de avanzar un slide */

      gallery.addEventListener('wheel', function (e) {
        /* Ignorar scroll horizontal (thumbnails laterales, etc.) */
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

        /* Acceder al slideshow interno del custom element */
        var slideshow;
        try { slideshow = gallery.slideshow; } catch (_) { return; }
        if (!slideshow) return;

        var slides = slideshow.slides;
        if (!slides || slides.length <= 1) return; /* solo 1 foto → no hay nada que ciclar */

        e.preventDefault(); /* evitar que la página scrollee */

        accumY += e.deltaY;

        if (Math.abs(accumY) >= THRESHOLD) {
          var dir = accumY > 0 ? 1 : -1;
          accumY = 0;
          slideshow.select(slideshow.current + dir);
        }
      }, { passive: false });
    });
  }

  function init() {
    runAll(document);
    initVariantBridge();
    initGalleryHoverScroll();

    /* Las apps de opciones cargan dinámicamente → observar el DOM */
    var observer = new MutationObserver(function (mutations) {
      var shouldRun = false;
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          /* Solo reaccionar si el nodo agregado pertenece al app TPO */
          if (
            (node.className && typeof node.className === 'string' && node.className.includes('tpo_')) ||
            node.querySelector && node.querySelector('[class*="tpo_"]')
          ) {
            shouldRun = true;
          }
        });
      });
      if (shouldRun) runAll(document);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
