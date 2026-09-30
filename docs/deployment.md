# Emily 上线准备

本页是部署方案和验收清单，不是已上线声明；当前状态以 [development.md](development.md) 为准。

## 当前适合的部署方式

保持现有同域全栈应用：专用 Node 服务运行在服务器回环端口，Cloudflare 负责域名/DNS及合适的HTTPS入口。前端构建由同一应用提供，`/api/*`、主持音频和歌曲Range请求同域。

当前后端使用 `node:sqlite`、本地持久目录和 `uvx/edge-tts` 子进程，不能只上传前端到Cloudflare Pages就称系统已上线，也不能不改架构直接当普通Worker运行。首版优先复用合适的现有Node服务器，而不是为了Cloudflare重写成D1/Workers/R2。只有确认服务器与代理限制后再选入口；MCP工具可用不等于资源已经获准修改。

## 需要核对的最少输入

1. 目标服务器和独立Emily子域名，现有反代/端口/部署管理方式。不能覆盖个人主站、复用未知登录态或重启其他生产服务。
2. 主人专用口令与32字节AES-GCM key，通过服务器私有环境文件/安全输入提供，不发聊天、不写Git或日志。加密key丢失会无法恢复已保存的音乐授权，备份须同样受保护。
3. 操作者控制的NetEase兼容适配器base及其实际版本。必须关闭 `ENABLE_GENERAL_UNBLOCK`，无解锁/匹配/替换插件。适配器网络应私有；跨机使用HTTPS与专用鉴权。
4. 应用专用OpenAI-compatible模型通道base/key/name；不自动复制Pi、Codex或Iris的凭据。实际费用由主人控制。
5. 本人网易云扫码确认及真实曲目权益。在外部验证前不承诺VIP整曲/地域连通。

## 服务与私有目录

- 运行已验证的Node版本（Windows24.16、Iris Linux26.7）；`npm ci` → `npm run build`，启动 `node --env-file=<私有文件> apps/server/dist/index.js`。
- 私有环境文件和数据目录都放在非源码、非同步、非Web目录。POSIX用主人/服务账户专属权限；Windows必须核验ACL，`chmod`的POSIX数字不构成ACL保护。
- 必须显式提供准确 `EMILY_PUBLIC_ORIGIN=https://<独立子域名>` 和 `EMILY_WEB_DIST_DIR`。`EMILY_HOST`默认回环，不直接暴露无TLS的服务端端口。
- `.env.example`只是公开模板，不代表已配置。服务缺主人口令时保护接口故意关闭。
- 保留SQLite、AES key与设置备份；先停专用实例或使用SQLite一致性备份方式，不复制正在写入的未知状态。升级和回滚不删除私有状态。
- Edge是非官方在线服务，无SLA；保持明确text_only/tts_failed状态及可替换接口。

## Cloudflare / 反向代理注意事项

- Codex负责此次Pi Cloudflare MCP接入；Pi当前旧会话需reload后发现服务，再只读核对账户、zone、已有DNS和资源。
- DNS/公开入口的目标须确认；保留原记录、原服务和回滚信息，不默认创建付费资源。
- `/api/*`、二维码、媒体音频必须绕过边缘及反代缓存；不能采用全站Cache Everything规则。尊重private/no-store，不缓存Set-Cookie；登录Cookie为Secure/HttpOnly/SameSite=Strict。
- 保持Range/Content-Range/Accept-Ranges，不把媒体错误改写成index.html；无通用任意URL代理。
- JS/CSS哈希资产可immutable；index、manifest、sw必须可更新。图标路径 `/icon.svg`、`/icons/emily-*.png` 必须实际200。
- 不盲信外部Forwarded/X-Forwarded-*；当前Fastify `trustProxy=false`，反代后登录限流按代理入口聚合。若需要可信真实IP，必须按固定代理拓扑另做验证，不直接开放信任所有代理。
- 对媒体传输/Cloudflare入口限制核对适用条款与能力，不凭MCP连通就保证音频代理合适。

## 验收与放行

- 本地：typecheck、后端测试类型检查、前后端测试、build、`test:built`、`test:tts`、`test:browser`。
- 可复跑浏览器检查默认使用已安装Chrome；或设 `EMILY_BROWSER_EXECUTABLE` 指向允许的浏览器。需ffmpeg生成明确test-only音频，无真实账号读取。Playwright为开发依赖，不进入生产业务。
- 测试fixture成功只证明浏览器/接口/真实解码切换，不证明网易或模型连通。
- 真实账号：扫码/重启后加密授权、本人歌单、会员/许可整曲、不可用/试听歌曲明确排除、实际CDN和模型返回、节目主持→歌曲→下一首、seek/安静模式/暂停/恢复/错误提示。
- 浏览器PWA：图标和SW200，实际ready/controller，离线外壳能打开、私有API/二维码/歌单/音频不在Cache Storage，退出清空播放器。
- 小米12S：真实HTTPS、扫码返回、自动播放限制、锁屏按钮、后台/熄屏连续收听及PWA安装；桌面手机视口不代替真机。
- 最后才给主人试用链接。费用、新资源或可能影响既有生产服务的动作按当次范围处理，不能把测试成功当已公开发布。
