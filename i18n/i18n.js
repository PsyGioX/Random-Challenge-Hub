// ============================================================
// RANDOM CHALLENGE HUB — i18n Engine v1.0
// Supports: EN (primary), RU (base), + community languages
//
// ADDING A NEW LANGUAGE (community guide):
//   1. Copy i18n/en.js → i18n/xx.js  (xx = ISO 639-1 code)
//   2. Fill in _meta block (code, name, nameNative, flag, author, completion)
//   3. Translate every value string (do NOT rename keys)
//   4. Add a <script> tag in index.html / overlay.html loading your file
//      BEFORE i18n.js:  <script src="i18n/xx.js"></script>
//   5. Register the language in RCH_I18N.register() below (or just load the file —
//      auto-detection via window.RCH_TRANSLATIONS will pick it up automatically)
//   6. Open a Pull Request — see README.md § Translation System
// ============================================================

(function (global) {
  'use strict';

  // ── DEFAULTS ────────────────────────────────────────────
  const STORAGE_KEY   = 'rch_language';
  const DEFAULT_LANG  = 'en';   // primary/fallback language
  const SECONDARY     = 'ru';   // second built-in language

  const urlLang = new URLSearchParams(location.search).get('lang');

if(urlLang && RCH_TRANSLATIONS[urlLang]){
    setLanguage(urlLang);
}

  // ── INTERNAL STATE ──────────────────────────────────────
  let _current = DEFAULT_LANG;
  let _translations = {};   // merged from window.RCH_TRANSLATIONS

  // ── CORE API ────────────────────────────────────────────
  const RCH_I18N = {

    /**
     * Initialise the engine.
     * Reads all translation objects injected via window.RCH_TRANSLATIONS,
     * detects the preferred language and applies it to the page.
     */
    init() {
      // Pull in all pre-loaded translations (en.js, ru.js, custom XX.js…)
      _translations = global.RCH_TRANSLATIONS || {};

      // Detect language: stored pref → browser language → default
      const stored   = localStorage.getItem(STORAGE_KEY);
      const browser  = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
      const preferred = stored || (this.has(browser) ? browser : DEFAULT_LANG);

      this.set(preferred, false); // false = don't save again (already stored or default)
      this._buildSwitcher();
    },

    /**
     * Translate a key with optional variable interpolation.
     * @param {string} key   - dot-notation key, e.g. 'tab.games'
     * @param {object} [vars] - { name: 'Alice', n: 3 } → replaces {name}, {n}
     * @returns {string}
     */
    t(key, vars) {
      const dict = _translations[_current] || {};
      const fallback = _translations[DEFAULT_LANG] || {};
      let str = dict[key] ?? fallback[key] ?? key;

      if (vars && typeof str === 'string') {
        str = str.replace(/\{(\w+)\}/g, (_, k) =>
          vars[k] !== undefined ? vars[k] : `{${k}}`
        );
      }
      return str;
    },

    /** Returns the active language code */
    get current() { return _current; },

    /** Check if a language is registered */
    has(code) {
      return !!(_translations[code] && _translations[code]['_meta']);
    },

    /** Get metadata for a language code */
    meta(code) {
      return (_translations[code] || {})['_meta'] || null;
    },

    /** List all registered language codes */
    languages() {
      return Object.keys(_translations).filter(k => !!_translations[k]['_meta']);
    },

    /**
     * Switch the active language, persist preference and re-apply to DOM.
     * @param {string}  code   - ISO 639-1 language code
     * @param {boolean} [save=true]
     */
    set(code, save = true) {
      if (!this.has(code)) {
        console.warn(`[i18n] Language "${code}" not found. Falling back to "${DEFAULT_LANG}".`);
        code = DEFAULT_LANG;
      }
      _current = code;
      if (save) localStorage.setItem(STORAGE_KEY, code);
      document.documentElement.lang = code;
      const meta = this.meta(code);
      if (meta && meta.rtl) {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
      this._applyDOM();
      this._updateSwitcherUI();
      // Notify script.js so it can re-render dynamic tabs
      global.dispatchEvent(new CustomEvent('rch:langchange', { detail: { lang: code } }));
    },


    /**
     * Apply translations to every element carrying a data-i18n attribute.
     *
     * Supported attribute forms:
     *   data-i18n="key"                   → sets element.textContent
     *   data-i18n-html="key"              → sets element.innerHTML (safe for known HTML like <strong>)
     *   data-i18n-placeholder="key"       → sets input placeholder
     *   data-i18n-title="key"             → sets element title attribute
     *   data-i18n-aria-label="key"        → sets aria-label attribute
     */
    _applyDOM() {
      // textContent
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const vars = this._parseVars(el);
        el.textContent = this.t(key, vars);
      });
      // innerHTML (use sparingly — only for trusted/known HTML from translation files)
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const vars = this._parseVars(el);
        el.innerHTML = this.t(key, vars);
      });
      // placeholder
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = this.t(key);
      });
      // title attribute
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = this.t(key);
      });
      // aria-label
      document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        el.setAttribute('aria-label', this.t(key));
      });
    },

    /** Read data-i18n-vars="name:Alice,n:3" into a vars object */
    _parseVars(el) {
      const raw = el.getAttribute('data-i18n-vars');
      if (!raw) return undefined;
      const vars = {};
      raw.split(',').forEach(pair => {
        const [k, ...rest] = pair.split(':');
        if (k) vars[k.trim()] = rest.join(':').trim();
      });
      return vars;
    },

    // ── LANGUAGE SWITCHER UI ──────────────────────────────
    /**
     * Build the floating language switcher widget and inject it into the page.
     * If an element with id="langSwitcher" already exists, use that instead.
     */
    _buildSwitcher() {
      if (document.getElementById('rchLangSwitcher')) return; // already built

      const langs = this.languages();
      if (langs.length < 2) return; // nothing to switch

      const container = document.createElement('div');
      container.id = 'rchLangSwitcher';
      container.className = 'rch-lang-switcher';
      container.setAttribute('aria-label', 'Language switcher');

      langs.forEach(code => {
        const m = this.meta(code);
        const btn = document.createElement('button');
        btn.className = 'rch-lang-btn' + (code === _current ? ' active' : '');
        btn.dataset.lang = code;
        btn.title = m.nameNative || m.name;
        btn.textContent = m.flag || code.toUpperCase();
        btn.setAttribute('aria-label', `Switch to ${m.name}`);
        btn.addEventListener('click', () => RCH_I18N.set(code));
        container.appendChild(btn);
      });

      document.body.appendChild(container);
      this._injectSwitcherStyles();
    },

    _updateSwitcherUI() {
      document.querySelectorAll('.rch-lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === _current);
      });
    },

    _injectSwitcherStyles() {
      if (document.getElementById('rchLangSwitcherStyles')) return;
      const s = document.createElement('style');
      s.id = 'rchLangSwitcherStyles';
      s.textContent = `
        .rch-lang-switcher {
          position: fixed;
          bottom: 80px;
          right: 20px;
          z-index: 9998;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
        }
        .rch-lang-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(99,102,241,0.35);
          background: rgb(23, 0, 67);
          color: #fff;
          backdrop-filter: blur(10px);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          padding: 0;
        }
        .rch-lang-btn:hover {
          transform: scale(1.15);
          border-color: rgba(99,102,241,0.8);
          box-shadow: 0 0 12px rgba(99,102,241,0.4);
        }
        .rch-lang-btn.active {
          border-color: #6366f1;
          box-shadow: 0 0 14px rgba(99,102,241,0.6);
          transform: scale(1.08);
        }
      `;
      document.head.appendChild(s);
    },

    // ── PROGRESS UTILITIES ────────────────────────────────
    /**
     * Calculate translation completeness for a language code.
     * Compares against the base EN keys (excluding _meta).
     * @returns {number} 0–100
     */
    completionOf(code) {
      const m = this.meta(code);
      if (m && typeof m.completion === 'number') return m.completion;

      const base = _translations[DEFAULT_LANG] || {};
      const target = _translations[code] || {};
      const baseKeys = Object.keys(base).filter(k => k !== '_meta');
      if (!baseKeys.length) return 0;
      const translated = baseKeys.filter(k => target[k] !== undefined && target[k] !== base[k]);
      return Math.round((translated.length / baseKeys.length) * 100);
    },

    /**
     * Return a summary object for every registered language.
     * Used by progress.html.
     */
    progressSummary() {
      return this.languages().map(code => {
        const m = this.meta(code);
        return {
          code,
          name:       m ? m.name : code,
          nameNative: m ? m.nameNative : code,
          flag:       m ? m.flag : '',
          author:     m ? (m.author || '—') : '—',
          version:    m ? (m.version || '—') : '—',
          completion: this.completionOf(code),
        };
      });
    },

    // ── COMMUNITY HELPER ─────────────────────────────────
    /**
     * Programmatically register a translation object at runtime.
     * Useful for community scripts loaded after i18n.js:
     *
     *   RCH_I18N.register({ _meta: { code:'de', name:'German', ... }, 'tab.games': 'Spiele', ... });
     */
    register(translationObj) {
      const code = translationObj['_meta'] && translationObj['_meta'].code;
      if (!code) { console.error('[i18n] register() requires _meta.code'); return; }
      _translations[code] = translationObj;
      // Re-build switcher if new language added after init
      const existing = document.querySelector(`.rch-lang-btn[data-lang="${code}"]`);
      if (!existing) {
        const m = translationObj['_meta'];
        const btn = document.createElement('button');
        btn.className = 'rch-lang-btn';
        btn.dataset.lang = code;
        btn.title = m.nameNative || m.name;
        btn.textContent = m.flag || code.toUpperCase();
        btn.addEventListener('click', () => RCH_I18N.set(code));
        const sw = document.getElementById('rchLangSwitcher');
        if (sw) sw.appendChild(btn);
      }
      console.info(`[i18n] Language "${code}" (${translationObj['_meta'].name}) registered.`);
    },
  };

  // ── EXPOSE GLOBALS ──────────────────────────────────────
  global.RCH_I18N = RCH_I18N;

  /** Shorthand translate function — use as t('key') or t('key', { n: 3 }) */
  global.t = function (key, vars) { return RCH_I18N.t(key, vars); };

  // Auto-init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RCH_I18N.init());
  } else {
    RCH_I18N.init();
  }

}(window));
