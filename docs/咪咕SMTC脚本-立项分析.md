# 咪咕音乐 SMTC 元数据修复脚本 · 立项分析（ScriptCat 版）

> 载体：脚本猫 ScriptCat（兼容油猴） ｜ 版本：v0.1（立项草案） ｜ 日期：2026-10-18
> 用户引用中的 `@//name/`、`@//namespace/`、`@//match/`、`@//grant/`、`@//run-at/` 对应标准元数据键 `@name`、`@namespace`、`@match`、`@grant`、`@run-at`，下文统一使用标准写法。

---

## 1. 项目背景与目标

### 1.1 核心问题（一句话）

咪咕音乐网页版**未调用 `navigator.mediaSession`** 上报曲目信息，导致 Windows **SMTC（系统媒体传输控件）拿不到数据**，进而造成：

- Lyricify Fusion 无法识别当前曲目 → 歌词不显示；
- 系统音量控制栏不显示咪咕的播放卡片。

对照：QQ 音乐网页版已内置该上报，故一切正常。

### 1.2 脚本要解决什么

在**不修改咪咕服务端、不绕过付费、不下载音频**的前提下，于浏览器侧读取咪咕播放器已渲染的曲目信息（标题 / 歌手 / 专辑 / 封面 / 播放状态），主动写入 `navigator.mediaSession.metadata`，使 Chromium 将其同步给 Windows SMTC。

**数据链路**：

```
咪咕 DOM → 脚本提取 → navigator.mediaSession.metadata
   → Chromium 上报 → Windows SMTC
   → ①系统音量栏显示播放卡片  ②Lyricify Fusion 匹配曲目并取词
```

### 1.3 目标网站

| 目标 | URL 模式 | 优先级 |
|---|---|---|
| 咪咕音乐网页版 | `https://music.migu.cn/*` | P0 |
| 咪咕相关子域 | `https://*.migu.cn/*` | P1（防漏，需验证是否真有播放页） |
| 二期可扩展：酷狗 / 千千 / 汽水等同样缺失 SMTC 的网页播放器 | 各自域名 | P2+ |

### 1.4 使用场景

1. 用户在**浏览器内**听咪咕（不装客户端），希望 Lyricify Fusion 显示逐句歌词；
2. 用户希望按键盘音量键时，系统音量栏出现咪咕曲目卡片与上一首 / 下一首控制；
3. 用户使用 Edge / Chrome 多标签听歌，需跨标签媒体控制统一。

### 1.5 预期使用者

- 主要：**Windows 10/11 + Chromium（Edge / Chrome）+ 已装 Lyricify Fusion** 的桌面用户；
- 次要：仅想让系统音量栏显示咪咕曲目的普通用户（不需要 Lyricify）；
- 特征：具备基础 DevTools 能力（至少能按 F12 执行一行命令做诊断）。

### 1.6 项目提示（明确可以做）

- 可以破解 / 绕过咪咕会员、下载或解密音频；
- 自己抓取歌词（歌词由 Lyricify Fusion 按其"歌词源顺序"获取）；
- 可以后台常驻 / 定时任务（无需 `@background`、`@crontab`）。

---
## 3. 项目要求分析

### 3.1 功能需求（FR）

| 编号 | 需求 | 验收标准 |
|---|---|---|
| FR-1 | 提取当前曲目标题、歌手、专辑 | 播放任意歌曲后，SMTC 显示正确曲名与歌手 |
| FR-2 | 提取并上报封面图 | 系统音量栏出现专辑封面；无封面时优雅降级（不报错） |
| FR-3 | 上报播放 / 暂停状态 | 暂停时音量栏状态同步为暂停 |
| FR-4 | 切歌 ≤ 1s 内完成更新 | 手动切歌后，Lyricify 歌词随之更换 |
| FR-5 | 注册 play/pause/prev/next 动作句柄 | 系统媒体键可用（至少不报错） |
| FR-6 | 顶层帧守卫 | 页面含 iframe 时不重复上报、不冲突 |
| FR-7 | 能力检测与降级 | 不支持 `mediaSession` 时静默退出，不刷控制台 |
| FR-8 | 一键诊断 | 菜单命令输出：选择器命中情况 + 当前 metadata |
| FR-9 | 选择器可配置 | 用户在脚本猫配置面板改类名，无需改代码 |
| FR-10 | 咪咕原生 metadata 让位 | 检测到咪咕已自行上报时，脚本停止覆盖 |

