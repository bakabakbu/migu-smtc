// ==UserScript==
// @name         咪咕音乐 SMTC 修复（Lyricify Fusion / 系统音量栏）
// @namespace    https://github.com/bakabakbu/migu-smtc
// @version      0.6.0
// @description  为咪咕音乐网页版补齐 Media Session 元数据，使其接入 Windows SMTC
// @author       bakabakbu
// @license      MIT
// @match        https://music.migu.cn/*
// @match        https://*.migu.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      d.musicapp.migu.cn
// @connect      *.migu.cn
// @run-at       document-start
// @inject-into  content
// @noframes
// @icon         https://music.migu.cn/favicon.ico
// @updateURL    https://raw.githubusercontent.com/bakabakbu/migu-smtc/main/migu-smtc.user.js
// @downloadURL  https://raw.githubusercontent.com/bakabakbu/migu-smtc/main/migu-smtc.user.js
// ==/UserScript==

/* ==UserConfig==
咪咕SMTC配置:
  selTitle:
    title: 歌名选择器
    description: 咪咕改版导致取不到歌名时修改
    type: text
    default: .footer-player .song-name
  selArtist:
    title: 歌手选择器
    description: 咪咕改版导致取不到歌手时修改
    type: text
    default: .footer-player .singers
  selCover:
    title: 封面选择器
    description: 咪咕改版导致取不到封面时修改
    type: text
    default: .footer-player .default-cover img
  selButton:
    title: 控制按钮选择器
    description: 媒体键失效时修改
    type: text
    default: .footer-player .custom-icon
  debugSwitch:
    title: 开启调试日志
    description: 排查问题时打开，用完记得关掉
    type: checkbox
    default: false
==/UserConfig== */

