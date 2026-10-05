/* ============================================================
 *  通用小工具
 * ============================================================ */
(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* 秒 -> "01:30" */
  function formatTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  /* 洗牌（不修改原数组） */
  function shuffle(list) {
    var arr = (list || []).slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 把文件名里不能用的字符替换掉 */
  function safeFileName(name) {
    return String(name == null ? '' : name)
      .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'artwork';
  }

  /* 触发浏览器下载 */
  function download(dataURL, filename) {
    var a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- 提示音（WebAudio，无需音频文件） ---------- */
  var audioCtx = null;

  function beep(freq, durationMs, volume) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();

      var now = audioCtx.currentTime;
      var dur = (durationMs || 100) / 1000;
      var vol = (volume == null ? 0.14 : volume);

      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq || 880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    } catch (e) { /* 静音环境忽略 */ }
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 图片放大查看 ---------- */
  var lightboxBound = false;

  function closeLightbox() {
    var box = document.getElementById('lightbox');
    if (box) box.hidden = true;
  }

  function openLightbox(src) {
    var box = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');
    if (!box || !img || !src) return;
    img.src = src;
    box.hidden = false;

    if (!lightboxBound) {
      lightboxBound = true;
      box.addEventListener('click', closeLightbox);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
      });
    }
  }

  window.Utils = {
    qs: qs,
    qsa: qsa,
    formatTime: formatTime,
    shuffle: shuffle,
    escapeHtml: escapeHtml,
    safeFileName: safeFileName,
    download: download,
    beep: beep,
    vibrate: vibrate,
    openLightbox: openLightbox,
    closeLightbox: closeLightbox
  };
})();
