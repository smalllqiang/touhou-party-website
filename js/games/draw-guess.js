/* ============================================================
 *  小游戏：你画我猜
 *  流程：抽题 -> 确定 -> A(画图) -> B(手写猜词) -> A ... -> 结束
 *  单个 A + 单个 B = 一轮，轮数由 js/config.js 决定
 * ============================================================ */
(function () {
  'use strict';

  var U = window.Utils;

  var DEFAULT_COLORS = ['#000000', '#7a7a7a', '#ffffff', '#e02020', '#ff8c1a',
                        '#ffd400', '#37a745', '#1e88e5', '#8e44ad', '#8b5a2b'];

  /* ---------- 读取并兜底配置 ---------- */
  function getConfig() {
    var raw = (window.GAME_CONFIG && window.GAME_CONFIG.drawGuess) || {};
    var timer = raw.timer || {};
    var toSeconds = function (v, fallback) {
      var n = Number(v);
      return (isFinite(n) && n > 0) ? n : fallback;
    };
    return {
      rounds: Math.max(1, parseInt(raw.rounds, 10) || 3),
      timer: { a: toSeconds(timer.a, 60), b: toSeconds(timer.b, 30) },
      autoNextOnTimeout: raw.autoNextOnTimeout !== false,
      players: raw.players || {},
      colors: (raw.colors && raw.colors.length) ? raw.colors : DEFAULT_COLORS,
      brush: raw.brush || {},
      topics: (raw.topics && raw.topics.length) ? raw.topics.slice() : ['猫']
    };
  }

  function mount(root) {
    var C = getConfig();

    var state = {
      screen: 'setup',          // setup | play | result
      pool: [],
      topic: null,
      round: 1,
      phase: 'A',               // A | B
      artworks: [],             // { round, phase, player, image, blank }
      players: { A: C.players.a || '选手A', B: C.players.b || '选手B' },
      totalRounds: C.rounds,
      board: null,
      intervalId: null,
      pending: [],              // 需要清理的定时器
      paused: false,
      locked: false,
      transitioning: false,
      inputBlockedUntil: 0,
      deadline: 0,
      remaining: 0,
      total: 0,
      lastTickSecond: null,
      destroyed: false
    };

    /* ================= 定时器管理 ================= */
    function later(fn, ms) {
      var id = setTimeout(function () { if (!state.destroyed) fn(); }, ms);
      state.pending.push({ type: 't', id: id });
      return id;
    }

    function every(fn, ms) {
      var id = setInterval(function () { if (!state.destroyed) fn(); }, ms);
      state.pending.push({ type: 'i', id: id });
      return id;
    }

    function clearPending() {
      state.pending.forEach(function (p) {
        if (p.type === 'i') clearInterval(p.id); else clearTimeout(p.id);
      });
      state.pending = [];
    }

    function stopTimer() {
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }

    /* ================= 题目池 ================= */
    function drawTopic() {
      if (!state.pool.length) {
        var rest = C.topics.filter(function (t) { return t !== state.topic; });
        state.pool = U.shuffle(rest.length ? rest : C.topics);
      }
      state.topic = state.pool.pop();
      return state.topic;
    }

    /* ================= 抽题界面 ================= */
    function renderSetup() {
      state.screen = 'setup';
      state.board = null;

      root.innerHTML =
        '<section class="setup">' +
          '<div class="topic-stage">' +
            '<p class="eyebrow">本轮题目</p>' +
            '<div class="topic is-empty" id="topicSlot">点击「抽」按钮抽取一个题目</div>' +
            '<div class="topic-actions">' +
              '<button class="btn primary" id="drawBtn">抽</button>' +
              '<button class="btn" id="redrawBtn" disabled>重来</button>' +
              '<button class="btn blue" id="confirmBtn" disabled>确定</button>' +
            '</div>' +
          '</div>' +
          '<div class="setup-grid">' +
            '<div class="card">' +
              '<h3>选手</h3>' +
              '<div class="field"><label for="playerA">A —— 负责画图</label>' +
                '<input id="playerA" maxlength="12" placeholder="选手A"></div>' +
              '<div class="field"><label for="playerB">B —— 负责看画猜词</label>' +
                '<input id="playerB" maxlength="12" placeholder="选手B"></div>' +
            '</div>' +
            '<div class="card">' +
              '<h3>本局设置</h3>' +
              '<ul class="settings-list">' +
                '<li><span>游戏轮数</span><b>' + state.totalRounds + ' 轮</b></li>' +
                '<li><span>A 阶段倒计时</span><b>' + C.timer.a + ' 秒</b></li>' +
                '<li><span>B 阶段倒计时</span><b>' + C.timer.b + ' 秒</b></li>' +
                '<li><span>时间到</span><b>' + (C.autoNextOnTimeout ? '自动进入下一阶段' : '手动进入下一阶段') + '</b></li>' +
                '<li><span>题目数量</span><b>' + C.topics.length + ' 个</b></li>' +
              '</ul>' +
              '<p class="hint">这些数字和题目列表都在 <code>js/config.js</code> 里改，保存后刷新页面即可。</p>' +
            '</div>' +
            '<div class="card rules">' +
              '<h3>玩法</h3>' +
              '<ol>' +
                '<li>抽到题目后交给 A：第 1 轮 A 按题目画，第 2 轮起 A 按上一轮 B 写的词画。</li>' +
                '<li>B 看画猜词，但答案必须<b>写在画板上</b>，不能打字说出来。</li>' +
                '<li>一个 A + 一个 B 算一轮，共 ' + state.totalRounds + ' 轮。</li>' +
                '<li>结束后展示起始题目与全部作品，可以逐张保存。</li>' +
              '</ol>' +
            '</div>' +
          '</div>' +
        '</section>';

      var slot = root.querySelector('#topicSlot');
      var drawBtn = root.querySelector('#drawBtn');
      var redrawBtn = root.querySelector('#redrawBtn');
      var confirmBtn = root.querySelector('#confirmBtn');
      var playerA = root.querySelector('#playerA');
      var playerB = root.querySelector('#playerB');

      playerA.value = state.players.A;
      playerB.value = state.players.B;

      function updateButtons() {
        var has = !!state.topic;
        redrawBtn.disabled = !has;
        confirmBtn.disabled = !has;
      }

      function roll() {
        var finalTopic = drawTopic();
        var ticks = 0;
        slot.classList.remove('is-empty', 'pop');
        slot.classList.add('rolling');
        updateButtons();

        var spinId = every(function () {
          ticks++;
          slot.textContent = C.topics[Math.floor(Math.random() * C.topics.length)];
          if (ticks >= 14) {
            clearInterval(spinId);
            slot.textContent = finalTopic;
            slot.classList.remove('rolling');
            slot.classList.add('pop');
            U.beep(1046, 90, 0.12);
          }
        }, 55);
      }

      drawBtn.addEventListener('click', roll);
      redrawBtn.addEventListener('click', roll);

      confirmBtn.addEventListener('click', function () {
        if (!state.topic) return;
        state.players.A = (playerA.value || '').trim() || '选手A';
        state.players.B = (playerB.value || '').trim() || '选手B';
        startGame();
      });

      updateButtons();
      return { destroy: destroy };
    }

    function startGame() {
      clearPending();
      state.artworks = [];
      state.round = 1;
      state.phase = 'A';
      U.beep(784, 90, 0.12);
      renderPlay();
    }

    /* ================= 游戏界面 ================= */
    function topicPanelHtml() {
      return '<div class="panel">' +
        '<p class="eyebrow">A 的题目</p>' +
        '<div class="topic-small">' + U.escapeHtml(state.topic) + '</div>' +
        '<p class="muted">把题目画出来，让 B 猜。B 看不到这个题目。</p>' +
        '</div>';
    }

    function refPanelHtml(title, tip, ref) {
      var body;
      if (ref && ref.image) {
        body = '<img class="ref-img" src="' + ref.image + '" alt="参考作品" data-zoom="1">';
      } else {
        body = '<div class="placeholder">这张参考作品是空白的 😅</div>';
      }
      return '<div class="panel">' +
        '<p class="eyebrow">' + U.escapeHtml(title) + '</p>' +
        '<div class="muted" style="margin-top:2px">' + U.escapeHtml(ref && ref.player ? ref.player : '') + '</div>' +
        body +
        '<p class="muted">' + U.escapeHtml(tip) + '</p>' +
        '</div>';
    }

    function isLastPhase() {
      return state.phase === 'B' && state.round >= state.totalRounds;
    }

    function nextButtonLabel() {
      if (state.phase === 'A') return '完成画图，交给 B';
      return isLastPhase() ? '完成猜词，查看作品' : '完成猜词，进入下一轮';
    }

    function phaseInstruction() {
      if (state.phase === 'A') {
        return state.round === 1
          ? 'A 看着左边的题目作画，画完点「完成画图，交给 B」。'
          : 'A 看着左边上一轮 B 写的词作画，画完点「完成画图，交给 B」。';
      }
      return 'B 看左边的画，猜出词以后<b>写在右边画板上</b>（不能打字），写完点完成。';
    }

    function renderPlay() {
      clearPending();
      stopTimer();
      state.screen = 'play';
      state.board = null;
      state.transitioning = false;
      state.paused = false;
      state.locked = false;
      state.lastTickSecond = null;

      var isA = state.phase === 'A';
      var player = state.players[isA ? 'A' : 'B'];
      var ref = state.artworks.length ? state.artworks[state.artworks.length - 1] : null;

      var sideHtml;
      if (isA) {
        sideHtml = (state.round === 1)
          ? topicPanelHtml()
          : refPanelHtml('上一轮 B 写的词', '照着这个词再画一幅，让 B 接着猜。', ref);
      } else {
        sideHtml = refPanelHtml('A 刚刚画的画', '看画猜词，把答案写在右边画板上。', ref);
      }

      root.innerHTML =
        '<section class="play">' +
          '<div class="play-top">' +
            '<div class="play-meta">' +
              '<span class="tag">第 ' + state.round + ' / ' + state.totalRounds + ' 轮</span>' +
              '<span class="tag ' + (isA ? 'a' : 'b') + '">' + (isA ? 'A · 画图' : 'B · 猜词') + '</span>' +
              '<span class="player-name">' + U.escapeHtml(player) + '</span>' +
            '</div>' +
            '<div class="timer" id="timer">' +
              '<span class="timer-value">--:--</span>' +
              '<div class="timer-bar"><i style="width:100%"></i></div>' +
            '</div>' +
          '</div>' +
          '<div class="play-body">' +
            '<aside class="play-side">' +
              sideHtml +
              '<div class="panel">' +
                '<p class="eyebrow">本阶段说明</p>' +
                '<p class="muted" style="margin:8px 0 12px">' + phaseInstruction() + '</p>' +
                '<p class="muted">工具：调色盘选颜色、滑杆调粗细、🧽 橡皮擦、↶ 撤销、🗑 清空。鼠标 / 手指 / 手写笔都可以画。</p>' +
              '</div>' +
            '</aside>' +
            '<div class="play-main">' +
              '<div id="boardHost"></div>' +
              '<div class="play-actions">' +
                '<button class="btn ghost small" id="pauseBtn">暂停</button>' +
                '<button class="btn ghost small" id="quitBtn">结束本局</button>' +
                '<button class="btn primary" id="nextBtn">' + nextButtonLabel() + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="timeup" id="timeup" hidden>' +
            '<div class="timeup-card">' +
              '<div class="big">时间到</div>' +
              '<p class="sub" id="timeupSub"></p>' +
              '<button class="btn primary" id="timeupBtn">下一步</button>' +
            '</div>' +
          '</div>' +
        '</section>';

      /* --- 画板 --- */
      state.board = window.DrawingBoard.create(root.querySelector('#boardHost'), {
        colors: C.colors,
        brush: C.brush
      });

      /* --- 参考图放大 --- */
      Array.prototype.forEach.call(root.querySelectorAll('[data-zoom]'), function (img) {
        img.addEventListener('click', function () { U.openLightbox(img.src); });
      });

      /* --- 按钮 --- */
      root.querySelector('#pauseBtn').addEventListener('click', togglePause);
      root.querySelector('#quitBtn').addEventListener('click', quitGame);
      root.querySelector('#nextBtn').addEventListener('click', requestNextPhase);
      root.querySelector('#timeupBtn').addEventListener('click', function () {
        clearPending();
        nextPhase();
      });

      startTimer();
      // 防止「双击」误触下一个阶段
      state.inputBlockedUntil = now() + 450;
    }

    /* ================= 计时 ================= */
    function phaseSeconds() {
      return state.phase === 'A' ? C.timer.a : C.timer.b;
    }

    function startTimer() {
      stopTimer();
      state.total = phaseSeconds();
      state.remaining = state.total;
      state.deadline = now() + state.total * 1000;
      state.intervalId = setInterval(tick, 100);
      paintTimer();
    }

    function now() {
      return (window.performance && performance.now) ? performance.now() : Date.now();
    }

    function tick() {
      if (state.destroyed || state.paused || state.locked) return;
      var left = Math.max(0, (state.deadline - now()) / 1000);
      state.remaining = left;
      paintTimer();

      var whole = Math.ceil(left);
      if (whole > 0 && whole <= 5 && whole !== state.lastTickSecond) {
        state.lastTickSecond = whole;
        U.beep(880, 70, 0.1);
      }
      if (left <= 0) onTimeUp();
    }

    function paintTimer() {
      var box = root.querySelector('#timer');
      if (!box) return;
      var valueEl = box.querySelector('.timer-value');
      var barEl = box.querySelector('.timer-bar i');
      var left = state.remaining;
      valueEl.textContent = U.formatTime(left);
      var ratio = state.total > 0 ? Math.max(0, Math.min(1, left / state.total)) : 0;
      barEl.style.width = (ratio * 100).toFixed(1) + '%';
      box.classList.toggle('warn', !state.paused && left <= 10 && left > 0);
      box.classList.toggle('paused', state.paused);
    }

    function togglePause() {
      if (state.locked) return;
      var btn = root.querySelector('#pauseBtn');
      if (state.paused) {
        state.paused = false;
        state.deadline = now() + state.remaining * 1000;
        if (btn) btn.textContent = '暂停';
      } else {
        state.paused = true;
        state.remaining = Math.max(0, (state.deadline - now()) / 1000);
        if (btn) btn.textContent = '继续';
      }
      if (state.board) state.board.setPaused(state.paused);
      paintTimer();
    }

    function onTimeUp() {
      stopTimer();
      state.locked = true;
      state.remaining = 0;
      paintTimer();
      if (state.board) state.board.setLocked(true);
      U.beep(659, 200, 0.18);
      later(function () { U.beep(523, 320, 0.18); }, 210);
      U.vibrate([120, 60, 120]);

      var overlay = root.querySelector('#timeup');
      var sub = root.querySelector('#timeupSub');
      if (!overlay) return;
      sub.innerHTML = '「' + U.escapeHtml(state.players[state.phase]) + '」的' +
        (state.phase === 'A' ? '画图' : '猜词') + '时间结束了。';
      overlay.hidden = false;

      if (C.autoNextOnTimeout) {
        sub.innerHTML += '<br>约 1.6 秒后自动进入下一步…';
        later(function () { nextPhase(); }, 1600);
      }
    }

    /* ================= 阶段推进 ================= */
    function requestNextPhase() {
      if (now() < (state.inputBlockedUntil || 0)) return;
      if (state.locked) { nextPhase(); return; }
      if (state.board && !state.board.hasInk()) {
        if (!window.confirm('画板还是空白的，确定要进入下一阶段吗？')) return;
      }
      nextPhase();
    }

    function captureCurrent() {
      if (!state.board) return;
      state.artworks.push({
        round: state.round,
        phase: state.phase,
        player: state.players[state.phase],
        image: state.board.toDataURL(),
        blank: !state.board.hasInk()
      });
      state.board = null;
    }

    function nextPhase() {
      if (state.transitioning || state.destroyed) return;
      state.transitioning = true;
      clearPending();
      stopTimer();
      captureCurrent();

      if (state.phase === 'A') {
        state.phase = 'B';
        renderPlay();
        return;
      }
      if (state.round >= state.totalRounds) {
        renderResult();
        return;
      }
      state.round += 1;
      state.phase = 'A';
      renderPlay();
    }

    function quitGame() {
      if (!window.confirm('结束本局并查看已有作品？')) return;
      clearPending();
      stopTimer();
      if (state.board && state.board.hasInk()) captureCurrent();
      state.transitioning = true;
      renderResult();
    }

    /* ================= 结果界面 ================= */
    function renderResult() {
      clearPending();
      stopTimer();
      state.screen = 'result';
      state.board = null;
      state.transitioning = false;

      var cards = state.artworks.map(function (a, i) {
        var phaseText = a.phase === 'A' ? '画图' : '猜词（手写）';
        var body = a.image
          ? '<img src="' + a.image + '" alt="作品" data-zoom="1">'
          : '<div class="blank-hint">没有留下作品</div>';
        return '<li class="artwork-card">' +
            '<div class="artwork-meta">' +
              '<span class="tag">第 ' + a.round + ' 轮</span>' +
              '<span class="tag ' + (a.phase === 'A' ? 'a' : 'b') + '">' + a.phase + ' · ' + phaseText + '</span>' +
              '<span class="player-name">' + U.escapeHtml(a.player) + '</span>' +
              (a.blank ? '<span class="tag">空白</span>' : '') +
            '</div>' +
            body +
            '<div class="artwork-foot">' +
              '<span class="order">第 ' + (i + 1) + ' 张 / 共 ' + state.artworks.length + ' 张</span>' +
              '<button class="btn small" data-save="' + i + '">保存这张</button>' +
            '</div>' +
          '</li>';
      }).join('');

      root.innerHTML =
        '<section class="result">' +
          '<div class="result-head">' +
            '<p class="eyebrow">本局起始题目</p>' +
            '<h2 class="result-topic">' + U.escapeHtml(state.topic || '—') + '</h2>' +
            '<p class="muted">共 ' + state.totalRounds + ' 轮 · ' +
              U.escapeHtml(state.players.A) + ' 画图 / ' + U.escapeHtml(state.players.B) + ' 猜词 · ' +
              '共 ' + state.artworks.length + ' 张作品</p>' +
            '<div class="result-actions">' +
              '<button class="btn" id="saveAllBtn">保存全部作品</button>' +
              '<button class="btn primary" id="againBtn">再玩一局（重新抽题）</button>' +
            '</div>' +
          '</div>' +
          (state.artworks.length
            ? '<ol class="artworks">' + cards + '</ol>'
            : '<div class="card"><p class="muted">本局没有留下任何作品。</p></div>') +
        '</section>';

      Array.prototype.forEach.call(root.querySelectorAll('[data-zoom]'), function (img) {
        img.addEventListener('click', function () { U.openLightbox(img.src); });
      });

      Array.prototype.forEach.call(root.querySelectorAll('[data-save]'), function (btn) {
        btn.addEventListener('click', function () {
          var a = state.artworks[Number(btn.getAttribute('data-save'))];
          if (!a) return;
          U.download(a.image, fileNameFor(a));
        });
      });

      var saveAllBtn = root.querySelector('#saveAllBtn');
      saveAllBtn.disabled = !state.artworks.length;
      saveAllBtn.addEventListener('click', function () {
        saveAllBtn.disabled = true;
        var original = saveAllBtn.textContent;
        state.artworks.forEach(function (a, i) {
          later(function () {
            U.download(a.image, fileNameFor(a));
            if (i === state.artworks.length - 1) {
              saveAllBtn.disabled = false;
              saveAllBtn.textContent = original;
              U.beep(988, 90, 0.1);
            }
          }, i * 350);
        });
        saveAllBtn.textContent = '保存中…（若浏览器拦截，请允许多文件下载）';
      });

      root.querySelector('#againBtn').addEventListener('click', function () {
        clearPending();
        state.artworks = [];
        state.round = 1;
        state.phase = 'A';
        state.topic = null;
        state.pool = [];
        renderSetup();
      });

      U.beep(880, 120, 0.12);
      later(function () { U.beep(1174, 200, 0.12); }, 130);
    }

    function fileNameFor(a) {
      var phaseText = a.phase === 'A' ? '画图' : '猜词';
      return U.safeFileName('第' + a.round + '轮-' + a.phase + phaseText + '-' + a.player) + '.png';
    }

    /* ================= 卸载 ================= */
    function destroy() {
      state.destroyed = true;
      clearPending();
      stopTimer();
      state.board = null;
      root.innerHTML = '';
    }

    renderSetup();
    return { destroy: destroy };
  }

  window.DrawGuessGame = { mount: mount };
})();