(function () {
  'use strict';

  // ③ guard · 门卫
  let DEBUG = false; // 日常静默；配置面板里的"调试日志"开关可临时打开

  // 沙箱模式注入：对网页动手必须走 unsafeWindow 这张通行证
  const UW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  function session() {
    return UW.navigator.mediaSession;
  }
  function newMeta(payload) {
    return new UW.MediaMetadata(payload);
  }

  if (UW.top !== UW.self) {
    return;
  }
  if (!('mediaSession' in UW.navigator)) {
    if (DEBUG) {
      log('[咪咕SMTC] 当前浏览器不支持 mediaSession，脚本退出');
    }
    return;
  }
  if (UW.__MIGU_SMTC_LOADED__) {
    return;
  }
  UW.__MIGU_SMTC_LOADED__ = true;

  // ② config · 配置（咪咕改版后改这里的门牌号即可）
  const SEL = {
    playerBar: '.footer-player',
    title: '.footer-player .song-name',
    artist: '.footer-player .singers',
    cover: '.footer-player .default-cover img',
    button: '.footer-player .custom-icon'
  };
  const THROTTLE_MS = 300;
  const POLL_MS = 2000;
  const ALBUM = '咪咕音乐'; // 网页上看不到专辑名，统一用固定值占位

  // 读取配置面板的值；任何失败都保留内置默认值，绝不中断脚本
  function readValue(key) {
    try {
      if (typeof GM_getValue !== 'function') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(GM_getValue(key, undefined));
    } catch (err) {
      return Promise.resolve(undefined);
    }
  }

  function loadUserConfig() {
    const mapping = {
      '咪咕SMTC配置.selTitle': 'title',
      '咪咕SMTC配置.selArtist': 'artist',
      '咪咕SMTC配置.selCover': 'cover',
      '咪咕SMTC配置.selButton': 'button'
    };
    for (const [key, field] of Object.entries(mapping)) {
      readValue(key).then(v => {
        if (typeof v === 'string' && v.trim()) {
          SEL[field] = v.trim();
        }
      });
    }
    readValue('咪咕SMTC配置.debugSwitch').then(v => {
      if (typeof v === 'boolean') {
        DEBUG = v;
      }
    });
  }
  loadUserConfig();

  function log(...args) {
    if (DEBUG) {
      console.log('[咪咕SMTC]', ...args);
    }
  }

  // ④ extractor · 提取
  function cleanText(el) {
    return (el.textContent || '').trim().replace(/\s+/g, ' ');
  }

  function extract() {
    const info = { title: '', artist: '', cover: '', playing: false };
    try {
      const titleEl = document.querySelector(SEL.title);
      if (titleEl) {
        info.title = cleanText(titleEl);
      }
      const artistEl = document.querySelector(SEL.artist);
      if (artistEl) {
        info.artist = cleanText(artistEl);
      }
      const coverEl = document.querySelector(SEL.cover);
      if (coverEl) {
        const src = coverEl.currentSrc || coverEl.src || '';
        // 咪咕换歌瞬间会出现 base64 占位灰图，这种不能当封面报
        info.cover = src.indexOf('data:') === 0 ? '' : src;
      }
      // 咪咕无 audio 元素，靠播放按钮 title 反推：显示"暂停"= 正在播
      const buttons = document.querySelectorAll(SEL.button);
      for (const btn of buttons) {
        const t = btn.getAttribute('title');
        if (t === '暂停' || t === '播放') {
          info.playing = (t === '暂停');
          break;
        }
      }
    } catch (err) {
      log('提取失败', err);
    }
    return info;
  }

  // ⑤b coverConverter · 封面转内置图片（data: 地址）
  // Chromium 在窗口最小化时不给系统卡片下载封面图，恢复窗口才更新；
  // 转成 data: 地址后图片数据直接内嵌，无需下载，最小化时也能实时更新
  const coverCache = new Map();

  function toCoverDataUrl(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      if (coverCache.has(url)) {
        resolve(coverCache.get(url));
        return;
      }

      // 拿到图片数据后，缩到 256px 再转 JPEG 内置格式（体积小、系统卡片够用）
      function bitmapToDataUrl(blob) {
        return new Promise((res) => {
          try {
            createImageBitmap(blob).then((bmp) => {
              try {
                const scale = Math.min(256 / bmp.width, 256 / bmp.height, 1);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bmp.width * scale));
                canvas.height = Math.max(1, Math.round(bmp.height * scale));
                canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.85));
              } catch (err) {
                res(null);
              }
            }).catch(() => res(null));
          } catch (err) {
            res(null);
          }
        });
      }

      // 优先走脚本猫的特权下载（不受跨域限制）
      if (typeof GM_xmlhttpRequest === 'function') {
        try {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            timeout: 8000,
            onload: (res) => {
              if (!res.response) {
                resolve(null);
                return;
              }
              bitmapToDataUrl(res.response).then((data) => {
                if (data && coverCache.size > 20) {
                  coverCache.delete(coverCache.keys().next().value);
                }
                if (data) {
                  coverCache.set(url, data);
                }
                resolve(data);
              });
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null)
          });
          return;
        } catch (err) {
          /* 掉到下面的普通方案 */
        }
      }

      // 备用：普通图片加载（服务器允许跨域时才行）
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const scale = Math.min(256 / (img.naturalWidth || 256), 256 / (img.naturalHeight || 256), 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round((img.naturalWidth || 256) * scale));
            canvas.height = Math.max(1, Math.round((img.naturalHeight || 256) * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = canvas.toDataURL('image/jpeg', 0.85);
            coverCache.set(url, data);
            resolve(data);
          } catch (err) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch (err) {
        resolve(null);
      }
    });
  }

  function pushMetadata(title, artist, cover, coverData) {
    let artwork = [];
    if (cover) {
      artwork = [{
        src: coverData || freshCoverUrl(cover),
        sizes: 'any',
        type: coverData ? 'image/jpeg' : 'image/webp'
      }];
    }
    session().metadata = newMeta({
      title: title,
      artist: artist,
      album: ALBUM,
      artwork: artwork
    });
  }

  // ⑥ writer · 上报
  let lastFingerprint = '';
  let current = { title: '', artist: '', cover: '' };

  // 给封面地址加一次性编号：地址每次都不同，逼浏览器重新下载、刷新系统卡片封面
  function freshCoverUrl(cover) {
    if (!cover) {
      return cover;
    }
    const stamp = 'smtc=' + Date.now();
    return cover + (cover.indexOf('?') >= 0 ? '&' : '?') + stamp;
  }

  // 封面内置转换失败时的兜底：150ms 后换全新地址重写一次，触发系统重绘
  let refreshTimer = null;
  function scheduleCoverRefresh(title, artist, cover) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      try {
        if (current.cover === cover) {
          pushMetadata(title, artist, cover, null);
        }
      } catch (err) {
        log('强制刷新失败', err);
      }
    }, 150);
  }

  function writeMeta(info) {
    try {
      const title = info.title || current.title;
      const artist = info.artist || current.artist;
      const cover = info.cover || current.cover;
      if (!title) {
        return;
      }
      const fingerprint = [title, artist, cover].join('|');
      if (fingerprint === lastFingerprint) {
        return;
      }
      lastFingerprint = fingerprint;
      current = { title: title, artist: artist, cover: cover };
      pushMetadata(title, artist, cover, null);
      log('已上报：', title, '-', artist, '| 封面：', cover);
      if (cover) {
        // 转成内置图片后重报：图片数据随上报一起送达，不依赖浏览器再去下载
        toCoverDataUrl(cover).then((data) => {
          try {
            if (data && current.cover === cover && current.title === title) {
              pushMetadata(title, artist, cover, data);
              log('封面已内置');
            } else if (!data) {
              scheduleCoverRefresh(title, artist, cover);
            }
          } catch (err) {
            log('内置封面重报失败', err);
          }
        });
      }
    } catch (err) {
      log('上报失败', err);
    }
  }

  function apply() {
    try {
      const info = extract();
      if (info.title) {
        writeMeta(info);
      }
      session().playbackState = info.playing ? 'playing' : 'paused';
    } catch (err) {
      log('apply 失败', err);
    }
  }

  // FR-5 · 媒体键：点击播放条上对应按钮
  function clickButton(title) {
    try {
      const buttons = document.querySelectorAll(SEL.button);
      for (const btn of buttons) {
        if (btn.getAttribute('title') === title) {
          btn.click();
          return;
        }
      }
    } catch (err) {
      log('按键转发失败', err);
    }
  }

  const ACTIONS = {
    play: () => clickButton('播放'),
    pause: () => clickButton('暂停'),
    previoustrack: () => clickButton('上一首'),
    nexttrack: () => clickButton('下一首')
  };
  for (const [action, handler] of Object.entries(ACTIONS)) {
    try {
      session().setActionHandler(action, handler);
    } catch (err) {
      log('注册失败:', action, err);
    }
  }

  // ⑦ scheduler · 调度（即时哨兵 + 时间戳限流 + 可见性唤醒 + 轮询兜底）
  // 不用 setTimeout 限流：窗口最小化时定时器会被浏览器降速，导致换歌迟迟不同步
  let lastRun = 0;
  function schedule() {
    const now = Date.now();
    if (now - lastRun < THROTTLE_MS) {
      return;
    }
    lastRun = now;
    apply();
  }

  function syncNow() {
    lastRun = 0;
    apply();
  }

  let observer = null;
  function mountObserver() {
    if (observer) {
      return;
    }
    const root = document.body;
    if (!root) {
      return;
    }
    // 监听整个页面：切歌时咪咕会重建播放条，只盯播放条会导致哨兵失效
    observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
  }
  let pollTimer = null;

  function initDom() {
    mountObserver();

    // 窗口最小化后恢复可见：立刻强制同步一次
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        mountObserver();
        syncNow();
      }
    });
    window.addEventListener('focus', () => {
      mountObserver();
      syncNow();
    });

    pollTimer = setInterval(() => {
      apply();
    }, POLL_MS);

    window.addEventListener('pagehide', () => {
      if (observer) {
        observer.disconnect();
      }
      clearInterval(pollTimer);
    });

    apply();
  }

  // document-start 注入时网页还没内容，DOM 相关部分等网页开门后再启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDom);
  } else {
    initDom();
  }

  // ⑧ diagnose · 一键诊断（FR-8）
  function checkOne(label, selector) {
    try {
      const el = document.querySelector(selector);
      return selector + ' → ' + (el ? '命中' : '未命中');
    } catch (err) {
      return selector + ' → 选择器无效';
    }
  }

  function diagnose() {
    const info = extract();
    let meta = '（无）';
    try {
      const m = session().metadata;
      if (m) {
        meta = m.title + ' - ' + m.artist;
      }
    } catch (err) {
      meta = '读取失败';
    }
    console.log('===== 咪咕SMTC 诊断报告 =====');
    console.log('播放条：' + checkOne('bar', SEL.playerBar));
    console.log('歌名：' + checkOne('title', SEL.title) + '，取值：' + info.title);
    console.log('歌手：' + checkOne('artist', SEL.artist) + '，取值：' + info.artist);
    console.log('封面：' + checkOne('cover', SEL.cover) + '，取值：' + info.cover);
    console.log('按钮：' + checkOne('button', SEL.button) + '，播放中：' + info.playing);
    console.log('已上报给系统：' + meta);
    console.log('当前缓存：' + current.title + ' - ' + current.artist);
    console.log('============================');
  }

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('咪咕SMTC · 一键诊断（结果见 F12 控制台）', diagnose);
    }
  } catch (err) {
    log('菜单注册失败', err);
  }
})();
