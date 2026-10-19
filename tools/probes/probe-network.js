// 用途：第三侦察 · 截获咪咕取歌信息的网络数据线（切歌时它必须联网拿新歌数据）
// 用法：粘贴运行 → 切一首歌 → 等 3 秒 → 控制台输入 copy(JSON.stringify(window.__probeOut,null,2)) 回车 → 粘贴发回
(function () {
  if (window.__probeInstalled) {
    console.log('探针已装过，直接切歌后输入 copy(JSON.stringify(window.__probeOut,null,2))');
    return;
  }
  window.__probeInstalled = true;
  window.__probeOut = [];
  const KEY = /songName|singerName|"singer"|artistName|albumName|coverAlbum|"cover"|img|pic/i;

  // 拦截 XMLHttpRequest（咪咕的主力请求方式）
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__probeUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const text = this.responseText || '';
        if (text.length < 20000 && KEY.test(text)) {
          window.__probeOut.push({
            type: 'xhr',
            url: String(this.__probeUrl).slice(0, 150),
            body: text.slice(0, 1000)
          });
        }
      } catch (e) { /* 非文本响应，忽略 */ }
    });
    return origSend.apply(this, arguments);
  };

  // 拦截 fetch（部分新接口用这个）
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      const url = String((arguments[0] && arguments[0].url) || arguments[0] || '');
      const p = origFetch.apply(this, arguments);
      p.then(res => {
        try {
          res.clone().text().then(t => {
            if (t.length < 20000 && KEY.test(t)) {
              window.__probeOut.push({
                type: 'fetch',
                url: url.slice(0, 150),
                body: t.slice(0, 1000)
              });
            }
          });
        } catch (e) { /* 忽略 */ }
      }).catch(() => {});
      return p;
    };
  }

  console.log('✅ 探针已装好。现在去【切一首歌】，等 3 秒后回来');
  console.log('输入：copy(JSON.stringify(window.__probeOut,null,2))  然后粘贴给我');
  if (window.MiGuAmberSdk) {
    console.log('顺便发现了咪咕的内部SDK，结构如下：');
    console.dir(window.MiGuAmberSdk);
  }
})();
