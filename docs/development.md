# Emily Development Guide

## 当前阶段：RN部署及本人扫码前验证（2026-09-30）

本文件是唯一的项目当前执行状态入口。日期交接快照见 [handoff-to-pi-20260930.md](handoff-to-pi-20260930.md)，机器可读验证见 [handoff-verification-20260930.json](handoff-verification-20260930.json)。

- 最新授权（2026-09-30）：David确认持续在本目录由Pi开发，并明确同意部署到RN，承接已提出的 `emily.unbow.de`、专用服务/私有适配器/TTS、独立HTTPS反代与DNS范围；不改主站、不升级系统Node、不重启其他业务。模型使用OAPI，优先Gemini；具体可用模型及Emily专用key仍需核验，未授权复制其他代理密钥或任意修改网关通道。普通实现与必要验证直接推进，需本人输入集中说明。Codex本次负责Cloudflare MCP配置，Pi负责源码及部署；已完成RN独立Emily服务、DNS及HTTPS部署，真实本人音乐授权和最终手机验收仍未完成。
- 当前写入者：Pi，任务 `01a0f204-d57a-75b4-93d4-c35f2fa8aeae`；原交接整理与验证由 Iris / Hermes default 执行，原任务 `emily-v1-english-20260930`。
- 本机接续目录：`C:/workspace/codex/work/Emily`；分支 `pi/emily-continue-20260930`，基于 Iris 交接提交 `c7af2c2ce8a01e023647e2047befa525aa68c6b4`。
- 接续前已确认 `C:/workspace/codex/音乐开发` 为干净旧 main，使用独立 worktree 保留原目录和分支；来源分支 `iris/emily-v1-english-20260930`，不覆盖 main。
- Iris 已停止功能开发，不再并发修改 Pi 后续责任源码。原两个 Hermes 子代理均已结束，无仍在后台执行的开发子代理。
- 范围继续有效：独立个人 Web/PWA 电台、个人登录、网易云本人权益、英文女声、精致移动优先视觉；主要设备为小米12S安卓Chrome。不做公众房间、共享VIP池或主站联动。
- 当前代码：React/Vite 前端、Fastify 后端、SQLite、NetEase HTTP 适配、OpenAI-compatible 编排、Edge英文TTS、实际音频状态机、PWA和测试。接口见 [api-contract.md](api-contract.md) 及 `packages/shared/src/index.ts`。
- Iris 历史验证：`npm ci`、类型检查、构建和编译启动检查通过；前端26/26、后端21/23，共47通过、2失败。真实英文Edge合成、解码、缓存复用通过。锁文件修正后的当时审计报告0项漏洞。Pi 本机结果见下节，不能将历史 Linux 结果当作 Windows 实测。
- Pi 已修复原两项失败：有界、去重的单首主持预准备；pause 不走网络动作互斥，使用暂停版本阻止迟到 play/next 恢复播放。其他准备动作仍互斥。原断言保留并新增 play、清空、声线变化与关闭竞态测试。
- Iris 的英文主持自由文本修正已保留；`model-hosting.test.ts`三项回归通过。常见无依据事实筛选不等于完整事实认证。
- 尚未验收：本人网易云登录/会员整曲/CDN、实际模型通道、真实外部音源的浏览器连续播放、小米物理后台与PWA行为。公开HTTPS与受保护登录/QR生成已实际验证（见第四阶段），不能因此宣称会员整曲通过。Chrome使用明确HTTP/MP3 fixture的连续播放整合链路已通过，见第二阶段结果。
- 交接边界：允许提交和同步Git开发分支；不覆盖 `main`、丢弃本机修改或推送秘密。后续RN独立Emily部署与DNS已获David本轮批准（见最新授权），历史交接本身不授予其他生产操作权限。网站已部署，但仍处于本人扫码前的外部联调阶段，不宣称完整收听验收通过。

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

## 本轮发布批准（2026-09-30）

David直接回复：同意部署到RN，模型使用OAPI、优先Gemini。承接上轮已说明的独立子域和窄范围服务安装/反代/DNS方案；不再重复询问这两个方向。已读取NC实际网关RUNBOOK和RN fleet身份校验入口，没有读取网关密钥、复制其他代理凭据或修改网关。Gemini可用性尚未通过Emily专用令牌核验；缺少令牌时不声称模型已连通。

