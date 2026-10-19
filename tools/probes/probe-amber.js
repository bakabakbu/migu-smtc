// 用途：第六侦察 · 抄咪咕自己的播放上报（Amber），看它每秒上报了什么
// 用法：粘贴运行 → 等 3 秒 → 切一首歌 → 再等 3 秒 → 运行 copy(JSON.stringify(window.__amberOut,null,2)) 粘贴发回
(function () {
  if (window.__amberReady) {
    console.log('已装好，切歌后输入 copy(JSON.stringify(window.__amberOut,null,2))');
    return;
  }
  window.__amberReady = true;
  window.__amberOut = [];

  function record(kind, args) {
    try {
      const s = args.map(a => {
        if (typeof a === 'object' && a !== null) {
          return JSON.stringify(a);
        }
        return String(a);
      }).join(' | ');
      if (s.indexOf('[咪咕SMTC]') !== -1) {
        return;
      }
      if (/Amber|amber|Track|track|song|Song|music/i.test(s) || kind === 'submit') {
        if (window.__amberOut.length < 40) {
          window.__amberOut.push({ kind: kind, time: Date.now(), text: s.slice(0, 300) });
        }
      }
    } catch (e) { /* 忽略 */ }
  }

  // 1) 抄它自己打印的日志
  ['log', 'info', 'debug', 'warn'].forEach(fn => {
    const orig = console[fn];
    console[fn] = function () {
      try {
        record(fn, Array.prototype.slice.call(arguments));
      } catch (e) { /* 忽略 */ }
      return orig.apply(console, arguments);
    };
  });

  // 2) 抄它的 SDK 调用
  try {
    if (window.MiGuAmberSdk && typeof window.MiGuAmberSdk.submit === 'function') {
      const orig = window.MiGuAmberSdk.submit;
      window.MiGuAmberSdk.submit = function () {
        record('submit', Array.prototype.slice.call(arguments));
        return orig.apply(this, arguments);
      };
    }
  } catch (e) { /* 忽略 */ }

  console.log('✅ Amber 探针已装好。请等 3 秒 → 切一首歌 → 再等 3 秒');
  console.log('然后输入：copy(JSON.stringify(window.__amberOut,null,2))');
})();
