# Emily Development Guide

## 当前阶段：电脑端 Pi 本地接续开发（2026-09-30）

本文件是唯一的项目当前执行状态入口。日期交接快照见 [handoff-to-pi-20260930.md](handoff-to-pi-20260930.md)，机器可读验证见 [handoff-verification-20260930.json](handoff-verification-20260930.json)。

- 最新授权：David 在 Pi 当前会话确认交接范围，并要求在本机 work 下继续开发；本轮先修复连续收听/暂停边界及 Windows 验证兼容，不做公开部署、DNS 或费用变更。
- 当前写入者：Pi，任务 `01a0f204-d57a-75b4-93d4-c35f2fa8aeae`；原交接整理与验证由 Iris / Hermes default 执行，原任务 `emily-v1-english-20260930`。
- 本机接续目录：`C:/workspace/codex/work/Emily`；分支 `pi/emily-continue-20260930`，基于 Iris 交接提交 `c7af2c2ce8a01e023647e2047befa525aa68c6b4`。
- 接续前已确认 `C:/workspace/codex/音乐开发` 为干净旧 main，使用独立 worktree 保留原目录和分支；来源分支 `iris/emily-v1-english-20260930`，不覆盖 main。
- Iris 已停止功能开发，不再并发修改 Pi 后续责任源码。原两个 Hermes 子代理均已结束，无仍在后台执行的开发子代理。
- 范围继续有效：独立个人 Web/PWA 电台、个人登录、网易云本人权益、英文女声、精致移动优先视觉；主要设备为小米12S安卓Chrome。不做公众房间、共享VIP池或主站联动。
- 当前代码：React/Vite 前端、Fastify 后端、SQLite、NetEase HTTP 适配、OpenAI-compatible 编排、Edge英文TTS、实际音频状态机、PWA和测试。接口见 [api-contract.md](api-contract.md) 及 `packages/shared/src/index.ts`。
- Iris 历史验证：`npm ci`、类型检查、构建和编译启动检查通过；前端26/26、后端21/23，共47通过、2失败。真实英文Edge合成、解码、缓存复用通过。锁文件修正后的当时审计报告0项漏洞。Pi 本机结果见下节，不能将历史 Linux 结果当作 Windows 实测。
- Pi 已修复原两项失败：有界、去重的单首主持预准备；pause 不走网络动作互斥，使用暂停版本阻止迟到 play/next 恢复播放。其他准备动作仍互斥。原断言保留并新增 play、清空、声线变化与关闭竞态测试。
- Iris 的英文主持自由文本修正已保留；`model-hosting.test.ts`三项回归通过。常见无依据事实筛选不等于完整事实认证。
- 尚未验收：真实浏览器主持→歌曲连续播放、本人网易云登录/会员整曲/CDN、实际模型通道、小米物理后台与PWA行为、公开HTTPS部署。
- 交接边界：本次允许提交和同步Git开发分支；不据此覆盖 `main`、丢弃本机修改、推送秘密、修改DNS或重启/发布生产服务。没有部署的网站可用性声明。

Linux原工作区仅供来源定位：`/srv/agent-workspace/worktrees/bjcdeshu/Emilybjcmusic/iris/emily-v1-english-20260930`。此路径不是电脑端接续路径；Git同步不等于已更新电脑工作树。

## Pi 本轮结果（2026-09-30）

- Windows Node `24.16.0` / npm `11.17.0`；`npm ci`、`npm run typecheck`、后端 `typecheck:tests`、完整 `build` 均通过。前端26/26、后端26/26，共52/52，0跳过；`test:built` 实际回环启动/health 200/受保护接口503/优雅退出0；`git diff --check` 通过；当次 `npm audit` 0报告。
- 真实 `test:tts`：Emma 英文女声元数据、MP3 36,288字节/6.048秒、ffmpeg解码与缓存复用通过。无本人账号或模型配置读取。
- Windows 修正：临时目录采用 `TMPDIR` 或 `os.tmpdir()`；TTS支持允许的绝对exe路径及最小Windows子进程环境；Unix shebang测试通过显式Node CLI fixture执行（生产仍为无shell execFile）；编译启动检查用父进程IPC优雅退出，不误用Windows强制kill作为信号验收。
- 音频防护：Windows不执行 `O_NOFOLLOW`，原回归实际暴露符号链接可被跟随；新增lstat及文件句柄身份检查，原symlink/Range断言通过。新增 `.gitignore` 排除默认私有数据目录和SQLite。
- 私有数据限制：POSIX mode断言不当作Windows ACL证明。已看到work目录具有广泛继承权限；**连接真实凭据前必须配置并核验主人专用私有数据目录ACL**，目前未创建真实账号数据，未改变现有目录权限。
- 实际 Chrome `154.0.8037.58`（无头）已跑登录、收听/节目/历史/设置导航、真实缺音乐适配器状态；393×851视口无横向溢出。真实受保护Edge音频由HTMLAudio解码播放至ended，duration/currentTime均6.048秒；无pageerror。不是人工试听或主持→网易歌曲完整验收，也不是物理手机验证。
- 浏览器工具与截图在 `C:/workspace/codex/work/.tmp/emily-browser-tools/`，未加入项目依赖；查看了桌面与移动截图，保留Iris原有视觉实现。机器结果见 `docs/pi-verification-20260930.json`。临时服务、浏览器和测试媒体均已关闭/清除。
- 现有Fastify弃用警告保留记录，未为此升级工具链。本轮只在独立Pi分支开发，不覆盖main、不部署、不推送秘密。

## 下一步

1. 在可核验、保护好的本机私有目录通过安全入口配置应用专用模型与主人网易适配器；不要复制其他代理身份或未知登录态。
2. 本人扫码确认与费用事项由David控制。真实外部成功前保持缺配置状态，不把fixture当会员整曲证据。
3. 完成真实浏览器主持/歌曲连续、seek、安静模式、暂停与切歌联调，再按当次授权部署及物理小米验收。

## 历史基线：Phase 2 mock（保留原有贡献）

此前第二阶段包含工程骨架和mock播放器闭环，未接真实音乐、OAI模型、TTS或SQLite。以下是该阶段的原记录，不再将“暂不实现”解释为当前开发禁令。

### 当时的本地命令

```sh
npm install
npm run dev
npm run dev:web
npm run dev:server
npm run typecheck
npm run build
```

### 当时的范围

已实现的mock闭环：

- `GET /api/health`
- `GET /api/now`
- `GET /api/queue`
- `POST /api/player/play`
- `POST /api/player/pause`
- `POST /api/player/next`
- 前端读取当前状态、显示mock歌曲、队列和串场文案
- 播放、暂停、下一首改变后端状态

该阶段未实现真实音乐平台、OAI-compatible模型、TTS、SQLite和登录鉴权。此列表仅描述历史基线，不代表当前代码缺少这些模块或禁止继续实现。
