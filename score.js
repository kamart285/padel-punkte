/* Padel-Zählweise – reine Logik ohne DOM. Läuft im Browser (window.PadelScore),
   in Node (module.exports) und wird für die Uhr-App nach padel-watch kopiert. */
(function (root) {
  'use strict';
  var DEFAULT_CFG = { bestOf: 3, games: 6, golden: true, tbAt: 6, tbTo: 7, superTb: false, superTo: 10 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newMatch(cfg) {
    var c = {}; var k;
    for (k in DEFAULT_CFG) c[k] = DEFAULT_CFG[k];
    if (cfg) for (k in cfg) if (cfg[k] !== undefined) c[k] = cfg[k];
    return { cfg: c, sets: [], games: [0, 0], points: [0, 0], setsWon: [0, 0],
             tb: false, stb: false, winner: null, history: [], seq: 0 };
  }

  function setsToWin(s) { return Math.floor(s.cfg.bestOf / 2) + 1; }

  function snapshot(s) {
    return { sets: clone(s.sets), games: s.games.slice(), points: s.points.slice(),
             setsWon: s.setsWon.slice(), tb: s.tb, stb: s.stb, winner: s.winner };
  }

  function winSet(s, w) {
    s.sets.push(s.games.slice());
    s.setsWon[w]++;
    s.games = [0, 0]; s.points = [0, 0]; s.tb = false; s.stb = false;
    if (s.setsWon[w] >= setsToWin(s)) { s.winner = w; return; }
    // Entscheidungssatz als Super-Tiebreak (optional)
    var need = setsToWin(s) - 1;
    if (s.cfg.superTb && s.setsWon[0] === need && s.setsWon[1] === need) s.stb = true;
  }

  function winGame(s, w) {
    s.games[w]++; s.points = [0, 0];
    var a = s.games[w], b = s.games[1 - w], G = s.cfg.games;
    if (s.tb) { s.tb = false; winSet(s, w); return; }
    if (a >= G && a - b >= 2) { winSet(s, w); return; }
    if (s.games[0] === s.cfg.tbAt && s.games[1] === s.cfg.tbAt) s.tb = true;
  }

  /* Punkt für Seite w (0 = links/„Ich“, 1 = rechts/„Gegner“). Gibt neuen Zustand zurück. */
  function point(state, w) {
    var s = clone(state);
    if (s.winner !== null) return s;
    s.history.push(snapshot(state));
    if (s.history.length > 500) s.history.shift();
    s.seq++;
    s.points[w]++;
    var a = s.points[w], b = s.points[1 - w];
    if (s.tb || s.stb) {
      var to = s.stb ? s.cfg.superTo : s.cfg.tbTo;
      if (a >= to && a - b >= 2) {
        if (s.stb) { s.games[w]++; s.stb = false; s.sets.push(s.games.slice()); s.setsWon[w]++; s.games = [0,0]; s.points = [0,0]; s.winner = w; }
        else winGame(s, w);
      }
      return s;
    }
    if (s.cfg.golden) { if (a >= 4) winGame(s, w); return s; }
    if (a >= 4 && a - b >= 2) winGame(s, w);
    else if (s.points[0] === 4 && s.points[1] === 4) s.points = [3, 3]; // Vorteil weg → Einstand
    return s;
  }

  function undo(state) {
    if (!state.history.length) return state;
    var s = clone(state);
    var h = s.history.pop();
    for (var k in h) s[k] = h[k];
    s.seq++;
    return s;
  }

  var P = ['0', '15', '30', '40'];
  /* Anzeige: {left, right, label} – label z. B. 'Einstand', 'Vorteil', 'Golden Point', 'Tiebreak' */
  function display(s) {
    var p = s.points, out = { left: '', right: '', label: '', adv: null };
    if (s.winner !== null) { out.left = out.right = ''; out.label = 'Spiel, Satz und Sieg'; return out; }
    if (s.tb || s.stb) { out.left = String(p[0]); out.right = String(p[1]); out.label = s.stb ? 'Match-Tiebreak' : 'Tiebreak'; return out; }
    if (p[0] >= 3 && p[1] >= 3) {
      if (p[0] === p[1]) { out.left = out.right = '40'; out.label = s.cfg.golden ? 'GOLDEN POINT' : 'Einstand'; return out; }
      var w = p[0] > p[1] ? 0 : 1;
      out.adv = w; out.label = 'Vorteil';
      out.left = w === 0 ? 'AD' : '40'; out.right = w === 1 ? 'AD' : '40';
      return out;
    }
    out.left = P[Math.min(p[0], 3)]; out.right = P[Math.min(p[1], 3)];
    return out;
  }

  /* Kurzer Text, z. B. für die Uhr / Tests: "1:0 | 4:2 | 30:40" */
  function summary(s) {
    var d = display(s);
    return s.setsWon[0] + ':' + s.setsWon[1] + ' | ' + s.games[0] + ':' + s.games[1] + ' | ' +
      (s.winner !== null ? 'Ende' : d.left + ':' + d.right + (d.label ? ' (' + d.label + ')' : ''));
  }

  var api = { DEFAULT_CFG: DEFAULT_CFG, newMatch: newMatch, point: point, undo: undo, display: display, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PadelScore = api;
})(typeof window !== 'undefined' ? window : this);
