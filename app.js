(function () {
  var BANK = { '1l': DATA_S1L, '1r': DATA_S1R, '2l': DATA_S2L, '2r': DATA_S2R };
  var LET = ['a', 'b', 'c', 'd'];

  var qs = new URLSearchParams(location.search);
  var S = qs.get('s') || '1', K = qs.get('k') || 'l', P = parseInt(qs.get('p') || '1', 10);
  var DATA = BANK[S + K];
  if (!DATA) { location.href = 'index.html'; }
  var PART = DATA.parts.filter(function (x) { return x.id === P; })[0] || DATA.parts[0];
  var isListen = (K === 'l');
  var ITEMS = DATA.items.filter(function (i) { return i.part === P; });
  var answers = {};       // n -> chosen index (1-based)
  var playing = null;

  // ---------- 상단 ----------
  document.title = DATA.title + ' ' + PART.name + ' · SNULT 스페인어';
  document.getElementById('eyebrow').textContent = 'SET ' + S + ' · ' + (isListen ? 'Comprensión auditiva' : 'Comprensión lectora');
  document.getElementById('title').textContent = DATA.title + ' · ' + PART.name;
  document.getElementById('subtitle').textContent = '문제 ' + PART.range + '번 · 전 ' + ITEMS.length + '문항';
  document.getElementById('bartitle').firstChild.nodeValue = 'SET ' + S + ' ' + (isListen ? '청해' : '독해') + ' ' + PART.name;
  document.getElementById('barsub').textContent = '문제 ' + PART.range;
  document.getElementById('instr').innerHTML = '<b>' + PART.name + '</b> · ' + PART.instr;

  // ---------- 음성 ----------
  function fillVoices() {
    var sel = document.getElementById('voice'), vs = SpeechES.voices;
    if (!vs.length) {
      sel.innerHTML = '<option>스페인어 음성 없음</option>';
      sel.disabled = true;
      document.getElementById('warnvoice').classList.add('show');
      return;
    }
    document.getElementById('warnvoice').classList.remove('show');
    sel.disabled = false;
    sel.innerHTML = vs.map(function (v, i) {
      return '<option value="' + v.name.replace(/"/g, '') + '"' + (i === 0 ? ' selected' : '') + '>' +
        v.name + ' (' + v.lang + ')</option>';
    }).join('');
  }
  fillVoices();
  SpeechES.onReady(fillVoices);
  setTimeout(fillVoices, 700);
  document.getElementById('voice').onchange = function () { SpeechES.setVoice(this.value); };
  document.getElementById('rate').onchange = function () { SpeechES.setRate(parseFloat(this.value)); };
  document.getElementById('stopAll').onclick = function () { stopPlay(); };

  function stopPlay() {
    if (playing) { playing.cancel(); playing = null; }
    SpeechES.stop();
    document.querySelectorAll('.line.active').forEach(function (e) { e.classList.remove('active'); });
    document.querySelectorAll('.tbtn.on').forEach(function (e) { e.classList.remove('on'); e.textContent = e.dataset.label || e.textContent; });
  }

  // 문항 전체를 읽을 때 쓸 음성 묶음
  function speechItems(it) {
    var arr = [];
    if (it.lines) {
      it.lines.forEach(function (l) {
        if (!l.t || /^_+$/.test(l.t.trim())) return;
        arr.push({ s: (l.s === 'M' ? 'M' : 'H'), t: l.t });
      });
    }
    if (it.segs) it.segs.forEach(function (g) { arr.push({ s: 'H', t: g.t }); });
    if (it.text) arr.push({ s: 'H', t: it.text });
    if (it.q) arr.push({ s: 'M', t: it.q });
    return arr;
  }

  // ---------- 렌더 ----------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function scriptHTML(it) {
    var h = '';
    if (it.lines) {
      h += it.lines.map(function (l, i) {
        var blank = /^_+$/.test((l.t || '').trim());
        var cls = (l.s === 'M' || l.s === 'B') ? 'f' : '';
        var mark = it.kind === 'errdialog' ? '<span class="passage"><span class="segmark">(' + LET[l.o - 1] + ')</span> </span>' : '';
        return '<div class="line" data-i="' + i + '">' +
          '<span class="spk ' + cls + '" data-say="' + esc(l.t) + '" data-g="' + (l.s === 'M' || l.s === 'B' ? 'M' : 'H') + '">' + l.s + '</span>' +
          '<span class="txt' + (blank ? ' blank' : '') + '">' + mark + esc(l.t) + '</span></div>';
      }).join('');
    }
    if (it.segs) {
      h += '<p class="passage">' + it.segs.map(function (g) {
        return '<span class="seg" data-say="' + esc(g.t) + '"><span class="segmark">(' + LET[g.o - 1] + ')</span> ' + esc(g.t) + '</span>';
      }).join(' ') + '</p>';
    }
    if (it.text) {
      h += '<p class="passage"><span class="seg" data-say="' + esc(it.text) + '">' + esc(it.text) + '</span></p>';
    }
    return h;
  }

  function itemHTML(it, idx) {
    var h = '<article class="q" id="q' + it.n + '" data-n="' + it.n + '">';
    h += '<div class="qhead"><div class="qnum">' + String(it.n).padStart(2, '0') + '</div>';
    h += '<div class="qtools">';
    h += '<button class="tbtn play" data-label="▶ 듣기">▶ 듣기</button>';
    if (isListen) h += '<button class="tbtn reveal">스크립트 보기</button>';
    h += '</div></div>';

    h += '<div class="script' + (isListen ? ' hidden' : '') + '">' + scriptHTML(it) + '</div>';
    if (isListen) h += '<div class="hidscript">🎧 음성을 듣고 답을 고르세요. (스크립트는 가려져 있습니다)</div>';

    if (it.q) h += '<p class="ask">Pregunta: ' + esc(it.q) + '</p>';

    h += '<div class="opts">' + it.options.map(function (o, i) {
      return '<button class="opt" data-i="' + (i + 1) + '"><span class="k">' + LET[i] + '</span><span class="v">' + esc(o) + '</span></button>';
    }).join('') + '</div>';

    h += '<div class="feedback"><div class="verdict"></div>';
    h += '<div class="fblock"><h4>해설</h4><p>' + esc(it.exp) + '</p></div>';
    if (it.trans && it.trans.length) {
      h += '<div class="fblock"><h4>번역</h4><ul class="translist">' +
        it.trans.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }
    if (it.vocab && it.vocab.length) {
      h += '<div class="fblock"><h4>어휘</h4><div class="vocab">' +
        it.vocab.map(function (v) { return '<span><b>' + esc(v[0]) + '</b> ' + esc(v[1]) + '</span>'; }).join('') + '</div></div>';
    }
    if (it.tip) h += '<div class="fblock"><div class="tipbox">💡 ' + esc(it.tip) + '</div></div>';
    h += '</div></article>';
    return h;
  }

  function renderAll(subset) {
    var list = subset || ITEMS;
    document.getElementById('list').innerHTML = list.map(itemHTML).join('');
    bind();
    updateBar();
  }

  // ---------- 동작 ----------
  function bind() {
    document.querySelectorAll('.q').forEach(function (card) {
      var n = parseInt(card.dataset.n, 10);
      var it = ITEMS.filter(function (x) { return x.n === n; })[0];

      card.querySelector('.play').onclick = function () {
        var btn = this;
        if (btn.classList.contains('on')) { stopPlay(); return; }
        stopPlay();
        btn.classList.add('on'); btn.textContent = '■ 정지';
        var lines = card.querySelectorAll('.script .line');
        playing = SpeechES.sequence(speechItems(it), {
          gap: 450,
          onLine: function (i) {
            lines.forEach(function (e) { e.classList.remove('active'); });
            if (lines[i]) lines[i].classList.add('active');
          },
          onEnd: function () {
            btn.classList.remove('on'); btn.textContent = '▶ 듣기';
            lines.forEach(function (e) { e.classList.remove('active'); });
            playing = null;
          }
        });
      };

      var rev = card.querySelector('.reveal');
      if (rev) rev.onclick = function () {
        var sc = card.querySelector('.script'), hs = card.querySelector('.hidscript');
        var hidden = sc.classList.toggle('hidden');
        if (hs) hs.style.display = hidden ? '' : 'none';
        this.textContent = hidden ? '스크립트 보기' : '스크립트 가리기';
      };

      card.querySelectorAll('[data-say]').forEach(function (el) {
        el.onclick = function (e) {
          e.stopPropagation();
          stopPlay();
          SpeechES.say(el.dataset.say, el.dataset.g || 'H');
        };
      });

      card.querySelectorAll('.opt').forEach(function (btn) {
        btn.onclick = function () {
          if (answers[n]) return;
          var pick = parseInt(btn.dataset.i, 10);
          answers[n] = pick;
          var ok = (pick === it.answer);
          card.querySelectorAll('.opt').forEach(function (b) {
            var i = parseInt(b.dataset.i, 10);
            b.disabled = true;
            if (i === it.answer) b.classList.add('right');
            else if (i === pick) b.classList.add('wrong');
          });
          var fb = card.querySelector('.feedback');
          var vd = fb.querySelector('.verdict');
          vd.textContent = ok ? '정답입니다. (' + LET[it.answer - 1] + ')' : '오답입니다. 정답은 (' + LET[it.answer - 1] + ')';
          vd.className = 'verdict ' + (ok ? 'ok' : 'no');
          fb.classList.add('show');
          // 청해는 답을 고른 뒤 스크립트를 자동으로 펼친다
          var sc = card.querySelector('.script');
          if (sc && sc.classList.contains('hidden')) {
            sc.classList.remove('hidden');
            var hs = card.querySelector('.hidscript'); if (hs) hs.style.display = 'none';
            if (rev) rev.textContent = '스크립트 가리기';
          }
          updateBar();
        };
      });
    });
  }

  function updateBar() {
    var shown = document.querySelectorAll('.q').length;
    var done = Object.keys(answers).length;
    document.getElementById('bar').style.width = (done / ITEMS.length * 100) + '%';
    if (done >= ITEMS.length) finish();
  }

  function finish() {
    var correct = 0;
    ITEMS.forEach(function (it) { if (answers[it.n] === it.answer) correct++; });
    var pct = Math.round(correct / ITEMS.length * 100);
    document.getElementById('rscore').innerHTML = correct + '<small>/' + ITEMS.length + '</small>';
    var msg = pct >= 90 ? '훌륭합니다! 이 유형은 충분히 익숙해졌어요.'
            : pct >= 70 ? '좋습니다. 틀린 문제의 해설과 어휘만 한 번 더 확인해 보세요.'
            : pct >= 50 ? '조금 더 연습이 필요합니다. 틀린 문제만 다시 풀어 보세요.'
            : '해설과 번역을 꼼꼼히 읽은 뒤 다시 도전해 보세요.';
    document.getElementById('rmsg').textContent = '정답률 ' + pct + '% · ' + msg;
    document.getElementById('result').classList.add('show');
    try {
      localStorage.setItem('snult:' + S + K + ':p' + P,
        JSON.stringify({ correct: correct, total: ITEMS.length, at: Date.now() }));
    } catch (e) {}
    var rEl = document.getElementById('result');
    if (rEl.scrollIntoView) rEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.getElementById('again').onclick = function () {
    stopPlay(); answers = {};
    document.getElementById('result').classList.remove('show');
    renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.getElementById('wrongonly').onclick = function () {
    var wrong = ITEMS.filter(function (it) { return answers[it.n] !== it.answer; });
    if (!wrong.length) { alert('틀린 문제가 없습니다. 완벽해요!'); return; }
    stopPlay();
    var keep = wrong.map(function (w) { return w.n; });
    answers = {};
    ITEMS = ITEMS.filter(function (it) { return keep.indexOf(it.n) >= 0; });
    document.getElementById('result').classList.remove('show');
    renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.getElementById('next').onclick = function () {
    var idx = DATA.parts.map(function (x) { return x.id; }).indexOf(P);
    if (idx < DATA.parts.length - 1) location.href = 'practice.html?s=' + S + '&k=' + K + '&p=' + DATA.parts[idx + 1].id;
    else if (K === 'l') location.href = 'practice.html?s=' + S + '&k=r&p=1';
    else if (S === '1') location.href = 'practice.html?s=2&k=l&p=1';
    else location.href = 'index.html';
  };

  var allShown = false;
  document.getElementById('toggleAll').onclick = function () {
    allShown = !allShown;
    document.querySelectorAll('.q').forEach(function (card) {
      var sc = card.querySelector('.script'), hs = card.querySelector('.hidscript'), rev = card.querySelector('.reveal');
      if (!sc) return;
      sc.classList.toggle('hidden', !allShown);
      if (hs) hs.style.display = allShown ? 'none' : '';
      if (rev) rev.textContent = allShown ? '스크립트 가리기' : '스크립트 보기';
    });
    this.textContent = allShown ? '스크립트 모두 가리기' : '스크립트 모두 보기';
  };

  window.addEventListener('beforeunload', function () { SpeechES.stop(); });
  renderAll();
})();
