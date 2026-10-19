// 用途：最后一次侦察 · 深入播放条内部结构（趁歌正在播）
(function () {
  const out = {};
  const bar = document.querySelector('.footer-player');

  // 1) 播放条整体内部结构（关键！）
  out.footerPlayerHTML = bar ? bar.outerHTML.slice(0, 6000) : '未找到 .footer-player';

  // 2) 播放条里所有图片（找当前播放歌曲的封面小图）
  out.imgsInBar = bar
    ? [...bar.querySelectorAll('img')].slice(0, 6).map(i => ({
        cls: String(i.className).slice(0, 60),
        src: (i.currentSrc || i.src || '').slice(0, 100)
      }))
    : [];

  // 3) 播放条里所有文本小块（定位歌名/歌手的准确容器）
  out.textBlocksInBar = bar
    ? [...bar.querySelectorAll('div,span,p,a')].slice(0, 40).map(el => ({
        tag: el.tagName, cls: String(el.className).slice(0, 60),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45)
      })).filter(x => x.text)
    : [];

  // 4) 找一下隐藏的全局播放器对象（media 为空的疑点）
  out.windowKeys = Object.keys(window).filter(k =>
    /audio|player|migu|media/i.test(k) && !/webkit|chrome/i.test(k)
  ).slice(0, 15);

  console.log('=====播放条解剖结果-整段复制发回=====');
  console.log(JSON.stringify(out, null, 2));
})();
