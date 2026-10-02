# Emily

Emily 是供单个主人跨设备使用的个人 Web / PWA 电台。目标是在独立的 unbow 子域名上登录、连接本人的网易云账号，收听由模型编排的音乐与中文女声串场（英文声线仍可选）。项目与个人主站无关，不是公共多人音乐平台。

**历史发布：2026-10-02 已发布2e993d4（功能546b66f）。主持稿优化口语气口、保留完整情感表达；三种固定段落试听与正式DJ统一音量，实际解码/非近静音检查后才发布合成音频。保留用户声线及既有参数，不混音/裁静音/新增服务。server55/web38/browser5/deployment8和实际晓伊主持→原曲/三样试听恢复暂停通过；自然度与文案质量仍待实际听感，模型仍有泛化边界。此前已发布536815c。搜索默认加入现队列，更换节目与历史重编排需明确确认；聊天内存草稿/不抢回看、真实歌词全文跟随/手动暂停/切歌更新、队列定位/当前行不重播、进度拖动预览松手提交。web37/browser5和最终真实8首现队列有界检查通过，保留布局和声线，不冒称真机键盘/主观体验验收。此前已发布a11d094。在69e7c08克制真实律动基础上，主持字标随真实中频微亮，底部面板增加同一分析源的三频提示，切歌文字不位移，队列层级更安静；保留单audio和所有暂停/静音/reduce边界。web37/browser4及真实既有DJ→歌曲检查通过，未改原队列/漫游/声线/历史，设计仍待实际观感。此前已发布7d2c642。Emily中文串场恢复有上下文的段落和主持视角，不再默认一句报幕；ordered确认/手动加入/旧队列也按需写稿，保留播放与列表。含日文假名名字以自然中文指代承接，UI原名不变，不造译名/跳曲。真实当前日文曲目晓伊67字/14.304秒串场→网易歌曲通过；文案情感质量与日语发音仍未获人工认可。上一轮2026-10-01 已发布5ca516d（功能e18b3d1，后续精确检索/预算窄修）。保留已『很舒服』的e3328e8整屏和底部面板，修正54b04f1竖条过乱与晓晓机械的实际反馈。聊天默认逐曲『加入待播』，保留当前音源/暂停/原队列/漫游，显式『另选一组』才覆盖节目。准确一首不扩推荐；署名差异先澄清、版本需核对。真实振幅显示更疏、更淡、空间/时间平滑；中文串场缩短套话、提供同audio真实声线试听（晓臻/晓雨台湾国语新增），不擅改所选声线。台词阅读辅助/真实LRC继续保留。技术与真实有界检查通过，新自然听感/舒适度未得到David认可；小米/锁屏专项不是门槛。**

**最新发布7280ba1（功能759f482，2026-10-03）：正式主持已切换Google官方Gemini 3.8 Flash-Lite / Sulafat。David已确认项目Free Tier；线上实际74字串场准备9.274秒、语音17.84秒，自然结束→原网易歌成功，当前及下一段Gemini均ready。保留17首现场队列、programme/漫游/history，OAPI写稿独立不改；不是只有试听。Windows typecheck/build/server65/web38/browser7/deployment9/built和RN对应检查通过，最终小修状态摘要一致。免费层有限额、不付费回退；只发必要最终稿/固定指示，不发原聊天或凭据。技术验证不等于David已认可情感和停顿，实际听感待使用。当前入口development.md。**

**上一阶段Gemini接续（2026-10-03，当时暂缓发布）：David已确认专用项目Free Tier。固定非私人样文试听实现6e97529、超时提示修正f88676b已同步；5次实际生成调用中，仅Windows Sulafat/自然过渡成功（准备45.867秒、音频12.48秒），其余3次60秒和1次120秒诊断超时，根因未确认。真实样音已通过转码、解码、缓存和Chrome自然ended，情感/语义停顿仍待本人听感，不以技术成功代替认可。Windows全部回归和RN隔离候选测试通过，但RN真实合成未成功，故未部署、未改生产配置/声线/OAPI、未重启服务；线上仍2e993d4。详情以development.md为准。**

