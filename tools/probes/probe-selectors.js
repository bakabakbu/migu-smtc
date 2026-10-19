// 用途：咪咕页面一次性侦察，找出歌名/歌手/专辑/封面/播放状态的候选位置
// 用法：在 music.migu.cn 播放页按 F12 → Console → 粘贴全部 → 回车 → 复制输出发回
(function () {
  const out = {};
  out.pageTitle = document.title;

  // 页面里有没有 audio/video 在响，以及是否在播
  out.media = [...document.querySelectorAll('audio,video')].slice(0, 3).map(a => ({
    tag: a.tagName, paused: a.paused,
    src: (a.currentSrc || a.src || '').slice(0, 60)
  }));

  // 页面里有多少 iframe（用来判断要不要担心重复运行）
  out.iframeCount = document.querySelectorAll('iframe').length;

  // 当前系统媒体会话里已有什么（看看咪咕是不是其实自己上报了）
  try {
    const m = navigator.mediaSession.metadata;
    out.existingSmtc = m ? { title: m.title, artist: m.artist, album: m.album } : null;
  } catch (e) { out.existingSmtc = '读取失败'; }

  // 候选位置侦察：按"货物种类"分组猜编号
  const probes = {
    songName: '[class*="songName"],[class*="song-name"],[class*="song_name"],[class*="songTitle"],[class*="song-title"]',
    anyTitle: '[class*="musicTitle"],[class*="music-title"],[class*="playTitle"],[class*="play-title"],[class*="playerTitle"],[class*="player-title"]',
    singer: '[class*="singer"],[class*="Singer"],[class*="artist"],[class*="Artist"]',
    album: '[class*="album"],[class*="Album"]',
    coverImg: '[class*="cover"] img,[class*="Cover"] img,[class*="pic"] img,[class*="poster"] img',
    playPause: '[class*="pause"],[class*="Pause"]'
  };
  out.hits = {};
  for (const [kind, sel] of Object.entries(probes)) {
    out.hits[kind] = [...document.querySelectorAll(sel)].slice(0, 6).map(el => ({
      cls: String(el.className).slice(0, 90),
      text: el.tagName === 'IMG' ? ('IMG: ' + (el.currentSrc || el.src || '').slice(0, 80))
        : (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    }));
  }

  // 网页自带的"名片"信息（有时歌名封面直接写在 meta 里，最好拿）
  out.metaTags = {};
  document.querySelectorAll('meta[property],meta[name]').forEach(m => {
    const k = m.getAttribute('property') || m.getAttribute('name') || '';
    if (/og:|music|song|title|image/i.test(k)) out.metaTags[k] = m.getAttribute('content');
  });

  console.log('=====咪咕SMTC探针结果-全选下面这行复制发回=====');
  console.log(JSON.stringify(out, null, 2));
})();
