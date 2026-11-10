/*
 * Rebook Engine — SMS helper.
 * Reads the phone number and message from the URL FRAGMENT (#to=…&body=…).
 * The fragment never leaves the browser: it is not sent to the server, there
 * are no analytics, cookies, storage or network requests on this page.
 */
(function (root) {
  'use strict';

  /** "#to=13125550147&body=Hi%20there" -> { to: "13125550147", body: "Hi there" } */
  function parseFragment(hash) {
    var out = { to: '', body: '' };
    var s = String(hash || '').replace(/^#/, '');
    if (!s) return out;
    s.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) return;
      var k = pair.slice(0, i), v = pair.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) { return; }
      if (k === 'to') out.to = v.replace(/\D/g, '');
      if (k === 'body') out.body = v;
    });
    return out;
  }

  function isApple(ua) {
    // iPhone/iPad, iPadOS 13+ (reports a Mac user agent) and macOS Messages all use the "&body=" form.
    return /iPhone|iPad|iPod|Macintosh/.test(ua);
  }

  /** iOS/macOS want "sms:+1…&body=…", Android wants "sms:+1…?body=…". */
  function smsHref(to, body, ua) {
    var num = to ? '+' + to : '';
    if (!body) return 'sms:' + num;
    var sep = isApple(ua) ? '&' : '?';
    return 'sms:' + num + sep + 'body=' + encodeURIComponent(body);
  }

  /** "13125550147" -> "+1 (312) 555-0147" */
  function prettyPhone(to) {
    if (/^1\d{10}$/.test(to)) return '+1 (' + to.slice(1, 4) + ') ' + to.slice(4, 7) + '-' + to.slice(7);
    return to ? '+' + to : '';
  }

  var api = { parseFragment: parseFragment, smsHref: smsHref, prettyPhone: prettyPhone, isApple: isApple };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RebookSms = api;

  /* ---------- page ---------- */
  var T = {
    en: { title: 'Opening Messages…', open: 'Open Messages', copyMsg: 'Copy message', copyNum: 'Copy number',
      copied: 'Copied ✓', to: 'To', msg: 'Message', help: "If Messages didn't open, copy the number and the message and paste them in your texting app.",
      missing: 'This link is missing the phone number or the message. Go back to your spreadsheet and tap SMS again.',
      privacy: 'Private: the number and message stay on this device. Nothing is sent to any server.' },
    es: { title: 'Abriendo Mensajes…', open: 'Abrir Mensajes', copyMsg: 'Copiar mensaje', copyNum: 'Copiar número',
      copied: 'Copiado ✓', to: 'Para', msg: 'Mensaje', help: 'Si no se abrió Mensajes, copia el número y el mensaje y pégalos en tu app de mensajes.',
      missing: 'A este enlace le falta el número o el mensaje. Vuelve a tu hoja de cálculo y toca SMS otra vez.',
      privacy: 'Privado: el número y el mensaje se quedan en este dispositivo. No se envía nada a ningún servidor.' }
  };

  function copy(text, btn, label, done) {
    function ok() { btn.textContent = done; setTimeout(function () { btn.textContent = label; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      try { document.execCommand('copy'); ok(); } catch (e) { /* user can still select the text */ }
      document.body.removeChild(ta);
    }
  }

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    var lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
    var t = T[lang];
    document.documentElement.lang = lang;
    var data = parseFragment(location.hash);
    // Drop the fragment from the address bar/history: the message isn't kept anywhere.
    if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname);

    $('lbl-to').textContent = t.to;
    $('lbl-msg').textContent = t.msg;
    $('help').textContent = t.help;
    $('privacy').textContent = t.privacy;

    if (!data.to && !data.body) {
      $('title').textContent = t.missing;
      $('card').hidden = true;
      return;
    }
    $('title').textContent = t.title;
    $('to').textContent = prettyPhone(data.to);
    $('msg').textContent = data.body;

    var href = smsHref(data.to, data.body, navigator.userAgent);
    var open = $('open');
    open.textContent = t.open;
    open.href = href;
    var bm = $('copy-msg'), bn = $('copy-num');
    bm.textContent = t.copyMsg; bn.textContent = t.copyNum;
    bm.addEventListener('click', function () { copy(data.body, bm, t.copyMsg, t.copied); });
    bn.addEventListener('click', function () { copy(prettyPhone(data.to), bn, t.copyNum, t.copied); });

    // Try to jump straight into Messages; the page stays as the fallback.
    setTimeout(function () { location.href = href; }, 150);
  });
})(this);