- 接续方：David 指定的电脑端 Pi Agent。
- Pi 当前分支：`pi/emily-continue-20260930`，源自 `iris/emily-v1-english-20260930` 的 `c7af2c2`；不要把仍停留在旧基线的 `main` 当成最新实现。
- 先读 [Pi 交接说明](docs/handoff-to-pi-20260930.md)。
- 当前执行状态以 [开发入口](docs/development.md) 为准；接口以 [API 契约](docs/api-contract.md) 和 `packages/shared/src/index.ts` 为准。
- 原交接两项失败回归已修复并保留断言。正式Gemini功能759f482：Windows typecheck/testtypecheck/build、server65/web38/browser7/deployment9/built通过；RN build/testtypecheck/server65/web38/隔离deployment9/built通过。7280ba1仅显示摘要窄修，另跑Windows typecheck/build/web38/专项browser1、RN build/web38和线上只读验证。自动测试、真实有界播放与人工听感认可分别记录，详见开发入口。

## 已有实现

- React / Vite 移动优先界面：个人登录、网易云扫码连接入口、节目选择、播放器、历史、设置、安静模式和沉浸模式。
- 原歌单漫游：新建歌单节目默认开启，每批最多12首、近末尾自动续选，当前轮不重复；耗尽或失败明确停止，不切换其他歌单/音源，播放器可随时关闭。
- 听歌对话：中文/英文多轮沟通；点准确一首只找这一首，原歌名/歌手/专辑明确，署名差异先确认。默认逐曲加入待播队尾、留在聊天，权益重查/重复no-op、原播放与漫游不变；另选一组有独立替换确认，保候选顺序。对话仅保留于当前页面内存，不落库/缓存；使用现有专用模型，不新增聊天服务。
- 单个真实 HTML 音频元素：主持 → 歌曲 → 队列推进，实际进度、跳转、音量和 Media Session。生产界面没有示例歌单或假播放进度。
- Fastify 后端：单主人会话、输入校验、SQLite 持久化、加密的网易云授权、歌曲解析、模型编排和受保护的音频路由。
- 正式Gemini中文女声：已保存Sulafat，Google官方Flash-Lite TTS，仅发送最终短主持稿与固定指示；显式启用、当前与下一段预生成、同内容缓存、失败保留文字/歌曲、不自动切付费或Edge。其余Edge声线仍可主动选择，未把已有Edge标识静默映射Gemini。
- 既有中文女声 Edge TTS：代码缺省晓晓 `zh-CN-XiaoxiaoNeural`、晓伊/晓臻/晓雨可选，七款英文女声保留；参数数组调用、声线/语言校验、缓存和超时。旧设置一次升级为中文并保留quiet/volume/授权/queue/history，后续英文选择可保存；原名UI不改，英文模式仍省略不可靠的非Latin朗读名字。
- 台词自然纵向阅读辅助（非伪字幕时间轴）；歌曲真实LRC随实际进度/seek定位，无时间轴仅阅读全文，无词/纯乐/失败不影响播放。固定私有歌词接口、owner/no-store、volatile有界缓存。
- 模型可写有上下文的中文段落（或所选英文）主持词；曲目 ID 必须来自实际候选目录。未配置或调用失败时明确回退真实歌单，不假装 AI 或外部服务已经成功。
- PWA 图标、manifest 和静态外壳缓存；不缓存私有 API、二维码、凭据或音乐。

源码已存在；旧的「仓库仅有三张截图」说明不再代表当前状态。

## 验证范围

