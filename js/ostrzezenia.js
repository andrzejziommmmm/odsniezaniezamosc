/* Ostrzeżenia przed śniegiem: IMGW (powiaty) + MeteoAlarm (Europa) */
(function () {
  var REPO_RAW = 'https://raw.githubusercontent.com/andrzejziommmmm/odsniezaniezamosc/main/data/ostrzezenia.json';
  var LOCAL = '/data/ostrzezenia.json';
  var ZAMOSC = ['0620', '0664'];
  var KOLOR = ['#1a2733', '#f5d547', '#f39222', '#e0402f'];
  var STOP = ['', '1. stopnia', '2. stopnia', '3. stopnia'];
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw r.status; return r.json(); }); }
  function dane() {
    return getJSON(REPO_RAW + '?t=' + Math.floor(Date.now() / 300000)).catch(function () { return getJSON(LOCAL); });
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function odm(n, a, b, c) { var m10 = n % 10, m100 = n % 100; return n + ' ' + (n === 1 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? b : c); }
  function kiedy(iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return iso;
    return d.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  Promise.all([getJSON('/data/mapy.json'), dane().catch(function () { return null; })]).then(function (res) {
    var mapy = res[0], d = res[1] || { pl: [], eu: {}, aktualizacja: null };
    var woj = {}; mapy.pl.labels.forEach(function (l) { woj[l.k] = l.n; });

    // ---------- stan aktualizacji
    $('ost-stan').textContent = d.aktualizacja ? 'Stan na ' + kiedy(d.aktualizacja) : 'Czekam na pierwsze dane z IMGW i MeteoAlarm';

    // ---------- POLSKA
    var poziom = {}, lista = {};
    d.pl.forEach(function (w, i) {
      w.teryt.forEach(function (t) {
        poziom[t] = Math.max(poziom[t] || 0, w.stopien);
        (lista[t] = lista[t] || []).push(i);
      });
    });

    var svg = el('svg', { viewBox: '0 0 ' + mapy.pl.w + ' ' + mapy.pl.h, role: 'img', 'aria-label': 'Mapa ostrzeżeń IMGW przed śniegiem w powiatach' }, $('mapa-pl'));
    var g = el('g', {}, svg);
    var nazwy = {};
    mapy.pl.powiaty.forEach(function (p, i) {
      nazwy[p.t] = p.n;
      var lv = poziom[p.t] || 0;
      var path = el('path', { d: p.d, fill: KOLOR[lv], 'class': 'pow lv' + lv, 'data-t': p.t, tabindex: lv ? 0 : -1 }, g);
      path.style.transitionDelay = (lv ? (i % 40) * 12 : 0) + 'ms';
    });
    el('path', { d: mapy.pl.woj, 'class': 'woj' }, svg);
    var z = mapy.pl.zamosc;
    var mk = el('g', { 'class': 'zam', transform: 'translate(' + z[0] + ' ' + z[1] + ')' }, svg);
    el('circle', { r: 14, 'class': 'zam-ring' }, mk);
    el('circle', { r: 5, 'class': 'zam-dot' }, mk);
    var tx = el('text', { x: -10, y: -14, 'class': 'zam-txt', 'text-anchor': 'end' }, mk); tx.textContent = 'Zamość';
    requestAnimationFrame(function () { svg.classList.add('on'); });

    function powiatInfo(t) {
      var n = nazwy[t] || t, ws = (lista[t] || []).map(function (i) { return d.pl[i]; });
      var naz = /^[A-ZŁŚŻŹĆ]/.test(n) ? 'Miasto ' + n : 'Powiat ' + n;
      var h = '<strong>' + esc(naz) + '</strong> <span class="woj-n">woj. ' + esc(woj[t.slice(0, 2)] || '') + '</span>';
      if (!ws.length) h += '<p>Brak ostrzeżeń przed śniegiem i oblodzeniem.</p>';
      ws.forEach(function (w) { h += '<p><span class="obadge l' + w.stopien + '">' + w.stopien + '</span> ' + esc(w.zjawisko) + ', do ' + esc(kiedy(w.do)) + '</p>'; });
      $('pl-info').innerHTML = h;
    }
    function zaznacz(e) {
      var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (!t) return;
      var prev = g.querySelector('.sel'); if (prev) prev.classList.remove('sel');
      e.target.classList.add('sel'); g.appendChild(e.target); powiatInfo(t);
    }
    g.addEventListener('mouseover', zaznacz); g.addEventListener('click', zaznacz); g.addEventListener('focusin', zaznacz);

    // status Zamościa
    var zw = []; ZAMOSC.forEach(function (t) { (lista[t] || []).forEach(function (i) { if (zw.indexOf(i) < 0) zw.push(i); }); });
    var chip = $('zam-status');
    if (zw.length) {
      var top = zw.map(function (i) { return d.pl[i]; }).sort(function (a, b) { return b.stopien - a.stopien; })[0];
      chip.className = 'zam-chip l' + top.stopien;
      chip.innerHTML = '<b>Zamość: ostrzeżenie IMGW ' + STOP[top.stopien] + '</b><span>' + esc(top.zjawisko) + ', ' + esc(kiedy(top.od)) + ' – ' + esc(kiedy(top.do)) + '</span>';
      powiatInfo('0620');
    } else if (!d.aktualizacja) {
      chip.className = 'zam-chip';
      chip.innerHTML = '<b>Zamość: czekam na dane IMGW</b><span>Pierwsze dane pojawią się po uruchomieniu automatu</span>';
      $('pl-info').innerHTML = '<strong>Najedź lub stuknij powiat na mapie</strong><p>Zobaczysz, jakie ostrzeżenia obowiązują w danym miejscu.</p>';
    } else {
      chip.className = 'zam-chip l0';
      chip.innerHTML = '<b>Zamość: brak ostrzeżeń przed śniegiem</b><span>Powiat zamojski i miasto Zamość, według IMGW-PIB</span>';
      $('pl-info').innerHTML = '<strong>Najedź lub stuknij powiat na mapie</strong><p>Zobaczysz, jakie ostrzeżenia obowiązują w danym miejscu.</p>';
    }

    // lista ostrzeżeń PL
    var ul = $('pl-lista');
    if (!d.pl.length) {
      ul.innerHTML = '<li class="pusto">' + (d.aktualizacja ? 'Obecnie IMGW nie wydał ostrzeżeń przed śniegiem ani oblodzeniem.' : 'Lista pojawi się po pierwszym pobraniu danych.') + '</li>';
    } else {
      ul.innerHTML = d.pl.map(function (w) {
        var wo = {}; w.teryt.forEach(function (t) { var k = woj[t.slice(0, 2)]; if (k) wo[k] = 1; });
        var dotyczy = w.teryt.some(function (t) { return ZAMOSC.indexOf(t) > -1; });
        return '<li class="ost l' + w.stopien + (dotyczy ? ' tu' : '') + '"><div class="ost-top"><span class="obadge l' + w.stopien + '">' + w.stopien + '</span>' +
          '<div><h3>' + esc(w.zjawisko) + '</h3><p class="meta">' + esc(kiedy(w.od)) + ' – ' + esc(kiedy(w.do)) + (w.prawd ? ' · prawdopodobieństwo ' + esc(w.prawd) + '%' : '') + '</p></div></div>' +
          (dotyczy ? '<p class="tu-txt">Obejmuje Zamość lub powiat zamojski</p>' : '') +
          '<p class="gdzie">' + odm(w.teryt.length, 'powiat', 'powiaty', 'powiatów') + ' · woj. ' + esc(Object.keys(wo).join(', ')) + '</p>' +
          (w.tresc ? '<details><summary>Treść ostrzeżenia</summary><p>' + esc(w.tresc) + '</p>' + (w.biuro ? '<p class="meta">' + esc(w.biuro) + '</p>' : '') + '</details>' : '') + '</li>';
      }).join('');
    }

    // ---------- EUROPA
    var esvg = el('svg', { viewBox: '0 0 ' + mapy.eu.w + ' ' + mapy.eu.h, role: 'img', 'aria-label': 'Mapa ostrzeżeń MeteoAlarm przed śniegiem w Europie' }, $('mapa-eu'));
    el('rect', { width: mapy.eu.w, height: mapy.eu.h, 'class': 'morze' }, esvg);
    el('path', { d: mapy.eu.tlo, 'class': 'tlo' }, esvg);
    var eg = el('g', {}, esvg), lab = el('g', { 'class': 'etyk' }, esvg);
    var bledy = d.eu_bledy || [];
    mapy.eu.kraje.forEach(function (k) {
      var w = d.eu[k.c], lv = w ? w.stopien : 0;
      var p = el('path', { d: k.d, fill: KOLOR[lv], 'class': 'kraj lv' + lv + (bledy.indexOf(k.c) > -1 ? ' brak' : ''), 'data-c': k.c, tabindex: lv ? 0 : -1 }, eg);
      p.appendChild(el('title', {})).textContent = k.n + (w ? ' – ostrzeżenie ' + STOP[lv] : '');
      if (lv && k.xy[0] > 0 && k.xy[0] < mapy.eu.w && k.xy[1] > 0 && k.xy[1] < mapy.eu.h) {
        var t = el('text', { x: k.xy[0], y: k.xy[1] + 4, 'text-anchor': 'middle' }, lab); t.textContent = k.c;
      }
    });
    requestAnimationFrame(function () { esvg.classList.add('on'); });
    var pl = {}; mapy.eu.kraje.forEach(function (k) { pl[k.c] = k.n; });
    eg.addEventListener('click', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) euInfo(c); });
    eg.addEventListener('mouseover', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) euInfo(c); });
    function euInfo(c) {
      var w = d.eu[c];
      $('eu-info').innerHTML = '<strong>' + esc(pl[c] || c) + '</strong>' + (w ? '<p><span class="obadge l' + w.stopien + '">' + w.stopien + '</span> ' + esc(w.zjawiska.join(', ')) + '</p><p class="meta">' + odm(w.obszary, 'region', 'regiony', 'regionów') + (w.do ? ', do ' + esc(kiedy(w.do)) : '') + '</p>' : '<p>Brak ostrzeżeń przed śniegiem i oblodzeniem.</p>');
    }
    var kody = Object.keys(d.eu).sort(function (a, b) { return d.eu[b].stopien - d.eu[a].stopien || d.eu[b].obszary - d.eu[a].obszary; });
    $('eu-lista').innerHTML = kody.length ? kody.map(function (c) {
      var w = d.eu[c];
      return '<li class="ost l' + w.stopien + '"><div class="ost-top"><span class="obadge l' + w.stopien + '">' + w.stopien + '</span><div><h3>' + esc(pl[c] || c) + '</h3>' +
        '<p class="meta">' + odm(w.obszary, 'region', 'regiony', 'regionów') + (w.do ? ' · do ' + esc(kiedy(w.do)) : '') + '</p></div></div>' +
        '<p class="gdzie">' + esc(w.przyklady.slice(0, 4).join(', ')) + (w.obszary > 4 ? '…' : '') + '</p></li>';
    }).join('') : '<li class="pusto">' + (d.aktualizacja ? 'Brak ostrzeżeń przed śniegiem w krajach MeteoAlarm.' : 'Lista pojawi się po pierwszym pobraniu danych.') + '</li>';
    $('eu-ile').textContent = kody.length ? odm(kody.length, 'kraj', 'kraje', 'krajów') + ' z ostrzeżeniami' : '';
    $('pl-ile').textContent = d.pl.length ? odm(Object.keys(poziom).length, 'powiat', 'powiaty', 'powiatów') + ' z ostrzeżeniami' : '';
  }).catch(function (e) {
    console.error(e);
    $('ost-stan').textContent = 'Nie udało się wczytać map. Odśwież stronę.';
  });
})();