### 3.2 非功能需求（NFR）

**性能**
- 曲目检测以 **MutationObserver（节流 300ms）为主、低频轮询（2s）为辅**，取消随机采样；
- 单次提取的 DOM 查询 ≤ 10 次（选择器按命中率排序，命中即止）；
- 空闲时 CPU 占用趋近于 0，不得影响音频播放流畅度。

**稳定性**
- 任意选择器 / DOM 异常均被 try-catch 包裹，绝不抛错到页面控制台；
- 页面SPA跳转、播放器重建后能自愈（Observer 重挂载）；
- 连续运行 8 小时无内存泄漏（Observer 与定时器在 `pagehide` 清理）。

**兼容性**

| 维度 | 支持范围 |
|---|---|
| 操作系统 | Windows 10 17763+ / Windows 11（SMTC 依赖） |
| 浏览器 | Edge、Chrome 等 **Chromium**（主支持）；Firefox 尽力而为；Safari 不支持 |
| 脚本管理器 | 脚本猫 ScriptCat v0.6+（需 `@match` / `@run-at` 支持） |
| 播放器 | Lyricify Fusion（SMTC 消费方），亦适配任何 SMTC 客户端 |

**安全性**
- 最小权限：默认 `@grant none`；每新增一个 GM API 必须有明确用途；
- 不使用 `eval`、不动态加载远程脚本、不 `@require` 第三方库；
- 不采集、不上传任何用户数据；不读取 cookie 与登录态；
- 若启用 `GM_xmlhttpRequest`，`@connect` 仅列咪咕图片/CDN 域，禁用 `*`。

---

### 3.3 ScriptCat 平台约束（关键）

#### 3.3.1 元数据规范

本项目推荐声明块（ScriptCat 原生）：

```js
// ==UserScript==
// @name         咪咕音乐 SMTC 修复（Lyricify Fusion / 系统音量栏）
// @namespace    https://github.com/<owner>/migu-smtc
// @version      0.1.0
// @description  为咪咕音乐网页版补齐 Media Session 元数据，使其接入 Windows SMTC
// @author       <author>
// @license      MIT
// @match        https://music.migu.cn/*
// @match        https://*.migu.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @inject-into  page
// @noframes
// @icon         https://music.migu.cn/favicon.ico
// @updateURL    https://<raw-host>/migu-smtc.user.js
// @downloadURL  https://<raw-host>/migu-smtc.user.js
// ==/UserScript==
```

各键作用与本项目取值理由：

| 键 | 本项目取值 | 说明 / 约束 |
|---|---|---|
| `@name` + `@namespace` | 组合唯一 | **两者共同决定脚本唯一性**，namespace 建议用个人主页地址，避免与他人脚本冲突导致误更新 |
| `@version` | 语义化三段 | 变更时提示用户更新 |
| `@match` | 两条 music.migu.cn / *.migu.cn | **优先用 `@match`**（标准 Match Patterns）；仅在 `@match` 表达力不足时才用 `@include`/`@exclude` |
| `@grant` | 按需显式列出 | **用几个就声明几个**；不声明则拿不到对应 GM API（静默失败） |
| `@run-at` | `document-idle` | 可选 `document-start` / `document-end` / `document-idle` / `document-body`（`document-menu` 已移除）。选 `document-idle` 是确保播放器 DOM 已挂载；配合 Observer 弥补时机 |
| `@inject-into` | `page`（ScriptCat 默认） | `page` 可访问页面 `window` 与 DOM；`content` 为隔离环境、**不能访问页面 window**，会使 `mediaSession` 写入与调试挂载失效，故必须显式锁定 `page` |
| `@noframes` | 启用 | 避免在 iframe 中重复注入导致 metadata 互相覆盖（对应 C2/S4） |
| `@connect` | 仅图片域（如需） | `GM_xmlhttpRequest` / `GM_cookie` 的目标域**必须显式声明**，否则请求被拦 |
| `@updateURL` / `@downloadURL` | 发布后补 | 未配置时用户只能手动更新 |
| `@background` / `@crontab` | **不使用** | 后台脚本与定时脚本**无 DOM**，本项目必须运行在页面上下文 |
| `@storageName` | 暂不需要 | ScriptCat 专属，仅在需要跨脚本共享数据时用 |
| `@early-start` | 不需要 | 仅配合 `document-start` 抢跑，本项目不追求抢在页面之前 |