## Pi 第四阶段：RN专用部署及扫码前检查（2026-09-30）

- David保存Emily专用OAPI key后，Pi重新核验本机私有输入ACL（仅David/SYSTEM/Administrators）。`/v1/models`列出10个模型，其中Gemini为 `gemini-3.8-flash`；Windows实际ProgrammeSelector编排5.6秒、RN专用用户实际编排12.1秒均返回model、2个目录内条目、英文校验通过。使用明确synthetic test metadata，未入库/伪装真实音乐。配置HTTP timeout30秒，不读其他代理key、不改OAPI通道。
- 严格SSH+hostname+stripped machine-id核对后，建立专用 `emily` 非root服务用户，`/etc/emily`及数据目录0700、环境/SQLite0600；生成独立主人密码、AES key和适配器token。专用key经SSH传入私有环境，临时输入删除；密码仅保存本机 `C:/Users/David/AppData/Local/Emily-private/owner-password.txt` 及服务器私有文件，未打印。全局Node未升级。
- RN系统Node22.23.3/npm10.9.9实际 `npm ci`、typecheck、测试typecheck、build、后端27/27+前端27/27+离线预检6/6=60项通过0跳过、test:built通过；Node22的SQLite experimental与Fastify弃用警告保留。独立venv固定edge-tts7.2.3、依赖freeze，专用用户真实TTS MP3 36,864字节/6.144秒、解码/缓存通过。
- 网易upstream固定 `135df9eddab12cc8879f63c090c0ce808040504f`（4.40.1，保留MIT LICENSE），移除unblock依赖及song_url_v1解灰分支/song_url_match；锁文件与audit留RN专用目录，audit0。`deploy/prepare-netease-upstream.mjs`按两文件SHA256核对后复现窄补丁，不运行upstream public server。`deploy/netease-bridge.cjs`仅9个固定POST接口、token鉴权、16KB请求/4MB响应、并发/超时限制、禁日志/缓存/Set-Cookie/代理与解灰。
- upstream新xeapi security-key注册在RN超时，初始适配器启动失败已停并处理；桥接将xeapi模块请求改为eapi传输，仍向NetEase原始接口使用本人授权，不地域伪装/替换音源。实际QR图生成HTTP200、轮询waiting通过。本人整曲尚未验证，如eapi授权/歌曲失败需按实际错误修正，不宣称已接入音乐。新增桥接fixture安全测试Windows1/1通过，部署检查合计7项。
- systemd `emily.service` 和 `emily-adapter.service` 已安装并启用，分别只监听127.0.0.1:3100/3101，当前active/running，0 restart。正式服务用户offline preflight全通过。应用release由Git快照478a12e构建，后续部署材料提交另记录；无fixture进入production数据。
- Cloudflare仅新建 `emily.unbow.de` 的DNS-only A记录（TTL300），不经过CDN传输音乐；Let's Encrypt独立证书已签发。独立OpenResty站点配置通过nginx-t后平滑reload（未重启容器/其他业务）；private API不缓存/落盘、不记QR路径日志，HTTP308至HTTPS。证书私有配置位于 `/etc/emily/acme`，新增专用每日续期timer，实际cron检查exit0，未修改既有证书/计划任务。
- Windows真实Chrome154公开HTTPS、393×851：主人登录200、model configured、TTS available、music disconnected诚实、QR200/安全PNG/轮询waiting、全部图标/SW200、SW ready、退出清Cookie、无pageerror/横向溢出。不是本人扫码或真实歌曲验收。既有api200、mem307、mon200，原容器uptime未重置。
- 窄范围回滚入口 `/var/backups/emily-20260930/rollback.txt`（初次无旧Emily数据）；停止专用Emily units、撤销新增Emily nginx/DNS即可，保留私有状态。详情见deployment.md。未覆盖main或其他工作树。

## 下一步

1. 请David在 `https://emily.unbow.de` 用本机私有owner-password文件登录，再本人网易扫码确认；仅是授权入口，不要求先承担完整体验验收。密码/Cookie/QR票据均不要发聊天。
2. 扫码后以真实目录验证本人权益、整曲/CDN、Gemini节目和主持→歌曲连续播放、seek/暂停/安静模式及重启加密授权。任何真实失败如实修正，无解灰/替换。
3. 最后完成小米12S HTTPS/PWA安装、后台/锁屏播放与人工试听，才放行完整使用体验。

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
