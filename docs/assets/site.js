/* 讓現場活起來 —— 前端行為
 *
 * 三件事，都刻意做得很小：
 *   1. 第一幕的堆疊動態（不劫持捲動，只是自己跑完然後停下）
 *   2. 閱讀進度線
 *   3. 第五幕之後才浮出的 CTA 條
 *
 * prefers-reduced-motion 時 1 直接跳到終態、3 不做位移。
 */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 第一幕：答案一直來，你留不住 ---------- */

  var flood = document.querySelector('[data-flood]');
  if (flood) {
    var items = Array.prototype.slice.call(flood.querySelectorAll('li'));

    // 手機減量：條目少一點，跑完的時間才不會拖太長
    var limit = window.innerWidth < 640 ? 24 : items.length;
    items.slice(limit).forEach(function (li) { li.remove(); });
    items = items.slice(0, limit);

    var act = flood.closest('.act-flood');

    // 一次把所有條目與落點文案、主標放出來。
    // 任何走不到動畫結尾的路徑都必須走這裡，否則主標會永久隱形。
    var revealAll = function () {
      items.forEach(function (li) { li.classList.add('in'); });
      if (act) act.classList.add('revealed');
    };

    // 重新整理、上一頁、或直接開 #posts 這種錨點時，瀏覽器會還原捲動位置，
    // 第一幕根本不在視窗內 —— 這時不要進 staged，直接顯示完整內容。
    // 門檻必須跟下面 IntersectionObserver 的 threshold 一致（0.25），
    // 否則會出現「判定看得到所以藏起來，但 observer 又不觸發」的死角，
    // 主標會一直隱形。
    var THRESHOLD = 0.25;
    var r = flood.getBoundingClientRect();
    var visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    var inViewAtLoad = r.height > 0 && visible / r.height >= THRESHOLD;

    if (reduce || !inViewAtLoad) {
      revealAll();
    } else {
      // staged 由 JS 加上：沒有 JS 的瀏覽器一律看到完整內容，不會空白
      if (act) act.classList.add('staged');

      // 先把容器填滿再開始跑。否則清單由下往上長，前十幾條都還在畫面外，
      // 讀者一進來會看到一片空白——答案應該是「已經在湧進來了」。
      var list = flood.querySelector('.flood-list');
      var i = 0;
      while (i < items.length && list.getBoundingClientRect().height < flood.clientHeight) {
        items[i].classList.add('in', 'seed');
        i++;
      }

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        revealAll();
      };

      var gap = 260;                    // 起步慢，之後越來越快
      var start = function () {
        (function step() {
          if (done) return;
          if (i >= items.length) { finish(); return; }   // 資訊流停下來，才輪到那兩句話與主標
          items[i].classList.add('in');
          i++;
          gap = Math.max(38, gap * 0.87);
          setTimeout(step, gap);
        })();
      };

      // 保險絲：不管發生什麼事，5 秒後一定把內容放出來。
      setTimeout(finish, 5000);

      // 進入視窗才開始，避免使用者還沒看到就跑完了
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { io.disconnect(); start(); }
        }, { threshold: THRESHOLD });
        io.observe(flood);
      } else {
        start();
      }
    }
  }

  /* ---------- 2. 閱讀進度 ---------- */

  var bar = document.getElementById('progress-bar');
  if (bar) {
    var ticking = false;
    var update = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, pct)).toFixed(1) + '%';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- 3. 後段才浮出的 CTA 條 ---------- */

  var bar2 = document.querySelector('.floatbar');
  var fields = document.getElementById('fields');
  if (bar2 && fields && 'IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (entries) {
      // 第五幕的頂端越過視窗上緣之後才顯示
      bar2.classList.toggle('on', entries[0].boundingClientRect.top < 0);
    }, { threshold: 0 });
    io2.observe(fields);
  }
})();
