# Emily Development Guide

## 当前阶段：电脑端 Pi 本地接续开发（2026-09-30）

本文件是唯一的项目当前执行状态入口。日期交接快照见 [handoff-to-pi-20260930.md](handoff-to-pi-20260930.md)，机器可读验证见 [handoff-verification-20260930.json](handoff-verification-20260930.json)。

- 最新授权：David 确认后续都在本目录推进，要求Pi整体检查后持续开发，需本人输入时集中说明，不逐步重复确认。Codex负责Pi的Cloudflare MCP配置；Pi负责Emily源码和后续网站准备，本轮未做公开部署、DNS或费用变更。
- 当前写入者：Pi，任务 `01a0f204-d57a-75b4-93d4-c35f2fa8aeae`；原交接整理与验证由 Iris / Hermes default 执行，原任务 `emily-v1-english-20260930`。
- 本机接续目录：`C:/workspace/codex/work/Emily`；分支 `pi/emily-continue-20260930`，基于 Iris 交接提交 `c7af2c2ce8a01e023647e2047befa525aa68c6b4`。
- 接续前已确认 `C:/workspace/codex/音乐开发` 为干净旧 main，使用独立 worktree 保留原目录和分支；来源分支 `iris/emily-v1-english-20260930`，不覆盖 main。
- Iris 已停止功能开发，不再并发修改 Pi 后续责任源码。原两个 Hermes 子代理均已结束，无仍在后台执行的开发子代理。
- 范围继续有效：独立个人 Web/PWA 电台、个人登录、网易云本人权益、英文女声、精致移动优先视觉；主要设备为小米12S安卓Chrome。不做公众房间、共享VIP池或主站联动。
- 当前代码：React/Vite 前端、Fastify 后端、SQLite、NetEase HTTP 适配、OpenAI-compatible 编排、Edge英文TTS、实际音频状态机、PWA和测试。接口见 [api-contract.md](api-contract.md) 及 `packages/shared/src/index.ts`。
- Iris 历史验证：`npm ci`、类型检查、构建和编译启动检查通过；前端26/26、后端21/23，共47通过、2失败。真实英文Edge合成、解码、缓存复用通过。锁文件修正后的当时审计报告0项漏洞。Pi 本机结果见下节，不能将历史 Linux 结果当作 Windows 实测。
- Pi 已修复原两项失败：有界、去重的单首主持预准备；pause 不走网络动作互斥，使用暂停版本阻止迟到 play/next 恢复播放。其他准备动作仍互斥。原断言保留并新增 play、清空、声线变化与关闭竞态测试。
- Iris 的英文主持自由文本修正已保留；`model-hosting.test.ts`三项回归通过。常见无依据事实筛选不等于完整事实认证。
- 尚未验收：本人网易云登录/会员整曲/CDN、实际模型通道、真实外部音源的浏览器连续播放、小米物理后台与PWA行为、公开HTTPS部署。Chrome使用明确HTTP/MP3 fixture的整合链路已通过，见第二阶段结果。
- 交接边界：本次允许提交和同步Git开发分支；不据此覆盖 `main`、丢弃本机修改、推送秘密、修改DNS或重启/发布生产服务。没有部署的网站可用性声明。

Linux原工作区仅供来源定位：`/srv/agent-workspace/worktrees/bjcdeshu/Emilybjcmusic/iris/emily-v1-english-20260930`。此路径不是电脑端接续路径；Git同步不等于已更新电脑工作树。

## Pi 第一阶段结果（2026-09-30，本地提交1f282a7）

- Windows Node `24.16.0` / npm `11.17.0`；`npm ci`、`npm run typecheck`、后端 `typecheck:tests`、完整 `build` 均通过。前端26/26、后端26/26，共52/52，0跳过；`test:built` 实际回环启动/health 200/受保护接口503/优雅退出0；`git diff --check` 通过；当次 `npm audit` 0报告。
- 真实 `test:tts`：Emma 英文女声元数据、MP3 36,288字节/6.048秒、ffmpeg解码与缓存复用通过。无本人账号或模型配置读取。
- Windows 修正：临时目录采用 `TMPDIR` 或 `os.tmpdir()`；TTS支持允许的绝对exe路径及最小Windows子进程环境；Unix shebang测试通过显式Node CLI fixture执行（生产仍为无shell execFile）；编译启动检查用父进程IPC优雅退出，不误用Windows强制kill作为信号验收。
- 音频防护：Windows不执行 `O_NOFOLLOW`，原回归实际暴露符号链接可被跟随；新增lstat及文件句柄身份检查，原symlink/Range断言通过。新增 `.gitignore` 排除默认私有数据目录和SQLite。
- 私有数据限制：POSIX mode断言不当作Windows ACL证明。已看到work目录具有广泛继承权限；**连接真实凭据前必须配置并核验主人专用私有数据目录ACL**，目前未创建真实账号数据，未改变现有目录权限。
- 实际 Chrome `154.0.8037.58`（无头）已跑登录、收听/节目/历史/设置导航、真实缺音乐适配器状态；393×851视口无横向溢出。真实受保护Edge音频由HTMLAudio解码播放至ended，duration/currentTime均6.048秒；无pageerror。不是人工试听或主持→网易歌曲完整验收，也不是物理手机验证。
- 浏览器工具与截图在 `C:/workspace/codex/work/.tmp/emily-browser-tools/`，未加入项目依赖；查看了桌面与移动截图，保留Iris原有视觉实现。机器结果见 `docs/pi-verification-20260930.json`。临时服务、浏览器和测试媒体均已关闭/清除。
- 现有Fastify弃用警告保留记录，未为此升级工具链。本轮只在独立Pi分支开发，不覆盖main、不部署、不推送秘密。

