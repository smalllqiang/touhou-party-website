/* ============================================================
 *  小游戏：谁是卧底
 *  ------------------------------------------------------------
 *  流程：设置人数 -> 抽一组词 -> 发 n 张卡片 -> 依次按住查看
 *  规则：n 个人里只有 1 个人（卧底）拿到的词和别人不一样。
 *
 *  卡片操作：
 *    · 按住卡片上的按钮 -> 显示这个词和配图，松手就盖回去
 *    · 卡片外的按钮     -> 一键翻开 / 扣上全部卡片（永久，直到再点一次）
 *
 *  只做抽取和展示，不判断输赢。
 * ============================================================ */
(function () {
  'use strict';

  var U = window.Utils;

  function esc(str) { return U.escapeHtml(str); }

  /* ============================================================
   *  题目归一化：把 config 里各种写法统一成 { text, image }
   * ============================================================ */

  function joinPath(dir, file) {
    if (!file) return '';
    // 完整路径 / 外链 / dataURL 原样使用
    if (/^(https?:|data:|blob:|\/)/i.test(file)) return file;
    // 自带目录的相对路径原样使用
    if (file.indexOf('/') >= 0) return file;
    return String(dir || '').replace(/\/+$/, '/') + file;
  }

  /* 一个「词」支持：
   *   '可乐'
   *   ['可乐', 'cola.png']
   *   { text: '可乐', image: 'cola.png' }（word / name / img / src 也认）
   * 没写图片时，自动用「词 + 后缀」当文件名。 */
  function normalizeWord(value, explicitImage, dir, ext) {
    var text = '';
    var image = explicitImage || '';

    if (value == null) {
      return { text: '', image: '' };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      text = String(value);
    } else if (Object.prototype.toString.call(value) === '[object Array]') {
      text = value[0] == null ? '' : String(value[0]);
      if (!image && value[1]) image = String(value[1]);
    } else if (typeof value === 'object') {
      text = String(value.text || value.word || value.name || value.label || '');
      if (!image) image = value.image || value.img || value.src || value.picture || '';
    }

    if (!image && text) image = text + ext;
    return { text: text, image: joinPath(dir, image) };
  }

  /* 一组题支持：
   *   { normal: '可乐', spy: '雪碧' }
   *   { normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' }
   *   { normal: { text: '可乐', image: 'cola.png' }, spy: { text: '雪碧', image: 'sprite.png' } }
   *   ['可乐', '雪碧', 'cola.png', 'sprite.png'] */
  function normalizeTopics(list, dir, ext) {
    if (Object.prototype.toString.call(list) !== '[object Array]') return [];

    var out = [];
    list.forEach(function (item) {
      if (!item) return;

      var normalValue, spyValue, normalImage = '', spyImage = '';

      if (Object.prototype.toString.call(item) === '[object Array]') {
        normalValue = item[0];
        spyValue = item[1];
        normalImage = item[2] || '';
        spyImage = item[3] || '';
      } else if (typeof item === 'object') {
        normalValue = item.normal !== undefined ? item.normal
                    : (item.civilian !== undefined ? item.civilian : item.normalWord);
        spyValue = item.spy !== undefined ? item.spy
                 : (item.undercover !== undefined ? item.undercover
                 : (item.different !== undefined ? item.different : item.spyWord));
        normalImage = item.normalImage || item.normalImg || item.civilianImage || '';
        spyImage = item.spyImage || item.spyImg || item.undercoverImage || '';
      } else {
        return;
      }

      var normal = normalizeWord(normalValue, normalImage, dir, ext);
      var spy = normalizeWord(spyValue, spyImage, dir, ext);

      if (normal.text && spy.text) out.push({ normal: normal, spy: spy });
    });
    return out;
  }

  /* ============================================================
   *  读取并兜底配置
   * ============================================================ */
  function getConfig() {
    var raw = (window.GAME_CONFIG && window.GAME_CONFIG.undercover) || {};

    function toInt(value, fallback) {
      var n = parseInt(value, 10);
      return isFinite(n) ? n : fallback;
    }

    var minPlayers = Math.max(3, toInt(raw.minPlayers, 3));
    var maxPlayers = Math.max(minPlayers, toInt(raw.maxPlayers, 12));
    var players = Math.max(minPlayers, Math.min(maxPlayers, toInt(raw.players, 4)));

    var imageDir = (typeof raw.imageDir === 'string' && raw.imageDir)
      ? raw.imageDir : 'images/undercover/';
    var imageExt = (typeof raw.imageExt === 'string' && raw.imageExt)
      ? raw.imageExt : '.png';

    return {
      minPlayers: minPlayers,
      maxPlayers: maxPlayers,
      players: players,
      names: (Object.prototype.toString.call(raw.names) === '[object Array]') ? raw.names.slice() : [],
      imageDir: imageDir,
      imageExt: imageExt,
      topics: normalizeTopics(raw.topics, imageDir, imageExt)
    };
  }

  /* ============================================================
   *  挂载
   * ============================================================ */
  function mount(root) {
    var C = getConfig();

    var state = {
      screen: 'setup',      // setup | reveal
      count: C.players,     // 玩家人数
      names: [],            // 玩家名（长度不一定等于 count）
      topic: null,          // { normal:{text,image}, spy:{text,image} }
      pool: [],             // 抽题池（避免连着抽到同一组）
      topicVisible: false,  // 主持人是否查看本题
      assignments: [],      // [{ name, isSpy, word }]
      spyIndex: -1,
      seen: [],             // 每张卡片是否被查看过
      allRevealed: false,   // 一键翻开（永久）
      peekIndex: -1,        // 当前按住查看的卡片下标
      destroyed: false
    };

    var cardEls = [];

    /* ================= 玩家名字 ================= */
    function defaultName(i) {
      var custom = C.names[i];
      if (custom != null && String(custom).trim()) return String(custom).trim();
      return '玩家' + (i + 1);
    }

    /* 补齐前 count 个名字，多余的位置保留（改小再改大不会丢） */
    function syncNames() {
      for (var i = 0; i < state.count; i++) {
        if (state.names[i] == null || !String(state.names[i]).trim()) {
          state.names[i] = defaultName(i);
        }
      }
    }

    function nameAt(i) {
      var n = state.names[i];
      return (n != null && String(n).trim()) ? String(n).trim() : defaultName(i);
    }

    /* ================= 抽题 ================= */
    function drawTopic() {
      if (!C.topics.length) { state.topic = null; return null; }
      if (!state.pool.length) {
        var rest = C.topics.filter(function (t) { return t !== state.topic; });
        state.pool = U.shuffle(rest.length ? rest : C.topics);
      }
      state.topic = state.pool.pop();
      return state.topic;
    }

    /* ================= 发牌 ================= */
    function deal() {
      var n = state.count;
      var spyIndex = Math.floor(Math.random() * n);

      state.spyIndex = spyIndex;
      state.assignments = [];
      state.seen = [];

      for (var i = 0; i < n; i++) {
        var isSpy = (i === spyIndex);
        state.assignments.push({
          name: nameAt(i),
          isSpy: isSpy,
          word: isSpy ? state.topic.spy : state.topic.normal
        });
        state.seen.push(false);
      }

      state.allRevealed = false;
      state.peekIndex = -1;
    }

    /* ============================================================
     *  界面一：设置 + 抽题
     * ============================================================ */
    function renderSetup() {
      state.screen = 'setup';
      cardEls = [];

      root.innerHTML =
        '<section class="uc-setup">' +
          '<div class="topic-stage">' +
            '<p class="eyebrow">第一步 · 抽题</p>' +
            '<div class="uc-topic is-empty" id="ucTopicSlot"></div>' +
            '<div class="topic-actions">' +
              '<button class="btn primary" id="ucDrawBtn">抽题</button>' +
              '<button class="btn" id="ucRedrawBtn" disabled>换一题</button>' +
              '<button class="btn ghost" id="ucPeekBtn" disabled>👀 查看本题</button>' +
              '<button class="btn blue" id="ucStartBtn" disabled>开始发牌</button>' +
            '</div>' +
          '</div>' +

          /* 题目列表：平时折叠着，需要时展开手动指定一组 */
          '<details class="uc-picker" id="ucPicker"' + (C.topics.length ? '' : ' hidden') + '>' +
            '<summary>' +
              '<span class="uc-picker-title">📋 题目列表</span>' +
              '<span class="uc-picker-sub">' + C.topics.length + ' 组 · 展开可以直接指定某一组</span>' +
              '<span class="uc-picker-caret">▾</span>' +
            '</summary>' +
            '<div class="uc-picker-body">' +
              '<p class="uc-picker-tip">左边是<b>普通玩家</b>看到的词，右边是<b>卧底</b>看到的词。点一组就直接用它出题。</p>' +
              '<div class="uc-pick-list" id="ucPickList"></div>' +
            '</div>' +
          '</details>' +

          '<div class="setup-grid">' +
            '<div class="card">' +
              '<h3>玩家人数</h3>' +
              '<div class="uc-stepper">' +
                '<button type="button" class="uc-step-btn" id="ucMinus" aria-label="减少一人">−</button>' +
                '<input type="number" id="ucCount" inputmode="numeric" min="' + C.minPlayers + '" max="' + C.maxPlayers + '">' +
                '<button type="button" class="uc-step-btn" id="ucPlus" aria-label="增加一人">+</button>' +
                '<span class="muted">人</span>' +
              '</div>' +
              '<p class="muted uc-count-tip" id="ucCountTip"></p>' +
              '<div class="uc-names" id="ucNames"></div>' +
            '</div>' +

            '<div class="card">' +
              '<h3>本局设置</h3>' +
              '<ul class="settings-list" id="ucStats"></ul>' +
              '<p class="hint">人数、默认名字、图片文件夹和题目列表都在 <code>js/config.js</code> 的 <code>undercover</code> 段里改，保存后刷新页面即可。</p>' +
            '</div>' +

            '<div class="card rules">' +
              '<h3>玩法</h3>' +
              '<ol>' +
                '<li>抽一组词再发牌：每人一张卡片，其中<b>只有 1 张</b>卡片的词和别人不一样。</li>' +
                '<li>大家轮流拿起设备，<b>按住</b>自己卡片上的按钮看词和配图，松开就盖回去，别被别人瞄到。</li>' +
                '<li>看完后每人用一句话描述自己的词（不能直接说出来），然后投票找出卧底。</li>' +
                '<li>想公布答案，点卡片外的「一键翻开全部卡片」；再点一次就全部扣上。</li>' +
              '</ol>' +
            '</div>' +
          '</div>' +
        '</section>';

      var input = root.querySelector('#ucCount');

      root.querySelector('#ucDrawBtn').addEventListener('click', roll);
      root.querySelector('#ucRedrawBtn').addEventListener('click', roll);
      root.querySelector('#ucStartBtn').addEventListener('click', function () {
        if (!state.topic) return;
        startReveal();
      });
      root.querySelector('#ucPeekBtn').addEventListener('click', function () {
        state.topicVisible = !state.topicVisible;
        paintSetup();
      });

      root.querySelector('#ucMinus').addEventListener('click', function () { applyCount(state.count - 1); });
      root.querySelector('#ucPlus').addEventListener('click', function () { applyCount(state.count + 1); });
      input.addEventListener('change', function () { applyCount(input.value); });
      input.addEventListener('blur', function () { applyCount(input.value); });

      buildPicker();
      paintSetup();
    }

    function applyCount(value) {
      var n = parseInt(value, 10);
      if (!isFinite(n)) n = state.count;
      n = Math.max(C.minPlayers, Math.min(C.maxPlayers, n));
      if (n === state.count) { paintCount(); return; }
      state.count = n;
      syncNames();
      paintSetup();
    }

    function paintSetup() {
      if (state.screen !== 'setup') return;

      var drawBtn = root.querySelector('#ucDrawBtn');
      if (!drawBtn) return;

      var hasTopics = C.topics.length > 0;
      var hasTopic = !!state.topic;

      drawBtn.disabled = !hasTopics;
      root.querySelector('#ucRedrawBtn').disabled = !hasTopic;
      var peekBtn = root.querySelector('#ucPeekBtn');
      peekBtn.disabled = !hasTopic;
      peekBtn.textContent = state.topicVisible ? '🙈 隐藏本题' : '👀 查看本题';
      var startBtn = root.querySelector('#ucStartBtn');
      startBtn.disabled = !hasTopic;
      startBtn.textContent = '开始发牌（' + state.count + ' 张卡片）';

      paintTopicSlot();
      paintPicker();
      paintCount();
    }

    function paintTopicSlot() {
      var slot = root.querySelector('#ucTopicSlot');
      if (!slot) return;

      if (!C.topics.length) {
        slot.className = 'uc-topic is-empty';
        slot.innerHTML = '<span>题目列表是空的 😢</span>' +
          '<span class="muted">请在 js/config.js 的 undercover.topics 里添加题目</span>';
        return;
      }

      if (!state.topic) {
        slot.className = 'uc-topic is-empty';
        slot.innerHTML = '<span>点击「抽题」随机抽一组词</span>';
        return;
      }

      if (state.topicVisible) {
        slot.className = 'uc-topic is-shown';
        slot.innerHTML =
          '<div class="uc-topic-row"><span class="tag">普通玩家 ×' + (state.count - 1) + '</span>' +
            '<b>' + esc(state.topic.normal.text) + '</b></div>' +
          '<div class="uc-topic-row spy"><span class="tag a">卧底 ×1</span>' +
            '<b>' + esc(state.topic.spy.text) + '</b></div>';
      } else {
        slot.className = 'uc-topic is-hidden';
        slot.innerHTML =
          '<span class="uc-topic-ok">✅ 已抽到题目</span>' +
          '<span class="muted">先藏着不剧透 · 点「查看本题」主持人可以确认</span>';
      }
    }

    function paintCount() {
      var input = root.querySelector('#ucCount');
      if (!input) return;

      input.value = state.count;
      root.querySelector('#ucMinus').disabled = (state.count <= C.minPlayers);
      root.querySelector('#ucPlus').disabled = (state.count >= C.maxPlayers);

      var tip = root.querySelector('#ucCountTip');
      tip.textContent = state.count + ' 人：1 名卧底 + ' + (state.count - 1) + ' 名普通玩家';

      root.querySelector('#ucStats').innerHTML =
        '<li><span>玩家人数</span><b>' + state.count + ' 人</b></li>' +
        '<li><span>卧底</span><b>1 人</b></li>' +
        '<li><span>普通玩家</span><b>' + (state.count - 1) + ' 人</b></li>' +
        '<li><span>题目数量</span><b>' + C.topics.length + ' 组</b></li>' +
        '<li><span>卡片翻开</span><b>按住查看 / 一键全开</b></li>';

      paintNames();
    }

    function paintNames() {
      var host = root.querySelector('#ucNames');
      if (!host) return;

      var html = '';
      for (var i = 0; i < state.count; i++) {
        html += '<label class="uc-name-field">' +
            '<span>' + (i + 1) + '</span>' +
            '<input type="text" maxlength="12" data-name="' + i + '" value="' + esc(nameAt(i)) + '" ' +
              'placeholder="' + esc('玩家' + (i + 1)) + '">' +
          '</label>';
      }
      host.innerHTML = html;

      Array.prototype.forEach.call(host.querySelectorAll('[data-name]'), function (inp) {
        inp.addEventListener('input', function () {
          state.names[Number(inp.getAttribute('data-name'))] = inp.value;
        });
      });
    }

    /* ---------- 题目列表：手动指定某一组 ---------- */
    function buildPicker() {
      var host = root.querySelector('#ucPickList');
      if (!host) return;

      host.innerHTML = C.topics.map(function (t, i) {
        return '<button type="button" class="uc-pick-item" data-pick="' + i + '">' +
            '<span class="uc-pick-no">' + (i + 1) + '</span>' +
            '<span class="uc-pick-word">' + esc(t.normal.text) + '</span>' +
            '<span class="uc-pick-sep">/</span>' +
            '<span class="uc-pick-word spy">' + esc(t.spy.text) + '</span>' +
          '</button>';
      }).join('');

      Array.prototype.forEach.call(host.querySelectorAll('[data-pick]'), function (btn) {
        btn.addEventListener('click', function () {
          pickTopic(Number(btn.getAttribute('data-pick')));
        });
      });
    }

    /* 只更新高亮，不重建列表（否则调人数时会把列表的滚动位置顶回去） */
    function paintPicker() {
      var host = root.querySelector('#ucPickList');
      if (!host) return;
      Array.prototype.forEach.call(host.querySelectorAll('[data-pick]'), function (btn) {
        var t = C.topics[Number(btn.getAttribute('data-pick'))];
        btn.classList.toggle('is-active', !!t && t === state.topic);
      });
    }

    function pickTopic(index) {
      var t = C.topics[index];
      if (!t) return;

      state.topic = t;
      state.topicVisible = false;
      // 从抽题池里拿掉，免得接着点「抽题」又抽到刚手动选的这一组
      state.pool = state.pool.filter(function (x) { return x !== t; });

      paintSetup();
      var picker = root.querySelector('#ucPicker');
      if (picker) picker.open = false;   // 选完自动收起，免得被围观的人看光
      U.beep(988, 90, 0.12);
    }

    /* 抽题：点一下直接出结果。
     * 这里以前有个「滚动显示」的动画，但滚动时会一闪而过地掠过题目池里的
     * 其他词，等于把可能的题目透露出去了，所以去掉了。 */
    function roll() {
      if (!C.topics.length) return;
      drawTopic();
      state.topicVisible = false;
      paintSetup();
      U.beep(1046, 90, 0.12);
    }

    function startReveal() {
      deal();
      renderReveal();
    }

    /* ============================================================
     *  界面二：发牌 + 依次查看
     * ============================================================ */
    function mediaHtml(word) {
      if (!word.image) {
        return '<div class="uc-img-missing"><span>🖼️</span><b>没有配图</b>' +
          '<i>在 config.js 里给这个词写 image</i></div>';
      }
      return '<img class="uc-img" src="' + esc(word.image) + '" alt="' + esc(word.text) + '">' +
        '<div class="uc-img-missing" hidden><span>🖼️</span><b>图片待补充</b>' +
          '<i>' + esc(word.image) + '</i></div>';
    }

    function cardHtml(a, i) {
      return '<div class="uc-card" data-index="' + i + '">' +
        '<div class="uc-card-inner">' +

          '<div class="uc-card-face uc-card-cover">' +
            '<div class="uc-card-no">' + (i + 1) + '</div>' +
            '<div class="uc-card-name">' + esc(a.name) + '</div>' +
            '<div class="uc-card-cover-icon">🎴</div>' +
            '<button type="button" class="uc-hold-btn" data-hold="' + i + '">按住查看我的词</button>' +
            '<div class="uc-card-seen" hidden>✓ 已查看</div>' +
          '</div>' +

          '<div class="uc-card-face uc-card-back">' +
            '<div class="uc-card-role"></div>' +
            '<div class="uc-card-word">' + esc(a.word.text) + '</div>' +
            '<div class="uc-card-media">' + mediaHtml(a.word) + '</div>' +
          '</div>' +

        '</div>' +
      '</div>';
    }

    function renderReveal() {
      state.screen = 'reveal';
      state.peekIndex = -1;

      var n = state.assignments.length;

      root.innerHTML =
        '<section class="uc-reveal">' +
          '<div class="uc-reveal-top">' +
            '<div class="uc-reveal-meta">' +
              '<span class="tag">共 ' + n + ' 张卡片</span>' +
              '<span class="tag b">1 名卧底 · ' + (n - 1) + ' 名普通玩家</span>' +
              '<span class="muted">依次传阅：按住按钮看词，松手自动盖回</span>' +
            '</div>' +
            '<div class="uc-reveal-actions">' +
              '<button class="btn blue" id="ucFlipBtn">👀 一键翻开全部卡片</button>' +
              '<button class="btn ghost small" id="ucRedealBtn">换一题重发</button>' +
              '<button class="btn ghost small" id="ucSetupBtn">返回设置</button>' +
            '</div>' +
          '</div>' +

          '<div class="uc-banner" id="ucBanner" hidden></div>' +

          '<div class="uc-cards" id="ucCards">' +
            state.assignments.map(cardHtml).join('') +
          '</div>' +

          '<p class="uc-foot muted">卡片序号和玩家顺序一致。谁拿到的词不一样，翻开才知道；' +
            '玩完点「一键翻开全部卡片」公布答案，再点一次可以全部扣上。</p>' +
        '</section>';

      cardEls = Array.prototype.slice.call(root.querySelectorAll('.uc-card'));
      bindReveal();
      paintReveal();
      U.beep(784, 90, 0.12);
    }

    function bindReveal() {
      cardEls.forEach(function (card) {
        var i = Number(card.getAttribute('data-index'));

        /* 图片缺失时给出占位提示（不影响看词） */
        var img = card.querySelector('.uc-img');
        var missing = card.querySelector('.uc-img-missing');
        if (img) {
          var showMissing = function () {
            img.hidden = true;
            if (missing) missing.hidden = false;
          };
          img.addEventListener('error', showMissing);
          if (img.complete && img.naturalWidth === 0) showMissing();
        }

        var btn = card.querySelector('[data-hold]');
        if (btn) bindHold(btn, i);
      });

      root.querySelector('#ucFlipBtn').addEventListener('click', flipAll);
      root.querySelector('#ucRedealBtn').addEventListener('click', function () {
        if (!C.topics.length) return;
        drawTopic();
        deal();
        renderReveal();
      });
      root.querySelector('#ucSetupBtn').addEventListener('click', function () {
        state.allRevealed = false;
        state.peekIndex = -1;
        renderSetup();
      });
    }

    /* ---------- 按住查看 ---------- */
    function openPeek(i) {
      if (state.destroyed || state.allRevealed) return;
      if (state.peekIndex === i) return;
      state.peekIndex = i;
      state.seen[i] = true;
      paintReveal();
    }

    function closePeek(i) {
      if (state.peekIndex !== i) return;
      state.peekIndex = -1;
      paintReveal();
    }

    function bindHold(btn, i) {
      btn.addEventListener('pointerdown', function (e) {
        if (state.allRevealed) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();          // 防止长按选中文字 / 弹出菜单
        openPeek(i);

        // 把这一根手指「锁」在按钮上。
        // 卡片一开始翻转，按钮就被转到指针命中范围之外，浏览器会跟着补发
        // pointerout / pointerleave；不锁住的话，卡片会刚翻开就被自己关掉。
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件等场景忽略 */ }

        var pointerId = e.pointerId;
        var end = function (ev) {
          window.removeEventListener('pointerup', end, true);
          window.removeEventListener('pointercancel', end, true);
          if (ev && ev.pointerId != null && pointerId != null && ev.pointerId !== pointerId) return;
          closePeek(i);
        };
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', end, true);
      });

      // 兜底：指针捕获意外丢失时也盖回去
      btn.addEventListener('lostpointercapture', function () { closePeek(i); });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      btn.addEventListener('blur', function () { closePeek(i); });

      // 注意：这里故意「不」监听 pointerleave / pointerout。
      // 翻转动画本身就会把按钮转到指针底下之外并触发一次假的 leave，
      // 监听它会让卡片刚翻开就立刻合上。

      // 键盘：空格 / 回车 按住
      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
          e.preventDefault();
          openPeek(i);
        }
      });
      btn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') closePeek(i);
      });
    }

    /* ---------- 一键翻开 / 扣上（永久） ---------- */
    function flipAll() {
      state.allRevealed = !state.allRevealed;
      state.peekIndex = -1;
      U.beep(state.allRevealed ? 988 : 523, 110, 0.12);
      paintReveal();
    }

    function paintReveal() {
      if (state.screen !== 'reveal') return;

      state.assignments.forEach(function (a, i) {
        var card = cardEls[i];
        if (!card) return;

        var open = state.allRevealed || state.peekIndex === i;
        card.classList.toggle('is-open', open);
        card.classList.toggle('is-spy', state.allRevealed && a.isSpy);

        var role = card.querySelector('.uc-card-role');
        if (role) role.textContent = state.allRevealed ? (a.isSpy ? '卧底' : '普通玩家') : '';

        var seen = card.querySelector('.uc-card-seen');
        if (seen) seen.hidden = !state.seen[i];
      });

      var flipBtn = root.querySelector('#ucFlipBtn');
      if (flipBtn) {
        flipBtn.textContent = state.allRevealed
          ? '🙈 一键扣上全部卡片'
          : '👀 一键翻开全部卡片';
      }

      var banner = root.querySelector('#ucBanner');
      if (banner) {
        if (state.allRevealed && state.spyIndex >= 0) {
          var spy = state.assignments[state.spyIndex];
          banner.hidden = false;
          banner.innerHTML =
            '🕵️ 本局卧底是 <b>' + esc(spy.name) + '</b>' +
            '<span class="uc-banner-words">卧底词「' + esc(spy.word.text) + '」 · ' +
            '普通词「' + esc(state.topic.normal.text) + '」</span>';
        } else {
          banner.hidden = true;
          banner.innerHTML = '';
        }
      }
    }

    /* ---------- 切到后台时自动盖回 ---------- */
    function onLeave() {
      if (state.peekIndex >= 0) {
        state.peekIndex = -1;
        paintReveal();
      }
    }
    window.addEventListener('blur', onLeave);
    document.addEventListener('visibilitychange', onLeave);

    /* ================= 卸载 ================= */
    function destroy() {
      state.destroyed = true;
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onLeave);
      cardEls = [];
      root.innerHTML = '';
    }

    syncNames();
    renderSetup();

    return { destroy: destroy };
  }

  window.UndercoverGame = { mount: mount };
})();
