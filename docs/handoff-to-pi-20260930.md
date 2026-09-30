# Emily 交接给电脑端 Pi Agent

日期：2026-09-30。交接整理与本轮独立验证：Iris / Hermes default。

**这是保留有效实现、已知缺陷和证据的开发快照，不是完成版、发布版或全链路验收通过声明。** David 当前明确要求转交电脑上的 Pi Agent 推进。Iris 停止继续实现功能；两个 Hermes 子代理已结束，没有仍在后台写入本仓库的开发代理。Pi 尚未被宣称已启动。

## 接续入口

- 仓库：https://github.com/bjcdeshu/Emilybjcmusic
- 必须获取的分支：`iris/emily-v1-english-20260930`。
- 基线提交：`2accf31966ea4b5778e4bd0f1ccab6a6df4e421b`；当前代码和交接文件在接续分支的 HEAD。不要只拉 `main` 后误认为新实现缺失。
- 推荐阅读：`AGENTS.md` → 本文 → `docs/development.md` → `docs/api-contract.md` → `apps/server/README.md`、`apps/web/README.md`。
- 当前执行状态只维护于 `docs/development.md`；本交接是有日期的快照。

电脑端接续前，先读取电脑端全局规则与目标目录已有规则，检查现有仓库路径、分支和未提交修改。不要覆盖已有工作，不要凭此文执行 `reset --hard`、清理或强推。

没有本地仓库时，可选一个尚不存在的目录获取：

```sh
git clone --branch iris/emily-v1-english-20260930 https://github.com/bjcdeshu/Emilybjcmusic.git Emily
cd Emily
```

已有仓库且可能存在本地修改时，先检查并保留修改，再取远端；可用新 worktree 接续，而不是覆盖现有目录：

```sh
git status --short --branch
git fetch origin
git worktree add -b pi/emily-continue-20260930 ../Emily-pi-handoff origin/iris/emily-v1-english-20260930
```

示例分支或目录若已存在，应选择新的接续路径，不删除别人的文件。Git 同步不代表 Windows 工作树、依赖、私有配置或浏览器登录态已经同步。

## 已确认的产品需求

- Emily 是产品，不是另一个代理。它是 David 自己的跨设备个人电台。
- 独立 Web / PWA；unbow 只提供公网子域名，与个人主站无关联。个人登录保护入口，不开放公众注册、多用户房间或共享会员池。
- 主要设备为小米 12S、安卓、手机 Chrome。在车内也直接用手机网页，不要求首版车机集成。
- 音乐来源是网易云，接续必须验证操作者本人的授权与曲目权益。不预设会员档位，不走解锁、解灰或替换音源。
- 主持当前为**英文女声**，以 mmguo 的 Claudio 演示的节目感为参考。早先中文方案已被取代；精确声线不是永久定稿。
- 视觉质量是首版要求，不能只给功能壳。原三张参考图片保留未改；原型出处见 https://mmguo.dev 的 Claudio x mmguo FM。
- 先完成开发方测试，再让主人试用；没有硬性交付截止时间。移动收听场景不构成赶工豁免测试的理由。
- 不需要继续让 David 填框架、数据库、颜色等低风险技术问卷。涉及本人账号确认或实际费用时，通过安全入口再处理。

## 已有实现与归属

前端 `apps/web/**` 由 Hermes 子代理实现；后端 `apps/server/**` 由另一 Hermes 子代理实现。Iris 负责共享类型、接口约定、依赖锁文件、独立验证与交接。不是电脑 Codex 或 Pi 已完成的工作。

- 前端：个人登录/缺配置状态、网易云 QR 界面、节目与歌单/搜索、播放器、设置、安静模式、反馈、历史、沉浸模式和静态 PWA。
- 真实 `<audio>` 状态机：主持 → 歌曲 → 下一首，实际进度/seek/音量、Media Session 和异步暂停边界。测试使用的 FakeAudio 明确为 fixture。
- 后端：Fastify、单主人会话、SQLite、AES-GCM 授权保存、配置式网易 API、目录内选曲、英文 TTS、缓存、受保护的 MP3/音乐代理与 Range。
- `packages/shared/src/index.ts`、`docs/api-contract.md` 是共用类型和接口；新增的 `/api/media/track/:id` 已沿用 `Track.audioUrl`。
- Iris 已把模型从仅选固定句子菜单，改为生成简短自然英文标题、理由和主持词，同时保持精确目录 ID、长度/格式及常见无依据事实检查。`model-hosting.test.ts` 的三项回归当前通过。这个检查不是完整事实认证，不能因此声称每段稿件的事实都已验证。
- 依赖锁文件已做范围内修正；当前审计为 0 报告项。没有使用 `--force` 升级或改变已有服务器配置。

## 验证结果

本次由 Iris 在 Linux 重新执行，不只引用子代理自报。记录时间：`2026-09-30T11:19:22.586482+00:00`；环境：Node `v26.7.0`、npm `11.19.0`。

机器可读快照：`docs/handoff-verification-20260930.json`。