Pi 本机的构建、类型检查、自动测试、真实 TTS 与浏览器检查见 [当前开发记录](docs/development.md)；[Iris 交接测试记录](docs/handoff-to-pi-20260930.md#验证结果)保留为历史证据。自动测试使用明确标记的 HTTP / 音频 fixture，不能证明本人的网易云会员播放、实际模型通道或小米锁屏行为。

已完成真实桌面 Chrome 登录/导航/缺配置界面、393px视口与真实 Edge 语音解码播放检查；项目内 `npm run test:browser` 已覆盖主持→歌曲→下一首、暂停/seek/安静模式及PWA离线外壳（明确测试音源）；已完成本人网易扫码、真实Gemini节目编排、2首实际歌曲/CDN完整数据、主持→歌曲→下一段主持→第二首及暂停/seek/安静模式/退出验证；另一次安静模式自然播放完200.587秒歌曲并自动续播。不是全目录会员证明。物理锁屏/后台未测试，David明确不要求该项作为交付门槛；当前优先级是实际UI/UX重做。

部署方式与最少配置输入见 [上线准备](docs/deployment.md)；新增专用systemd/反代待审核模板及 `npm run test:deployment` 离线只读预检。RN专用应用/适配器服务与独立HTTPS已部署，Cloudflare仅新增Emily DNS-only记录。模型采用Emily专用OAPI令牌与实际验证的gemini-3.8-flash；不共享代理密钥。当前Node/SQLite/TTS后端不能只上传静态Pages就声称上线。

## 本地运行

Pi 当前 Windows 验证环境为 Node 24.16.0、npm 11.17.0；Iris 历史 Linux 环境为 Node 26.7.0。SQLite 使用 `node:sqlite`，前端测试使用 Node TypeScript stripping。电脑端应先确认现有 Node、npm、uvx、ffmpeg/ffprobe 和本地项目规则，再运行命令；不能把 Linux 验证当成 Windows 已验证。

在仓库根目录执行：

```sh
npm ci
npm run typecheck
npm run build
npm run test --workspace @emily/web
npm run typecheck:tests --workspace @emily/server
npm test --workspace @emily/server
npm run test:built --workspace @emily/server
```

原失败测试已保留并修复；主持表达/日文承接轮后端53项、前端34项/浏览器3项通过；最新体验一致性轮前端37项/浏览器5项通过，0跳过。可用 `npm run test:browser` 复跑真实Chrome联合检查（需Chrome及ffmpeg，或显式指定 `EMILY_BROWSER_EXECUTABLE`）；新增Playwright仅为开发依赖。

配置采用真实实现读取的 `EMILY_*` 变量，参见 [.env.example](.env.example) 和 [后端说明](apps/server/README.md)。示例没有真实秘密。私有配置不能提交或发到聊天中。

完成本地私有 `.env` 配置后，使用已构建的同域应用：

```sh
node --env-file=.env apps/server/dist/index.js
```

示例配置的本地 Origin 是 `http://127.0.0.1:3000`。命令不会自动开放公网。主人口令未配置时，受保护接口关闭访问；音乐/模型未配置时只显示实际缺失状态。

`npm run dev` 是历史双进程开发命令，不自动读取根 `.env`。使用 Vite 开发时需显式向服务端进程提供环境变量，并将 `EMILY_PUBLIC_ORIGIN` 配置为准确的 Vite Origin，例如 `http://127.0.0.1:5173`。不要混用 `localhost` 和 `127.0.0.1`。

## 目录

```text
apps/web/             界面、真实音频状态逻辑、PWA、前端测试
apps/server/          鉴权、SQLite、网易云、模型、TTS、后端测试
packages/shared/      TypeScript 接口类型
.env.example          无秘密的配置示例
AGENTS.md             接续与权限边界
docs/development.md   项目当前执行状态
docs/api-contract.md  当前接口契约
docs/handoff-to-pi-20260930.md 本次交接快照
```

## 参考与历史

- 原始体验参考：mmguo 的 [Claudio x mmguo FM](https://mmguo.dev)。保存的原截图显示 Claudio、Monday Night Exhale 和“把我十四年的歌单，蒸馏成了AI电台”。不把角色名当成其他产品或代理的身份。
- 账号和播放实现参考：[OpenMusic](https://github.com/qq01-hub/openmusic)、[Meting-API](https://github.com/qq01-hub/Meting-API)。参考不等于整项目复制或共享会员授权。
- 视觉扩展参考：[Mineradio](https://github.com/XxHuberrr/Mineradio)，已标停更，不作为必须采用的基础依赖。
- [历史原型说明](https://github.com/bjcdeshu/Emilybjcmusic/blob/2accf31966ea4b5778e4bd0f1ccab6a6df4e421b/README.md) 保存在原提交中。天气、日历、WebSocket、Fish Audio 和散落的用户画像文件是历史设想，不是当前首版已批准的必做项。

原有三张截图保留原位：

![原始整体结构参考](./PixPin_2026-04-23_14-41-44.png)
![原始模块参考](./PixPin_2026-04-23_14-42-09.png)
![原始体验参考](./PixPin_2026-04-23_14-44-06.png)
