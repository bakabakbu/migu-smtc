# 版本发布流程

本项目采用「易变更即发布」的轻量流程，一个人也能维护得动。

## 发一次版本要做的 5 件事

1. **改代码**：只做必要的精准修改，避免整文件重写；
2. **改版本号**：`migu-smtc.user.js` 头部的 `@version` 按[语义化版本](https://semver.org/lang/zh-CN/)递增
   - 修 bug → 修订号 +1（0.5.1 → 0.5.2）
   - 新功能 → 次版本 +1（0.5.x → 0.6.0）
   - 不兼容改动 → 主版本 +1（0.x → 1.0.0）
3. **补 `CHANGELOG.md`**：在顶部新增对应版本条目（CI 会检查版本与日志是否一致）；
4. **浏览器实跑验收**：安装 → 刷新 → 看卡片 → 切歌 → 暂停/播放 → 媒体键 → 一键诊断，六步全过；
5. **提交并打 Tag**：

   ```bash
   git add -A
   git commit -m "fix: 修 xxx（v0.5.2）"
   git tag v0.5.2
   git push origin main --tags
   ```

## 打完 Tag 之后

- GitHub → **Releases → Draft a new release** → 选择刚打的 Tag；
- 标题写 `v0.5.2`；
- 内容直接**从 CHANGELOG 对应条目复制**；
- 勾选 **Set as the latest release** → Publish。

## 关于自动更新

用户是通过下面的 raw 地址安装的，脚本猫会按自身策略定期检查更新：

```text
https://raw.githubusercontent.com/bakabakbu/migu-smtc/main/migu-smtc.user.js
```

因此：**只要 main 分支上的脚本头 `@version` 涨了，用户侧就会自动更新**，无需额外操作。遇到急修时，用户也可以在脚本猫里手动点「检查更新」。

> 注意：raw 链接有缓存，刚推送的更新可能几分钟后才生效，属正常现象。
