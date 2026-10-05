/* ============================================================
 *  应用入口：渲染左侧导航、切换右侧内容区
 *  新增小游戏时，在 GAMES 里加一项即可（页面标题、副标题、导航都来自这里）
 * ============================================================ */
(function () {
  'use strict';

  var GAMES = [
    {
      id: 'draw-guess',
      name: '你画我猜',
      icon: '🎨',
      desc: '抽题 · 计时 · 画板',
      title: '你画我猜',
      subtitle: '抽题目、限时作画、看画猜词，结束后可以保存每个人的作品',
      mount: function (host) { return window.DrawGuessGame.mount(host); }
    }
    // 以后新增小游戏：
    // {
    //   id: 'werewolf', name: '狼人杀', icon: '🐺', desc: '身份 · 发言 · 计时',
    //   title: '狼人杀', subtitle: '……',
    //   mount: function (host) { return window.WerewolfGame.mount(host); }
    // }
  ];

  var navEl = document.getElementById('nav');
  var viewEl = document.getElementById('view');
  var titleEl = document.getElementById('pageTitle');
  var subtitleEl = document.getElementById('pageSubtitle');
  var body = document.body;
  var current = null;

  function renderNav(activeId) {
    navEl.innerHTML = '';
    GAMES.forEach(function (game) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-item' + (game.id === activeId ? ' is-active' : '');
      btn.innerHTML =
        '<span class="nav-icon">' + game.icon + '</span>' +
        '<span class="nav-text">' +
          '<span class="nav-name">' + game.name + '</span>' +
          '<span class="nav-desc">' + game.desc + '</span>' +
        '</span>';
      btn.addEventListener('click', function () {
        body.classList.remove('nav-open');
        open(game.id);
      });
      navEl.appendChild(btn);
    });
  }

  function open(id) {
    var game = GAMES.filter(function (g) { return g.id === id; })[0] || GAMES[0];

    if (current && typeof current.destroy === 'function') {
      current.destroy();
    }
    current = null;

    viewEl.innerHTML = '';
    titleEl.textContent = game.title || game.name;
    subtitleEl.textContent = game.subtitle || game.desc || '';
    document.title = game.name + ' · 小游戏工具箱';

    current = game.mount(viewEl) || {};
    renderNav(game.id);

    if (('#/' + game.id) !== location.hash) {
      try { history.replaceState(null, '', '#/' + game.id); } catch (e) { location.hash = '#/' + game.id; }
    }
  }

  /* 侧边栏开关（窄屏） */
  var menuBtn = document.getElementById('menuBtn');
  var backdrop = document.getElementById('backdrop');
  if (menuBtn) menuBtn.addEventListener('click', function () { body.classList.toggle('nav-open'); });
  if (backdrop) backdrop.addEventListener('click', function () { body.classList.remove('nav-open'); });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') body.classList.remove('nav-open');
  });

  window.addEventListener('hashchange', function () {
    var id = location.hash.replace(/^#\/?/, '');
    if (id) open(id);
  });

  /* 启动 */
  var initialId = location.hash.replace(/^#\/?/, '') || GAMES[0].id;
  open(initialId);
})();
