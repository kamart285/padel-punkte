/* Padel Anzeige – Oberfläche, Eingaben, Uhr-Empfang (ntfy.sh) */
(function () {
  'use strict';
  var S = window.PadelScore;
  var $ = function (id) { return document.getElementById(id); };
  var LS_STATE = 'padel.state', LS_SET = 'padel.settings';
  var RELAY = 'https://ntfy.sh/';
  var DEF_KEYS = { A: ['ArrowLeft', 'ArrowUp', 'PageUp', '1', 'a'], B: ['ArrowRight', 'ArrowDown', 'PageDown', '2', 'b'], U: ['Backspace', 'Delete', '0', 'z', 'u'] };

  function randCode() {
    var abc = 'abcdefghijkmnpqrstuvwxyz23456789', a = new Uint8Array(16), s = '';
    crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += abc[a[i] % abc.length];
    return 'padel-' + s;
  }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }

  var set = load(LS_SET, {});
  var defaults = { nameA: 'Ich', nameB: 'Gegner', swap: false, tap: true, light: false, beep: false, relay: false, topic: '', keys: DEF_KEYS };
  for (var k in defaults) if (set[k] === undefined) set[k] = JSON.parse(JSON.stringify(defaults[k]));
  if (!set.topic) set.topic = randCode();
  // Code aus Link übernehmen (#code=… vom QR-Code)
  var hm = /[#&]code=([a-z0-9-]{8,64})/i.exec(location.hash);
  if (hm) { set.topic = hm[1]; set.relay = true; history.replaceState(null, '', location.pathname); }
  var st = load(LS_STATE, null);
  if (!st || !st.cfg || !st.points) st = S.newMatch();

  function saveSet() { localStorage.setItem(LS_SET, JSON.stringify(set)); }
  function saveState() { localStorage.setItem(LS_STATE, JSON.stringify(st)); }
  saveSet();

  /* ---------- Anzeige ---------- */
  var bannerT;
  function banner(t) { var b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(function () { b.classList.remove('show'); }, 1700); }
  function name(i) { return i === 0 ? set.nameA : set.nameB; }

  function render() {
    var d = S.display(st);
    document.body.classList.toggle('light', !!set.light);
    // Spalte links zeigt Team 0, außer bei getauschten Seiten
    var L = set.swap ? 1 : 0;
    var cols = [$('sA'), $('sB')];
    cols[0].className = 'side ' + (L === 0 ? 'sideA' : 'sideB'); cols[0].dataset.side = L;
    cols[1].className = 'side R ' + (L === 0 ? 'sideB' : 'sideA'); cols[1].dataset.side = 1 - L;
    var pts = [d.left, d.right];
    [[ 'nA', 'pA', 'gA', L ], [ 'nB', 'pB', 'gB', 1 - L ]].forEach(function (r) {
      var t = r[3];
      $(r[0]).textContent = name(t);
      $(r[1]).textContent = st.winner !== null ? '–' : pts[t];
      $(r[1]).classList.toggle('ad', pts[t] === 'AD');
      $(r[2]).textContent = st.games[t];
    });
    $('sSA').textContent = st.setsWon[L]; $('sSB').textContent = st.setsWon[1 - L];
    $('sSA').className = L === 0 ? 'sa' : 'sb'; $('sSB').className = L === 0 ? 'sb' : 'sa';
    $('hist').textContent = st.sets.map(function (x) { return x[L] + ':' + x[1 - L]; }).join('   ');
    var lab = d.label;
    if (lab === 'Vorteil') lab = 'Vorteil ' + name(d.adv);
    if (st.winner !== null) lab = '';
    var s = $('status'); s.textContent = lab; s.classList.toggle('hot', !!lab);
    // Sieger
    var w = $('winner');
    if (st.winner !== null) {
      $('wTitle').textContent = 'Sieg ' + name(st.winner) + '!';
      $('wSets').textContent = st.sets.map(function (x) { return x[0] + ':' + x[1]; }).join('  ·  ');
      w.classList.add('show');
    } else w.classList.remove('show');
    $('bUndo').disabled = !st.history.length;
  }

  function flash(team) {
    var el = (set.swap ? 1 - team : team) === 0 ? $('sA') : $('sB');
    el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 350);
  }
  var actx;
  function beep(f) {
    if (!set.beep) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); var o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f || 880; g.gain.value = 0.15; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.12); } catch (e) {}
  }

  function commit(ns, team) {
    var prev = st; st = ns; saveState(); render();
    if (team === undefined) return;
    flash(team); beep(team === 0 ? 880 : 660);
    if (st.winner !== null) return;
    if (st.setsWon[team] > prev.setsWon[team]) banner('Satz ' + name(team));
    else if (st.games[team] > prev.games[team]) banner('Spiel ' + name(team));
  }
  function point(team) { if (st.winner !== null) return; commit(S.point(st, team), team); if (navigator.vibrate) navigator.vibrate(40); }
  function undo() { if (!st.history.length) return; commit(S.undo(st)); banner('↶ Rückgängig'); if (navigator.vibrate) navigator.vibrate([30, 60, 30]); }
  function newMatch() { st = S.newMatch(st.cfg); saveState(); render(); }

  /* ---------- Antippen ---------- */
  var press = null;
  function onDown(e) {
    if (!set.tap || e.target.closest('button') || $('settings').classList.contains('show')) return;
    var side = e.target.closest('.side');
    var team = side ? +side.dataset.side : null;
    if (team === null) return;
    press = { team: team, t: setTimeout(function () { press = null; undo(); }, 650) };
  }
  function onUp() { if (!press) return; clearTimeout(press.t); var t = press.team; press = null; point(t); }
  function onCancel() { if (press) { clearTimeout(press.t); press = null; } }
  var board = $('board');
  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onCancel);
  board.addEventListener('pointerleave', onCancel);
  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('bUndo').onclick = undo;
  $('wUndo').onclick = undo;
  $('wNew').onclick = newMatch;

  /* ---------- Tasten ---------- */
  var learn = null;
  function keyName(e) { return e.key && e.key !== 'Unidentified' ? e.key : 'code:' + (e.code || e.keyCode); }
  document.addEventListener('keydown', function (e) {
    var kn = keyName(e);
    $('lastKey').textContent = 'Letzte Taste: ' + kn;
    if (learn) { e.preventDefault(); ['A', 'B', 'U'].forEach(function (x) { set.keys[x] = set.keys[x].filter(function (y) { return y !== kn; }); });
      set.keys[learn].push(kn); learn = null; saveSet(); renderKeys(); return; }
    if ($('settings').classList.contains('show')) { if (kn === 'Escape') closeSettings(); return; }
    var hit = null; ['A', 'B', 'U'].forEach(function (x) { if (set.keys[x].indexOf(kn) >= 0 || set.keys[x].indexOf(kn.toLowerCase()) >= 0) hit = x; });
    if (!hit) return;
    e.preventDefault();
    if (e.repeat) return;
    if (hit === 'U') undo(); else point(hit === 'A' ? 0 : 1);
  });
  function renderKeys() {
    var rows = [['A', 'Punkt ' + set.nameA], ['B', 'Punkt ' + set.nameB], ['U', 'Rückgängig']], h = '';
    rows.forEach(function (r) {
      h += '<span>' + esc(r[1]) + '</span><span>' + set.keys[r[0]].map(function (k) { return '<code>' + esc(k === ' ' ? 'Leertaste' : k) + '</code>'; }).join(' ') + '</span>' +
        '<button class="btn" data-learn="' + r[0] + '">' + (learn === r[0] ? 'Taste drücken…' : 'Taste lernen') + '</button>';
    });
    h += '<span></span><span></span><button class="btn" id="kReset">Standard</button>';
    $('keys').innerHTML = h;
  }
  $('keys').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'kReset') { set.keys = JSON.parse(JSON.stringify(DEF_KEYS)); saveSet(); }
    else learn = b.dataset.learn;
    renderKeys();
  });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Uhr-Empfang über ntfy.sh ---------- */
  var rl = load('padel.relay', {}), watchSeq = rl.watchSeq || { m: null, n: -1 }, es = null, lastId = rl.lastId || null, seen = rl.seen || [], connState = 'off', retryT = null;
  function setConn(s, txt) {
    connState = s;
    ['dot', 'dot2'].forEach(function (id) { $(id).className = 'dot' + (s === 'on' ? ' on' : s === 'err' ? ' err' : ''); });
    $('connTxt').textContent = txt;
  }
  function handleMsg(raw) {
    var m = String(raw || '').trim(), obj = null;
    if (m[0] === '{') { try { obj = JSON.parse(m); } catch (e) {} }
    var cmd = (obj ? obj.c : m).toUpperCase();
    if (obj && obj.st && obj.st.points && obj.st.games) {
      // Reihenfolge absichern: ältere Stände desselben Matches ignorieren
      if (obj.m && obj.m === watchSeq.m && typeof obj.n === 'number' && obj.n <= watchSeq.n) return;
      if (obj.m) { watchSeq = { m: obj.m, n: typeof obj.n === 'number' ? obj.n : -1 }; saveRelay(); }
      // Die Uhr schickt ihren kompletten Stand mit → übernehmen (bleibt synchron, auch wenn mal etwas verloren ging)
      var team = cmd === 'A' ? 0 : cmd === 'B' ? 1 : undefined;
      var ns = JSON.parse(JSON.stringify(st));
      ns.history.push({ sets: st.sets, games: st.games, points: st.points, setsWon: st.setsWon, tb: st.tb, stb: st.stb, winner: st.winner });
      if (ns.history.length > 500) ns.history.shift();
      ['sets', 'games', 'points', 'setsWon', 'tb', 'stb', 'winner'].forEach(function (f) { if (obj.st[f] !== undefined) ns[f] = obj.st[f]; });
      if (obj.st.cfg) ns.cfg = obj.st.cfg;
      ns.seq++;
      if (cmd === 'UNDO') { commit(ns); banner('↶ Rückgängig'); } else commit(ns, team);
      return;
    }
    if (cmd === 'A' || cmd === 'ICH' || cmd === 'WIR') point(0);
    else if (cmd === 'B' || cmd === 'GEGNER' || cmd === 'IHR') point(1);
    else if (cmd === 'UNDO' || cmd === 'U') undo();
    else if (cmd === 'RESET') { newMatch(); banner('Neues Match'); }
  }
  function connect() {
    disconnect();
    if (!set.relay) { setConn('off', 'Uhr aus'); return; }
    if (!navigator.onLine) { setConn('err', 'Kein Internet'); }
    // Nur Neues abholen: ab der letzten Nachricht bzw. ab jetzt (ntfy liefert sonst kurz zuvor Gesendetes evtl. nochmal)
    var url = RELAY + encodeURIComponent(set.topic) + '/sse?since=' + (lastId || Math.floor(Date.now() / 1000));
    try { es = new EventSource(url); } catch (e) { setConn('err', 'Fehler'); return; }
    if (connState !== 'on') setConn('wait', 'Verbinde…');
    es.onopen = function () { setConn('on', 'Uhr bereit'); };
    es.onmessage = function (ev) {
      var d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.event && d.event !== 'message') return;
      if (seen.indexOf(d.id) >= 0) return;
      seen.push(d.id); if (seen.length > 200) seen.shift();
      lastId = d.id; saveRelay();
      // Alte Nachrichten (> 2 Minuten) beim Wiederverbinden nicht nachspielen
      if (d.time && Date.now() / 1000 - d.time > 120) return;
      handleMsg(d.message);
    };
    es.onerror = function () {
      setConn('err', 'Verbindung weg…');
      disconnect(); clearTimeout(retryT); retryT = setTimeout(connect, 2500);
    };
  }
  function saveRelay() { localStorage.setItem('padel.relay', JSON.stringify({ lastId: lastId, seen: seen.slice(-100), watchSeq: watchSeq })); }
  function disconnect() { if (es) { es.onerror = null; es.close(); es = null; } }
  window.addEventListener('online', function () { if (set.relay) connect(); });

  function renderQR() {
    $('code').textContent = set.topic;
    var link = location.origin + location.pathname + '#code=' + set.topic;
    try { var q = qrcode(0, 'M'); q.addData(link); q.make(); $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { $('qr').textContent = ''; }
    $('relayInfo').innerHTML = 'Die Uhr sendet über <b>ntfy.sh</b> (kostenlos, ohne Konto) an diesen Code. Wer den Code kennt, könnte mitzählen – deshalb ist er lang und zufällig. Test vom PC: <code>curl -d A ntfy.sh/' + esc(set.topic) + '</code>';
  }

  /* ---------- Bildschirm an lassen ---------- */
  var lock = null;
  function wake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { if (!lock) wake(); if (set.relay && !es) connect(); } });
  document.addEventListener('pointerdown', function () { if (!lock) wake(); }, { passive: true });
  wake();

  $('bFull').onclick = function () {
    var d = document.documentElement;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); }).catch(function () {});
    wake();
  };

  /* ---------- Einstellungen ---------- */
  function openSettings() {
    $('iA').value = set.nameA; $('iB').value = set.nameB;
    $('cGolden').checked = !!st.cfg.golden; $('cSuper').checked = !!st.cfg.superTb;
    $('cTap').checked = !!set.tap; $('cLight').checked = !!set.light; $('cBeep').checked = !!set.beep; $('cRelay').checked = !!set.relay;
    [].forEach.call($('segBest').children, function (b) { b.classList.toggle('on', +b.dataset.v === st.cfg.bestOf); });
    renderKeys(); renderQR();
    $('settings').classList.add('show');
  }
  function closeSettings() { learn = null; $('settings').classList.remove('show'); render(); }
  $('bSet').onclick = openSettings; $('sClose').onclick = closeSettings;
  function nm() { set.nameA = $('iA').value.trim() || 'Ich'; set.nameB = $('iB').value.trim() || 'Gegner'; saveSet(); render(); renderKeys(); }
  $('iA').oninput = nm; $('iB').oninput = nm;
  [].forEach.call(document.querySelectorAll('[data-names]'), function (b) { b.onclick = function () { var p = b.dataset.names.split('|'); $('iA').value = p[0]; $('iB').value = p[1]; nm(); }; });
  $('bSwap').onclick = function () { set.swap = !set.swap; saveSet(); render(); banner('Seiten getauscht'); };
  function cfg(k, v) { st.cfg[k] = v; saveState(); render(); }
  $('cGolden').onchange = function () { cfg('golden', this.checked); if (this.checked && st.points[0] >= 3 && st.points[1] >= 3 && st.points[0] !== st.points[1]) { st.points = [3, 3]; saveState(); render(); } };
  $('cSuper').onchange = function () { cfg('superTb', this.checked); };
  $('segBest').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; cfg('bestOf', +b.dataset.v); openSettings(); };
  $('cTap').onchange = function () { set.tap = this.checked; saveSet(); };
  $('cLight').onchange = function () { set.light = this.checked; saveSet(); render(); };
  $('cBeep').onchange = function () { set.beep = this.checked; saveSet(); if (set.beep) beep(); };
  $('cRelay').onchange = function () { set.relay = this.checked; saveSet(); connect(); };
  $('bNew').onclick = function () { if (confirm('Neues Match starten? Der aktuelle Stand wird gelöscht.')) { newMatch(); closeSettings(); banner('Neues Match'); } };
  $('bNewCode').onclick = function () { if (!confirm('Neuen Code erzeugen? Danach musst du ihn in der Zepp-App neu eintragen.')) return; set.topic = randCode(); lastId = null; seen = []; saveRelay(); saveSet(); renderQR(); connect(); };
  $('bCopy').onclick = function () {
    var done = function () { $('bCopy').textContent = 'Kopiert ✓'; setTimeout(function () { $('bCopy').textContent = 'Code kopieren'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(set.topic).then(done, function () {}); };
  $('bTest').onclick = function () {
    if (!set.relay) { set.relay = true; $('cRelay').checked = true; saveSet(); connect(); }
    fetch(RELAY + encodeURIComponent(set.topic), { method: 'POST', body: 'A' }).then(function () { $('bTest').textContent = 'Gesendet ✓'; }, function () { $('bTest').textContent = 'Kein Internet'; });
    setTimeout(function () { $('bTest').textContent = 'Test senden'; }, 2000);
  };

  window.addEventListener('storage', function (e) { if (e.key === LS_STATE && e.newValue) { st = JSON.parse(e.newValue); render(); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});

  render(); connect();
  // Für Tests
  window.__pd = { state: function () { return st; }, settings: function () { return set; }, summary: function () { return S.summary(st); },
    conn: function () { return connState; }, handle: handleMsg, wake: function () { return !!lock; } };
})();
