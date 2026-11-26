/* Strona główna: ostrzeżenie IMGW dla Zamościa (powiat zamojski 0620, miasto Zamość 0664) */
(function () {
  var URLS = ['https://raw.githubusercontent.com/andrzejziommmmm/odsniezaniezamosc/main/data/ostrzezenia.json?t=' + Math.floor(Date.now() / 300000), '/data/ostrzezenia.json'];
  var ZAM = ['0620', '0664'], STOP = ['', '1. stopnia', '2. stopnia', '3. stopnia'];
  var box = document.getElementById('imgw-box');
  function get(i) { return fetch(URLS[i], { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { if (i + 1 < URLS.length) return get(i + 1); throw 0; }); }
  function kiedy(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  get(0).then(function (d) {
    var ws = (d.pl || []).filter(function (w) { return w.teryt.some(function (t) { return ZAM.indexOf(t) > -1; }); }).sort(function (a, b) { return b.stopien - a.stopien; });
    var kraj = (d.pl || []).length, eu = Object.keys(d.eu || {}).length;
    if (!d.aktualizacja) { box.querySelector('.imgw-txt span').textContent = 'Zobacz mapę ostrzeżeń dla Polski i Europy.'; return; }
    if (ws.length) {
      var w = ws[0];
      box.className = 'imgw-box l' + w.stopien;
      box.querySelector('.imgw-txt b').textContent = 'Ostrzeżenie IMGW ' + STOP[w.stopien] + ' dla Zamościa';
      box.querySelector('.imgw-txt span').textContent = w.zjawisko + ': ' + kiedy(w.od) + ' – ' + kiedy(w.do);
      var a = document.getElementById('alert'), t = document.getElementById('alert-txt');
      if (a && t) {
        a.dataset.imgw = '1';
        t.innerHTML = '<strong>Ostrzeżenie IMGW ' + STOP[w.stopien] + ':</strong> ' + w.zjawisko.replace(/</g, '&lt;') + ' w Zamościu, do ' + kiedy(w.do) + '. Zarezerwuj odśnieżanie wcześniej.';
        if (w.stopien >= 2) a.classList.add('storm');
        var closed = false; try { closed = sessionStorage.getItem('alertX') === '1'; } catch (e) {}
        if (!closed) a.classList.add('on');
      }
    } else {
      box.className = 'imgw-box l0';
      box.querySelector('.imgw-txt b').textContent = 'Zamość: brak ostrzeżeń IMGW przed śniegiem';
      box.querySelector('.imgw-txt span').textContent = kraj ? 'W Polsce obowiązuje ' + kraj + ' ostrzeżeń przed śniegiem lub oblodzeniem' + (eu ? ', w Europie ostrzeżenia w ' + eu + ' krajach.' : '.') : 'Obecnie IMGW nie wydał ostrzeżeń przed śniegiem w Polsce.';
    }
  }).catch(function () { box.querySelector('.imgw-txt span').textContent = 'Zobacz mapę ostrzeżeń dla Polski i Europy.'; });
})();
