// 用途：第二侦察 · 必须在一首歌"正在播放"时运行，专摸播放条/封面/播放状态
// 用法：咪咕播放页按 F12 → Console → 粘贴全部 → 回车 → 复制输出发回
(function () {
  const out = {};
  out.bodyClass = document.body.className;

  // 1) 音频元素到底存不存在、在不在播（这决定我们怎么知道"播放/暂停"）
  out.media = [...document.querySelectorAll('audio,video')].slice(0, 5).map(a => ({
    tag: a.tagName, paused: a.paused, id: a.id || '',
    cls: String(a.className).slice(0, 60),
    src: (a.currentSrc || a.src || '').slice(0, 70)
  }));

  // 2) 播放器相关候选：底部播放条、大播放页（pop-）、封面、歌名歌手区
  const probes = {
    playerBar: '[class*="player-bar"],[class*="playbar"],[class*="play-bar"],[class*="playerBar"],[class*="footer-player"]',
    popLayer: '[class*="pop-cover"],[class*="pop-player"],[class*="pop-song"],[class*="pop-info"]',
    songInfo: '[class*="song-info"],[class*="music-info"],[class*="info-name"],[class*="player-song"],[class*="play-song"],[class*="song-name"],[class*="songName"]',
    singerInPlayer: '[class*="singer"],[class*="Singer"],[class*="artist"]',
    coverNow: '[class*="cover"] img,[class*="Cover"] img',
    controlBtns: '[class*="pause"],[class*="Pause"],[class*="prev"],[class*="next"]'
  };
  out.hits = {};
  for (const [kind, sel] of Object.entries(probes)) {
    out.hits[kind] = [...document.querySelectorAll(sel)].slice(0, 8).map(el => ({
      cls: String(el.className).slice(0, 90),
      text: el.tagName === 'IMG' ? ('IMG: ' + (el.currentSrc || el.src || '').slice(0, 90))
        : (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      html: el.outerHTML.slice(0, 110)
    }));
  }

  // 3) 页面里 class 含 "pause" 的按钮：播放中它通常存在（点它=暂停）
  out.pauseCount = document.querySelectorAll('[class*="pause"]').length;

  console.log('=====第二次探针结果-整段复制发回=====');
  console.log(JSON.stringify(out, null, 2));
})();
