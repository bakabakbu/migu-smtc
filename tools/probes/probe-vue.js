// 用途：第四侦察 · 挖出 Vue 内部的播放器状态账本（不依赖屏幕刷新，最小化也有效）
(function () {
  const out = {};
  const appEl = document.querySelector('#app');
  const vueApp = appEl && appEl.__vue_app__;

  if (!vueApp) {
    out.vue = '未找到 #app.__vue_app__（可能挂在别的元素上）';
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  out.vue = '找到 Vue 应用';

  const gp = vueApp.config.globalProperties;

  // 情况A：Vuex（$store）
  if (gp.$store && gp.$store.state) {
    out.vuex = true;
    out.stateKeys = Object.keys(gp.$store.state);
    // 把可能是播放器的模块摘出来看
    out.playerLike = {};
    for (const k of out.stateKeys) {
      const s = JSON.stringify(gp.$store.state[k]);
      if (/songName|singer|"song"|musicId|album/i.test(s || '')) {
        out.playerLike[k] = s.slice(0, 2500);
      }
    }
  } else {
    out.vuex = false;
  }

  // 情况B：Pinia（$pinia._s 是所有账本的登记表）
  if (gp.$pinia && gp.$pinia._s) {
    out.pinia = Object.keys(gp.$pinia._s);
    out.piniaPlayerLike = {};
    for (const k of out.pinia) {
      try {
        const s = JSON.stringify(gp.$pinia._s[k].$state);
        if (/songName|singer|"song"|musicId|album/i.test(s || '')) {
          out.piniaPlayerLike[k] = s.slice(0, 2500);
        }
      } catch (e) { /* 循环引用跳过 */ }
    }
  } else {
    out.pinia = null;
  }

  console.log('=====Vue账本侦察结果-整段复制发回=====');
  console.log(JSON.stringify(out, null, 2));
})();