#### 3.3.2 可用 GM_* API（本项目相关）

| API | 用途 | 备注 |
|---|---|---|
| `GM_registerMenuCommand` | 注册"诊断 / 重载配置"菜单 | ScriptCat 支持 `autoClose`、嵌套等扩展选项 |
| `GM_setValue` / `GM_getValue` / `GM_deleteValue` | 持久化用户自定义选择器 | ⚠️ ScriptCat 存储**底层异步**；`GM_setValue(k, undefined)` 等价于删除键 |
| `GM_notification` | 诊断结果 / 失效提醒 | ScriptCat 扩展了进度条与按钮，属平台专属能力 |
| `GM_xmlhttpRequest` | （可选）抓封面转 data URL | 需配套 `@connect`；支持 text/json/blob/arraybuffer/document/stream |
| `GM_addStyle` | 暂不需要 | — |
| `GM_openInTab` / `GM_setClipboard` | 暂不需要 | — |
| `GM_info` | ⚠️ **ScriptCat 不支持 `GM_info.runAt`** | 不要依赖它判断注入时机，改用 Observer 自愈 |

#### 3.3.3 跨域请求限制

- 页面内 `fetch` 受同源策略与 CSP 限制，**跨域必须用 `GM_xmlhttpRequest`**；
- 每次跨域目标域都要写进 `@connect`，**缺失即失败且往往无报错**；
- `@connect *` 虽可行但会显著扩大权限面、增加审核与信任成本，**本项目禁用**；
- 封面若走 `GM_xmlhttpRequest` + data URL，可规避防盗链，但需接受一次额外网络请求（应缓存，同一 URL 不重复抓）。

#### 3.3.4 运行时机限制

| 限制 | 应对 |
|---|---|
| `document-start` 时 DOM 尚未生成 | 不用；改 `document-idle` |
| `document-idle` 时 SPA 播放器可能仍异步渲染 | `MutationObserver` 持续监听，命中即上报 |
| SPA 路由切换不重新注入脚本 | 不依赖重新注入，Observer + 低频轮询双保险 |
| `run-at` 不一定严格等于页面就绪 | 不依赖 `GM_info.runAt`（ScriptCat 不支持），自行做能力检测 |
| **MV3 浏览器**需先开启"允许使用者脚本"或开发者模式 | 安装文档第一步必须写明，否则脚本完全不执行 |
| 后台 / 定时脚本无 DOM | 本项目不用 `@background` / `@crontab` |

---

## 4. 落地建议

### 4.1 脚本整体结构与模块划分

单文件交付（零依赖），内部按职责分 8 个模块：

```
migu-smtc.user.js
├─ ① meta       元数据块（ScriptCat 规范，见 §3.3.1）
├─ ② config     选择器与参数；优先 ==UserConfig== 可视化配置，回落到内置默认值
├─ ③ guard      顶层帧判断、mediaSession 能力检测、防重复注入、咪咕原生上报让位
├─ ④ extractor  DOM 提取：title/artist/album/cover/playState；支持 Shadow DOM 穿透
├─ ⑤ artwork    封面 URL 归一化（补全协议与绝对地址）；防盗链时转 data URL（带缓存）
├─ ⑥ writer     写入 navigator.mediaSession.metadata / playbackState / action handlers
├─ ⑦ scheduler  MutationObserver（节流 300ms）+ 2s 低频轮询 + play/pause 事件；pagehide 清理
└─ ⑧ diagnose   菜单命令：一键扫描命中情况、打印 metadata、重置配置
```

关键设计约定：
- **命中即止**：选择器数组按置信度排序，命中第一个有效值即返回，控制查询次数；
- **变更才写**：比对 `title|artist|album|cover` 指纹，无变化仅更新 `playbackState`，避免无谓重绘；
- **异常全兜**：每个模块独立 try-catch，任一环节失败不影响其它模块；
- **全局零污染**：调试入口默认关闭，开启时才挂到页面 `window`（`page` 注入模式下可直接挂，若切到 `content` 模式则改用 `unsafeWindow`）。

