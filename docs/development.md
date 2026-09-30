# Emily Development Guide

## 当前阶段：交接给电脑端 Pi（2026-09-30）

本文件是唯一的项目当前执行状态入口。日期交接快照见 [handoff-to-pi-20260930.md](handoff-to-pi-20260930.md)，机器可读验证见 [handoff-verification-20260930.json](handoff-verification-20260930.json)。

- 最新任务：David 要求 Iris 整理仓库、同步 Git，准备由电脑端 Pi Agent 推进。
- 当前交接整理：Iris / Hermes default；原开发任务 `emily-v1-english-20260930`。
- 后续接续方：David 指定的电脑端 Pi Agent。Pi 尚未被宣称已经启动；接收后先检查本机规则和实际 Git 状态，再更新本页的当前任务与写入者。
- 接续来源分支：`iris/emily-v1-english-20260930`。本分支 HEAD 是交接版本，不要只读取旧的 `main`。
- Iris 已停止功能开发，不再并发修改 Pi 后续责任源码。原两个 Hermes 子代理均已结束，无仍在后台执行的开发子代理。
- 范围继续有效：独立个人 Web/PWA 电台、个人登录、网易云本人权益、英文女声、精致移动优先视觉；主要设备为小米12S安卓Chrome。不做公众房间、共享VIP池或主站联动。
- 当前代码：React/Vite 前端、Fastify 后端、SQLite、NetEase HTTP 适配、OpenAI-compatible 编排、Edge英文TTS、实际音频状态机、PWA和测试。接口见 [api-contract.md](api-contract.md) 及 `packages/shared/src/index.ts`。
- 实际重新验证：`npm ci`、类型检查、构建和编译启动检查通过；前端26/26、后端21/23，共47通过、2失败。真实英文Edge合成、解码、缓存复用通过。锁文件修正后的当前审计报告0项漏洞。
- 两项未修复：下一段主持音频预准备；下一首准备期间服务端暂停返回409。红测试保留于 `apps/server/test/radio-boundaries.test.ts`，不是全绿完成版。
- Iris 的英文主持自由文本修正已保留；`model-hosting.test.ts`三项回归通过。常见无依据事实筛选不等于完整事实认证。
- 尚未验收：真实浏览器联合交互、本人网易云登录/会员整曲/CDN、实际模型通道、小米物理后台与PWA行为、公开HTTPS部署。
- 交接边界：本次允许提交和同步Git开发分支；不据此覆盖 `main`、丢弃本机修改、推送秘密、修改DNS或重启/发布生产服务。没有部署的网站可用性声明。

Linux原工作区仅供来源定位：`/srv/agent-workspace/worktrees/bjcdeshu/Emilybjcmusic/iris/emily-v1-english-20260930`。此路径不是电脑端接续路径；Git同步不等于已更新电脑工作树。

## 接续建议

1. 按交接文档获取开发分支，保留已有本机修改。
2. 复现两项红测试，修复后完整重跑检查。
3. 用真实浏览器验收界面与实际音频，再连接本人账号和模型通道。
4. 按当次授权部署并验证目标设备，不把fixture测试或缩小视口称为真实会员/手机后台验收。

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
