// 用途：第七侦察 · 完整抄下咪咕打印的"当前歌曲档案"(media|)，看清歌手/封面字段叫什么
// 用法：粘贴运行 → 切一首歌 → 等 3 秒 → copy(window.__mediaDump) 回车 → 粘贴发回
(function () {
  if (window.__mediaReady) {
    console.log('已装好，切歌后输入 copy(window.__mediaDump)');
    return;
  }
  window.__mediaReady = true;
  window.__mediaDump = [];

  ['log', 'info', 'debug'].forEach(fn => {
    const orig = console[fn];
    console[fn] = function () {
      try {
        const args = Array.prototype.slice.call(arguments);
        const first = String(args[0] || '');
        if (first.indexOf('media') === 0 && window.__mediaDump.length < 3) {
          const second = args[1];
          const body = typeof second === 'object' && second !== null
            ? JSON.stringify(second)
            : String(second || '');
          if (/songName|singer|cover|album/i.test(body)) {
            window.__mediaDump.push(body.slice(0, 6000));
          }
        }
      } catch (e) { /* 忽略 */ }
      return orig.apply(console, arguments);
    };
  });

  console.log('✅ 档案探针已装好。现在【切一首歌】，等 3 秒后输入：copy(window.__mediaDump)');
})();