### 4.2 实现路径（分阶段）

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P0 迁移** | 按 §3.3.1 重写元数据块；加顶层帧守卫与能力检测；确认脚本猫能注入并执行 | 脚本在咪咕页面 console 打印启动日志 |
| **P1 校准**（最关键） | 用 DevTools 定位咪咕真实 DOM，确定 title/artist/album/cover/播放状态的确切选择器并写入 config | SMTC 正确显示曲名与歌手 |
| **P2 稳定** | MutationObserver 替代随机采样；指纹比对；SPA/懒渲染自愈 | 切歌 ≤1s 同步，长时间运行无泄漏 |
| **P3 封面** | URL 归一化；必要时 `GM_xmlhttpRequest` + `@connect` 转 data URL 并缓存 | 音量栏稳定显示封面 |
| **P4 易用** | `==UserConfig==` 暴露选择器；`GM_registerMenuCommand` 诊断；debug 开关 | 用户无需改代码即可适配改版 |
| **P5 发布** | 补 `@version` / `@updateURL` / `@downloadURL`；提交脚本猫市场 | 可自动更新 |

### 4.3 开发优先级

- **Must（不做则项目不成立）**：P0、P1 —— 注入 + 真实选择器，这是"能不能用"的分水岭；
- **Should**：P2、P3 —— 稳定性与封面，决定"好不好用"；
- **Could**：P4 —— 配置化，决定"咪咕改版后用户能否自救"；
- **Won't（本期）**：P5 之后的多平台扩展（酷狗 / 千千），以及自建歌词源。

> 建议：**P1 未完成前不要投入 P3/P4**。若咪咕页面结构始终取不到，整个方案需回退到"改用咪咕客户端 + Lyricify"的备选路径。

### 4.4 主要风险点与对策

| # | 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|---|
| R1 | **咪咕 DOM 无稳定标识 / 频繁改版** | 高 | 高 | 多候选 + 语义属性（`aria-label`、播放态）兜底；`==UserConfig==` 让用户自助改；脚本猫页面留反馈入口 |
| R2 | **封面防盗链导致 SMTC 无封面** | 中 | 中 | 降级为无封面（不报错）；必要时 `GM_xmlhttpRequest` 转 data URL + 缓存 |
| R3 | **SPA / iframe / Shadow DOM 导致漏检** | 中 | 中 | Observer 驱动 + `@noframes` + 顶层帧守卫 + Shadow 遍历 |
| R4 | **非 Chromium / 非 Windows 环境无效果** | 中 | 低 | 能力检测后静默退出；文档明确支持矩阵，避免用户误判为 Bug |
| R5 | **ScriptCat MV3 未开启"允许使用者脚本"** | 中 | 高 | 安装文档置顶提示；诊断菜单给出该项错误提示 |
| R6 | **权限膨胀**（`@connect *`、多余 `@grant`） | 低 | 中 | 最小权限原则；每次新增 grant 需在文档登记理由 |
| R7 | **咪咕未来自行接入 Media Session，与脚本冲突** | 低 | 中 | FR-10：检测到原生 metadata 即让位并提示 |
| R8 | **误判为风险脚本 / 合规争议** | 低 | 高 | 文档明示：仅读取页面已显示信息、不破解付费、不下载音频、不上传数据 |

---

## 附：立项结论

- **技术路径成立**：问题定位准确（咪咕缺 `navigator.mediaSession` 上报），修复点单一、可验证，不触碰版权与付费边界。
- **最大不确定性在 P1**：能否在咪咕真实 DOM 上稳定取到曲目信息。建议立项后**先用半天完成 P1 探针验证**，通过再全面投入。
- **载体选择合理**：脚本猫兼容油猴、支持 `==UserConfig==` 与菜单命令，且默认 `page` 注入模式是本方案能写入 `mediaSession` 的前提；无需用到其后台 / 定时能力。
- **建议首版范围**：只做咪咕 + Chromium/Windows，把"取得到、写得进、切歌跟得上"三件事做扎实，再谈扩展。
