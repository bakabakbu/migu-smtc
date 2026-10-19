// 用途：第五侦察 · 遍历 Vue 组件树，找出记账当前歌曲的"账本对象"
(function () {
  const out = { found: [] };
  const appEl = document.querySelector('#app');
  const app = appEl && (appEl.__vue_app__ || (appEl.__vue__ && appEl.__vue__.$));

  if (!app) {
    out.error = '未找到 Vue 根实例';
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const KEY = /song|singer|artist|cover|album|music|play|current|track/i;
  const seen = new Set();

  function scan(obj, where) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) {
      return;
    }
    seen.add(obj);
    let keys = [];
    try {
      keys = Object.keys(obj);
    } catch (e) {
      return;
    }
    for (const k of keys) {
      if (!KEY.test(k)) {
        continue;
      }
      let v;
      try {
        v = obj[k];
      } catch (e) {
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        if (String(v).length < 60) {
          out.found.push({ where: where, key: k, value: String(v) });
        }
      } else if (v && typeof v === 'object') {
        let s = '';
        try {
          s = JSON.stringify(v).slice(0, 260);
        } catch (e) {
          s = '[无法序列化]';
        }
        if (/songName|singer|artist|cover|album|musicId|title/i.test(s)) {
          out.found.push({ where: where, key: k, sample: s });
        }
      }
    }
  }

  function visit(vnode, depth) {
    if (!vnode || depth > 10) {
      return;
    }
    const comp = vnode.component;
    if (comp) {
      scan(comp.setupState, 'setupState');
      if (comp.proxy) {
        scan(comp.proxy, 'proxy');
      }
      if (comp.provides) {
        scan(comp.provides, 'provides');
      }
      if (comp.setupState && typeof comp.setupState === 'object') {
        // 组件里常把 store 存成某个 ref
        for (const k of Object.keys(comp.setupState)) {
          const val = comp.setupState[k];
          if (val && val.$state && typeof val.$state === 'object') {
            scan(val.$state, 'piniaStore:' + k);
          }
        }
      }
    }
    if (vnode.suspense) {
      /* 跳过 */
    }
    if (Array.isArray(vnode.children)) {
      vnode.children.forEach(c => c && typeof c === 'object' && visit(c, depth + 1));
    }
    if (vnode.subTree) {
      visit(vnode.subTree, depth + 1);
    }
    if (comp && comp.subTree) {
      visit(comp.subTree, depth + 1);
    }
  }

  const root = app._instance || app;
  visit(root && root.subTree ? root.subTree : root, 0);
  out.found = out.found.slice(0, 45);

  // 顺便看看咪咕内部 SDK 和本地存档里有没有歌曲信息
  try {
    if (window.MiGuAmberSdk) {
      out.sdk = Object.keys(window.MiGuAmberSdk).slice(0, 20);
    }
  } catch (e) { /* 忽略 */ }

  try {
    const hits = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || '';
      if (v.length < 3000 && /songName|singer|musicId/i.test(v)) {
        hits[k] = v.slice(0, 300);
      }
    }
    out.localStorageHits = hits;
  } catch (e) { /* 忽略 */ }

  console.log('=====Vue组件树侦察-整段复制发回=====');
  console.log(JSON.stringify(out, null, 2));
})();