- `npm ci`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run test --workspace @emily/web`：26/26 通过，0 跳过。
- `npm run typecheck:tests --workspace @emily/server`：通过。
- `npm test --workspace @emily/server`：21/23 通过，2 项失败，0 跳过。是下节明确列出的红测试，未删除或跳过。
- `npm run test:built --workspace @emily/server`：编译入口实际在回环随机端口启动；health 200，未配置主人时 `/api/now` 为 503，正常退出 0。
- `npm run test:tts --workspace @emily/server`：实际 Edge 英文女声 `en-US-EmmaMultilingualNeural` 元数据验证；MP3 36,288 字节、6.048 秒，ffmpeg 解码和缓存复用通过。
- `npm audit --json`：当前快照报告 0 项漏洞，不表示未来审计永远为 0。
- `git diff --check`：通过。

共 49 项测试，47 通过、2 失败。不能写成「全部测试通过」。Node 26 下存在 tsx/Fastify 弃用警告，当前未令构建失败；不是要在交接阶段重做工具链的理由。

## 两项已复现、尚未修复的缺陷

准确的回归文件：`apps/server/test/radio-boundaries.test.ts`。根因位于 `apps/server/src/radio.ts`。Iris 在 David 转交指令前只补了红测试，**尚未改 Radio 的这两处实现**。

### 1. 下一段主持音频没有提前准备

失败测试：`upcoming DJ audio is prefetched while the current programme is available`。

当前创建节目只合成首段；后续到 `prepare()` 才调用 TTS，下一首时可能等待实时合成。接续应考虑有界预准备、缓存复用、新节目/声线变化与退出时的旧任务处理。不要把 API 等待或假进度条伪装成连续音频。

### 2. 下一首准备期间，服务端暂停被拒绝

失败测试：`owner pause succeeds and stays authoritative while next-track preparation is pending`。

`Radio.pause()` 走同一个 `exclusive()`；下一首还在准备时，暂停得到 HTTP 409。前端本机音频仍会暂停，但服务端可能未同步；异步准备结束还可能保留原播放意图。接续须保持用户暂停优先，避免迟到结果恢复播放。不是放松所有互斥或删掉竞态测试。

单独复现：

```sh
node --import tsx --test apps/server/test/radio-boundaries.test.ts
```

英文主持修正的回归：

```sh
node --import tsx --test apps/server/test/model-hosting.test.ts
```

## 尚未验收，不应推断为已可用

- 真实浏览器联合交互、视觉与真实 HTML 音频播放；Playwright 只在 Iris 的临时工具环境安装，**没有完成浏览器验收，也不是仓库的新依赖**。
- 本人网易云 QR 确认、真实会员整曲、CDN/地域连通和实际适配器运行。当前网易与模型自动测试是 HTTP fixture，不是外部成功证据。
- 真实 OpenAI-compatible 模型通道。模型输出需按实际网关验证；当前通用 HTTP 超时是 12 秒，不是已经验证适合所有模型的承诺。
- 小米 12S 物理锁屏/后台播放、手机实际 PWA 安装和跨设备体验。桌面缩小窗口不等于这些通过。
- 公开子域名、HTTPS、正式主人登录及部署。没有创建 DNS、公开站点、发布版本或重启既有服务。

## 运行与私有配置

根 `.env.example` 已换为实际读取的 `EMILY_*` 变量；旧 PORT/HOST/OAI/MOCK/FISH 示例不再是当前配置入口。`.env` 不会被普通 npm 命令自动读取。

在仓库根目录完成构建、通过本地安全方式配置私有 `.env` 后：

```sh
node --env-file=.env apps/server/dist/index.js
```

示例为同域合并服务，准确本地 Origin `http://127.0.0.1:3000`。Vite 双进程开发需显式传入变量并改成准确的 5173 Origin。不要一边使用 localhost 一边配置 127.0.0.1。

需要接续方提供/确认的配置：主人口令、准确 Origin、私有数据目录、网易 API base、32 随机字节的授权加密 key（64 hex）、本人 QR 授权、应用专用模型 base/key/name。值不进入 Git、聊天或日志；不能复制其他客户端的未知登录态。只配置为空模板不会连上服务，主人口令缺失时故意关闭保护接口。

网易兼容适配器必须由操作者控制，关闭 `ENABLE_GENERAL_UNBLOCK`，不装解锁/替换插件。当前模块发送 `unblock: "false"`，但无法替外部适配器控制其全局配置。Edge 是非官方在线语音接入，当前成功不等于 SLA；保持替换能力而不必先买新服务。

**电脑端具体兼容点尚未验收：** 后端测试的临时目录优先取 `TMPDIR`，缺失时回退到 Linux 路径。Pi 应先检查电脑端允许的 scratch 并设置该环境变量，或做相称的平台适配，不能直接把路径错误当作业务回归。TTS 绝对执行路径校验当前按 Unix 路径实现；Windows 首轮优先确认 `uvx` 可从 PATH 调用，不假定 `C:\\...\\uvx.exe` 已被配置解析器接受。

在 Windows 首次运行前检查已有 Node、uvx、ffmpeg/ffprobe、路径和本地指令；绝对 Unix 可执行路径不是 Windows 已验证的配置。服务端 README 列有完整变量和声线 allowlist。不要同步 node_modules、SQLite、凭据、用户音频缓存或整个 Linux 工作树到 SYNC。

## 下一阶段建议

1. 获取并检查本分支及两项红测试，先保留本机未提交工作。
2. 修复连续收听和暂停缺陷，再重跑现有检查。
3. 用真实浏览器完成页面/音频联合验收；检查作品气质而非仅看编译结果。
4. 通过安全入口连接本人网易云与实际模型通道，按真实外部响应调试，不编造成功。
5. 实际公开部署、DNS 或费用等步骤按 David 当次授权处理。此次 Git 同步授权不自动等于所有生产变更授权。
6. 达到可用并完成开发方测试后再交给 David 试用。Iris 本轮职责止于本次交接，不再继续在同一源码上并发开发。
