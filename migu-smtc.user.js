// ==UserScript==
// @name         咪咕音乐 SMTC 修复（Lyricify Fusion / 系统音量栏）
// @namespace    https://github.com/bakabakbu/migu-smtc
// @version      0.3.2
// @description  为咪咕音乐网页版补齐 Media Session 元数据，使其接入 Windows SMTC
// @author       bakabakbu
// @license      MIT
// @match        https://music.migu.cn/*
// @match        https://*.migu.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @inject-into  page
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

  if (window.top !== window.self) {
    return;
  }
  if (!('mediaSession' in navigator)) {
    if (DEBUG) {
      console.warn('[咪咕SMTC] 当前浏览器不支持 mediaSession，脚本退出');
    }
    return;
  }
  if (window.__MIGU_SMTC_LOADED__) {
    return;
  }
  window.__MIGU_SMTC_LOADED__ = true;

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
        info.cover = coverEl.currentSrc || coverEl.src || '';
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

  // ⑥ writer · 上报
  let lastFingerprint = '';

  function apply() {
    try {
      const info = extract();
      const fingerprint = [info.title, info.artist, info.cover].join('|');
      if (fingerprint !== lastFingerprint && info.title) {
        lastFingerprint = fingerprint;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: info.title,
          artist: info.artist,
          album: '咪咕音乐',
          artwork: info.cover
            ? [{ src: info.cover, sizes: 'any', type: 'image/webp' }]
            : []
        });
        log('已上报：', info.title, '-', info.artist);
      }
      navigator.mediaSession.playbackState = info.playing ? 'playing' : 'paused';
    } catch (err) {
      log('上报失败', err);
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
      navigator.mediaSession.setActionHandler(action, handler);
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

  const pollTimer = setInterval(() => {
    apply();
  }, POLL_MS);

  window.addEventListener('pagehide', () => {
    if (observer) {
      observer.disconnect();
    }
    clearInterval(pollTimer);
  });

  apply();

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
      const m = navigator.mediaSession.metadata;
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