## Pi 第二阶段：整体检查与浏览器联合验证（2026-09-30）

- 修复实际PWA阻塞：manifest/SW引用的 `/icon.svg`、`/icons/emily-*.png` 原来被静态服务拒绝，导致SW安装失败；现在只放行明确公开图标，不开放任意私有文件。更新shell缓存v2。
- 新增项目内可复跑 `npm run test:browser`（Playwright开发依赖、已安装Chrome或显式 `EMILY_BROWSER_EXECUTABLE`、ffmpeg）；真实浏览器跑同域登录→节目→主持音频→歌曲→下一首、暂停位置稳定、seek、安静模式、喜欢、历史、声线选择/保存、退出清空音频、SW控制与离线外壳。缓存仅8个公开文件，无API/二维码/音乐。无pageerror、393px无横溢出；HTTP和tone MP3明确为测试fixture，绝不声称网易/真人试听通过。
- UI/合同修正：历史重编排上限原20超出后端12，统一共享 `MAX_PROGRAMME_TRACKS`；声线从手输ID改为前后端共享allowlist下拉选项；浏览器发现保存成功提示被settings effect立即清除，已修复。
- QR边界修正：`call(..., undefined)`会触发默认Cookie参数，匿名QR申请/轮询原来可能带已有账号Cookie；改为明确null，新增HTTP回归验证不带Cookie。
- 删除tsconfig把运行时模块映射到 `index.d.ts` 的路径别名，改用workspace真实exports；新增浏览器测试类型检查，不以宽松类型掩盖模块不匹配。
- 最新验证：干净 `npm ci`、完整typecheck（含浏览器）、后端测试typecheck、build、后端27/27+前端27/27、浏览器1/1，共55通过0跳过；编译入口和真实Edge合成/解码/缓存再次通过，当次audit0报告。新增机器证据保存在现有验证JSON的secondPhase。
- 部署准备见 [deployment.md](deployment.md)：保持Node/SQLite/子进程后端与同域前端，不误将Pages静态发布当全栈上线；私有适配器、主人扫码、应用专用模型、私有目录与缓存/Range/可信代理检查列清。
- Codex共享配置记录 `pi-cloudflare-mcp-20260930`已确认OAuth与工具发现完成；当前Pi旧会话 `mcp({connect:"cloudflare-api"})`仍返回server not found，需 `/reload` 或重启后采用配置。Pi未读取凭据、未重新安装MCP、未修改Cloudflare云资源。

## Pi 第三阶段：Cloudflare核对与部署工程准备（2026-09-30）

- David `/reload` 后要求继续推进；Pi已成功连接Codex配置的 `cloudflare-api`，只读GET核对 `unbow.de` active、权威NS、Emily子域无记录、SSL strict、既有origin rules及active page rules。没有修改DNS、资源、账户或费用；第二阶段旧会话不可用记录仅是历史。
- 复用已配置SSH并严格校验主机公钥，RN/NC hostname匹配历史导航。已读RN实际运维RUNBOOK/INVENTORY；只读检查RN与Emily相关运行时、余量、端口、目录和专用用户，未安装/写入/重启服务器。RN约4.4GiB可用内存、41GiB空闲磁盘，系统Node22.23.3、npm10.9.9；3000已占用，3100/3101未占用。Node22兼容和专用TTS仍需部署前实测，不能沿用Windows验收结论。
- 新增 `scripts/deployment-preflight.mjs` 与6项测试：只读离线检查配置完整性、HTTPS/回环、私有目录/文件及现有状态权限、构建外壳和TTS执行文件，不打开SQLite、不调用外部服务、不显示秘密；WindowsACL未核验明确阻断。
- 新增待审核 `deploy/emily.service.example` 与 `deploy/nginx-locations.conf.example`，独立非root服务、私有数据、禁止API缓存/落盘、保留Range、关闭票据访问日志。只是本地模板，未安装或在目标OpenResty/systemd执行验证。
- 当轮完整构建/typecheck、后端测试typecheck、后端27/27、前端27/27、部署预检6/6、Chrome fixture1/1，共61通过0跳过；编译入口再次通过，production依赖audit0报告。仍有Fastify弃用警告，真实网易/模型/手机/HTTPS未验收。
- 方案与只读快照详见 [deployment.md](deployment.md)。RN与 `emily.unbow.de` 是候选，不是已批准发布目标。网易候选上游默认开启general unblock，必须审核固定版本并关闭后才接入，不直接运行latest。

## 下一步

1. 集中向David确认候选RN+独立Emily子域及新专用服务/适配器安装、反代/DNS发布范围；不动主站或网关。按获准目标核验machine-id并准备窄范围回滚。
2. 通过安全文件提供Emily专用模型key并确定模型/费用；主人口令与AES key可在受保护目录生成，不复制其他代理身份。本人扫码确认另走安全页面。
3. 专用运行时与适配器审核/固定、Linux测试与权限验证、真实浏览器外部连续音源联调后，按批准范围公开HTTPS并完成小米验收。真实外部成功前保持缺配置状态，不把fixture当会员整曲证据。

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
