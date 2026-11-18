/* SNULT 스페인어 - 스페인어 원어민 음성 재생 모듈
   Web Speech API에서 가장 자연스러운 스페인어 음성을 골라 사용한다. */
window.SpeechES = (function () {
  var voices = [], male = null, female = null, chosen = null, rate = 0.92, ready = false;

  // 품질이 좋은 순서대로 가점. (OS/브라우저별 고품질 스페인어 음성)
  var PREF = [
    { re: /google.*espa(ñ|n)ol(?!.*estados)/i, s: 100 },
    { re: /google espa/i,                      s: 96  },
    { re: /m(ó|o)nica/i,                       s: 94  },
    { re: /paulina/i,                          s: 92  },
    { re: /(elvira|helena|laura|dalia|triana)/i, s: 90 },
    { re: /(alvaro|álvaro|jorge|pablo|diego)/i,  s: 88 },
    { re: /(sabina|lucia|lucía|esperanza)/i,   s: 86 },
    { re: /natural/i,                          s: 30  },
    { re: /premium|enhanced|neural/i,          s: 26  },
    { re: /compact|eloquence|espeak/i,         s: -40 }
  ];
  var FEMALE = /(m(ó|o)nica|paulina|elvira|helena|laura|dalia|triana|sabina|luc(i|í)a|esperanza|marisol|femenin|female|mujer)/i;
  var MALE   = /(alvaro|álvaro|jorge|pablo|diego|carlos|enrique|juan|masculin|male|hombre)/i;

  function score(v) {
    var s = 0, lang = (v.lang || '').toLowerCase();
    if (lang.indexOf('es') !== 0) return -999;
    if (lang === 'es-es') s += 20;            // 반도 스페인어 우선
    else if (/es-(mx|us|ar|co|cl|pe)/.test(lang)) s += 14;
    else s += 8;
    if (v.localService === false) s += 12;     // 보통 클라우드 음성이 더 자연스럽다
    var n = v.name || '';
    for (var i = 0; i < PREF.length; i++) if (PREF[i].re.test(n)) s += PREF[i].s;
    return s;
  }

  function load() {
    var all = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    voices = all.filter(function (v) { return (v.lang || '').toLowerCase().indexOf('es') === 0; })
                .sort(function (a, b) { return score(b) - score(a); });
    if (!voices.length) { ready = false; return; }
    ready = true;
    if (!chosen || voices.indexOf(chosen) < 0) chosen = voices[0];
    female = voices.find(function (v) { return FEMALE.test(v.name); }) || null;
    male   = voices.find(function (v) { return MALE.test(v.name); })   || null;
  }

  if (window.speechSynthesis) {
    load();
    window.speechSynthesis.onvoiceschanged = function () { load(); if (onReady) onReady(); };
  }
  var onReady = null;

  function pick(gender) {
    if (gender === 'H' && male) return male;
    if (gender === 'M' && female) return female;
    return chosen || voices[0] || null;
  }

  function stop() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }

  // 한 줄 읽기
  function say(text, gender, done) {
    if (!window.speechSynthesis) { if (done) done(); return; }
    var u = new SpeechSynthesisUtterance(text);
    var v = pick(gender);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'es-ES'; }
    u.rate = rate; u.pitch = gender === 'H' ? 0.94 : 1.03; u.volume = 1;
    u.onend = function () { if (done) done(); };
    u.onerror = function () { if (done) done(); };
    window.speechSynthesis.speak(u);
  }

  // 여러 줄을 순서대로, 사이에 자연스러운 쉼을 두고 읽기
  function sequence(items, opts) {
    opts = opts || {};
    stop();
    var i = 0, cancelled = false;
    function next() {
      if (cancelled) return;
      if (i >= items.length) { if (opts.onEnd) opts.onEnd(); return; }
      var it = items[i];
      if (opts.onLine) opts.onLine(i);
      i++;
      say(it.t, it.s, function () { setTimeout(next, opts.gap == null ? 420 : opts.gap); });
    }
    next();
    return { cancel: function () { cancelled = true; stop(); } };
  }

  return {
    get voices() { return voices; },
    get ready()  { return ready; },
    get current(){ return chosen; },
    setVoice: function (name) {
      var v = voices.find(function (x) { return x.name === name; });
      if (v) { chosen = v; if (FEMALE.test(v.name)) female = v; else if (MALE.test(v.name)) male = v; }
    },
    setRate: function (r) { rate = r; },
    get rate() { return rate; },
    reload: load,
    onReady: function (fn) { onReady = fn; },
    say: say, sequence: sequence, stop: stop
  };
})();
