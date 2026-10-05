/* ============================================================
 *  画板组件（画笔 / 颜色 / 粗细 / 橡皮擦 / 撤销 / 清空）
 *  用法：
 *    var board = DrawingBoard.create(hostElement, {
 *      colors: [...], brush: { min, max, defaultSize }
 *    });
 *    board.toDataURL()  // 导出 PNG
 *    board.hasInk()     // 是否画过东西
 *    board.clear() / board.undo() / board.setEnabled(false)
 * ============================================================ */
(function () {
  'use strict';

  var WIDTH = 1024;
  var HEIGHT = 576;
  var HISTORY_LIMIT = 12;

  function create(host, options) {
    options = options || {};
    var colors = (options.colors && options.colors.length) ? options.colors.slice() : ['#000000'];
    var brush = options.brush || {};
    var minSize = brush.min != null ? brush.min : 1;
    var maxSize = brush.max != null ? brush.max : 48;
    var defaultSize = brush.defaultSize != null ? brush.defaultSize : 6;

    /* ---------- 状态 ---------- */
    var tool = 'brush';                 // brush | eraser
    var color = colors[0];
    var size = Math.min(Math.max(defaultSize, minSize), maxSize);
    var disabled = false;               // 外部强制禁用（一般不用）
    var locked = false;                 // 时间到
    var paused = false;                 // 暂停
    var enabled = true;
    var drawing = false;
    var inked = false;
    var strokeColor = '#000000';
    var lineWidth = size;
    var lastPoint = null;
    var lastMid = null;
    var history = [];

    /* ---------- DOM ---------- */
    var swatchesHtml = colors.map(function (c, i) {
      return '<button type="button" class="swatch' + (i === 0 ? ' is-active' : '') +
        '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    }).join('');

    host.innerHTML =
      '<div class="board">' +
        '<div class="board-toolbar">' +
          '<div class="tool-group">' + swatchesHtml + '</div>' +
          '<div class="tool-group">' +
            '<label class="size-control">' +
              '<span>粗细</span>' +
              '<input type="range" min="' + minSize + '" max="' + maxSize + '" value="' + size + '" step="1">' +
              '<span class="size-preview"><i></i></span>' +
            '</label>' +
          '</div>' +
          '<div class="tool-group">' +
            '<button type="button" class="tool-btn is-active" data-tool="brush">🖌 画笔</button>' +
            '<button type="button" class="tool-btn" data-tool="eraser">🧽 橡皮擦</button>' +
          '</div>' +
          '<div class="tool-group right">' +
            '<button type="button" class="tool-btn" data-action="undo">↶ 撤销</button>' +
            '<button type="button" class="tool-btn danger" data-action="clear">🗑 清空</button>' +
          '</div>' +
        '</div>' +
        '<div class="board-canvas-wrap">' +
          '<canvas width="' + WIDTH + '" height="' + HEIGHT + '"></canvas>' +
          '<div class="board-paused" hidden>已暂停<span>点击「继续」恢复计时</span></div>' +
          '<div class="board-lock" hidden>时间到</div>' +
        '</div>' +
      '</div>';

    var boardEl = host.querySelector('.board');
    var canvas = host.querySelector('canvas');
    var wrapEl = host.querySelector('.board-canvas-wrap');
    var lockEl = host.querySelector('.board-lock');
    var pausedEl = host.querySelector('.board-paused');
    var rangeEl = host.querySelector('input[type="range"]');
    var sizePreviewEl = host.querySelector('.size-preview');
    var sizePreviewDot = sizePreviewEl.querySelector('i');
    var ctx = canvas.getContext('2d');

    function paintBackground() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }

    function resetContext() {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    paintBackground();
    resetContext();

    /* ---------- 界面同步 ---------- */
    function paintSizePreview() {
      var visual = Math.max(2, Math.min(26, size));
      sizePreviewDot.style.width = visual + 'px';
      sizePreviewDot.style.height = visual + 'px';
      sizePreviewEl.classList.toggle('is-eraser', tool === 'eraser');
    }

    function syncToolButtons() {
      Array.prototype.forEach.call(host.querySelectorAll('[data-tool]'), function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-tool') === tool);
      });
      canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
      paintSizePreview();
    }

    function setColor(c) {
      color = c;
      tool = 'brush';
      Array.prototype.forEach.call(host.querySelectorAll('.swatch'), function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-color') === c);
      });
      syncToolButtons();
    }

    function setSize(v) {
      size = Math.min(Math.max(Number(v) || minSize, minSize), maxSize);
      rangeEl.value = size;
      paintSizePreview();
    }

    function setTool(t) {
      tool = (t === 'eraser') ? 'eraser' : 'brush';
      syncToolButtons();
    }

    /* ---------- 历史（撤销） ---------- */
    function pushHistory() {
      try {
        history.push(canvas.toDataURL('image/png'));
        if (history.length > HISTORY_LIMIT) history.shift();
      } catch (e) { /* ignore */ }
    }

    /* ---------- 绘制 ---------- */
    function pointerPos(e) {
      var rect = canvas.getBoundingClientRect();
      var sx = WIDTH / (rect.width || 1);
      var sy = HEIGHT / (rect.height || 1);
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy
      };
    }

    /* 手写笔按压力度微调粗细 */
    function widthFor(e) {
      var base = (tool === 'eraser') ? size * 2.2 : size;
      if (e && e.pointerType === 'pen' && e.pressure > 0) {
        base = base * (0.45 + e.pressure * 0.9);
      }
      return Math.max(0.6, base);
    }

    function beginStroke(p, e) {
      strokeColor = (tool === 'eraser') ? '#ffffff' : color;
      lineWidth = widthFor(e);
      lastPoint = p;
      lastMid = p;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(lineWidth / 2, 0.4), 0, Math.PI * 2);
      ctx.fill();
      inked = true;
    }

    function extendStroke(p, e) {
      var w = widthFor(e) || lineWidth;
      var mid = { x: (lastPoint.x + p.x) / 2, y: (lastPoint.y + p.y) / 2 };
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, mid.x, mid.y);
      ctx.stroke();
      lastPoint = p;
      lastMid = mid;
      lineWidth = w;
      inked = true;
    }

    function endStroke() {
      if (!lastPoint || !lastMid) return;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
    }

    /* ---------- 指针事件 ---------- */
    function onPointerDown(e) {
      if (!enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pushHistory();
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      resetContext();
      beginStroke(pointerPos(e), e);
    }

    function onPointerMove(e) {
      if (!drawing || !enabled) return;
      e.preventDefault();
      var events = (e.getCoalescedEvents && e.getCoalescedEvents()) || null;
      if (!events || !events.length) events = [e];
      for (var i = 0; i < events.length; i++) {
        extendStroke(pointerPos(events[i]), events[i]);
      }
    }

    function onPointerUp(e) {
      if (!drawing) return;
      drawing = false;
      endStroke();
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* ---------- 工具栏事件 ---------- */
    host.addEventListener('click', function (e) {
      var swatch = e.target.closest ? e.target.closest('.swatch') : null;
      if (swatch) { setColor(swatch.getAttribute('data-color')); return; }

      var toolBtn = e.target.closest ? e.target.closest('[data-tool]') : null;
      if (toolBtn) { setTool(toolBtn.getAttribute('data-tool')); return; }

      var actionBtn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!actionBtn) return;
      var action = actionBtn.getAttribute('data-action');
      if (action === 'undo') undo();
      if (action === 'clear') clear();
    });

    rangeEl.addEventListener('input', function () { setSize(rangeEl.value); });

    /* ---------- 对外 API ---------- */
    function clear() {
      pushHistory();
      paintBackground();
      resetContext();
      inked = false;
    }

    function undo() {
      if (!history.length) return;
      var data = history.pop();
      var img = new Image();
      img.onload = function () {
        paintBackground();
        ctx.drawImage(img, 0, 0);
      };
      img.src = data;
    }

    function syncEnabled() {
      enabled = !disabled && !locked && !paused;
      if (!enabled) drawing = false;
      boardEl.classList.toggle('is-locked', !enabled);
      lockEl.hidden = !locked;
      pausedEl.hidden = !paused;
    }

    function setEnabled(value) {
      disabled = !value;
      syncEnabled();
    }

    function setPaused(value) {
      paused = !!value;
      syncEnabled();
    }

    function setLocked(value) {
      locked = !!value;
      syncEnabled();
    }

    function toDataURL() {
      return canvas.toDataURL('image/png');
    }

    function destroy() {
      host.innerHTML = '';
    }

    syncToolButtons();
    paintSizePreview();
    syncEnabled();

    return {
      el: boardEl,
      canvas: canvas,
      wrapper: wrapEl,
      toDataURL: toDataURL,
      hasInk: function () { return inked; },
      clear: clear,
      undo: undo,
      setEnabled: setEnabled,
      setPaused: setPaused,
      setLocked: setLocked,
      setColor: setColor,
      setSize: setSize,
      setTool: setTool,
      pushHistory: pushHistory,
      destroy: destroy
    };
  }

  window.DrawingBoard = { create: create, WIDTH: WIDTH, HEIGHT: HEIGHT };
})();
