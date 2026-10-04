# Emily 上线准备

本页包含部署方案、实际运行导航和验收清单；2026-09-30已部署独立HTTPS，本人授权、2首真实歌曲数据及浏览器连播已通过；David已取消物理小米/锁屏专项验收门槛；最新ca8e846整站交互精修已发布，保留9f9a57c（功能0170579）六项日常控制，保留完整串场v6/正式Gemini Flash-Lite/Sulafat；10月4日当前101字/24.4秒长稿→原歌与暂停续听已通过，下一段旧tts_failed未重生成，不代表长期供应商可用；旧9e345f3/v5短稿链路成功仅为历史证据；此前2e993d4 TTS口语稿/一致试听/本地解码检查已发布，保留536815c安全点歌/阅读连续性/拖动预览已发布，保留a11d094主持字标/面板真实三频提示，保留69e7c08克制律动/不透明面板，保留7d2c642主持表达/日文名字安全承接，保留已肯定的整屏布局，设计实际反馈优先。当前状态以 [development.md](development.md) 为准。

## 最新窄发布：ca8e846（2026-10-04，UI/交互精修）

由David反馈直接听歌UI不适、要求整站交互与动效精修触发，Pi从clean d8e29be实施。仅前端组件/样式/fixture及文档；保留后端/shared/playback/analysis/model/TTS/env/schema/依赖。44px跳主持位于稳定进度行，native sheets完整进出/焦点保护、定时预设/分组、queue渐展和焦点、回看分段/说明折叠、统一交互节奏。

Windows typecheck/build/web41/完整browser8通过0skip；RN候选build/web41/built通过，未另跑未改的server77/deployment9。pre-ca8e846停Emily后配对SQLite+env备份/cmp，目录700/文件600；onlyEmily restart，adapter1964070保持。current=/opt/emily/releases/ca8e846，15:15:09UTC启动、health200/active/NRestarts0。assets index-C99Lw8JF.css/index-3jHVJqS7.js。

线上暂停态四视口/单audio/源与位置不变、native退出焦点/reduce、定时设置取消、菜单只展开/聊天不发送、回看页通过，0unexpected POST/pageErrors。现场9→9首及programme/tracks/漫游/index/settings/history/授权保留，current+next既有v6/Gemini ready；本地Google day8/minute1窗口及冷却与备份不变，0新生成。短账号名ACL导致首次本地证据EPERM已改精确用户SID（仅David/SYSTEM/Administrators），第一次UI时间断言读早于metadata恢复，保留失败后改测试等待既有checkpoint再有界复验通过，产品逻辑未更改。私有证据polish-review-20261004；日志polish-*.log、fixture design-polish。运维changes/2026-10-04-emily-ui-polish.md。

回滚9f9a57c仅切代码，保留当前DB/env；不盲还旧SQLite/清冷却。新UI主观认可未收到，线上没有重播/生成主持或物理后台验收。

## 历史窄发布：9f9a57c（功能0170579，2026-10-04）

David批准六项增量体验，Pi唯一写入。从clean ea8db54实现，保持voice/hosting/OAPI/queue。owner checkpoint/collection/queue-edit/resume复用kv和既有catalogue，无schema迁移/新依赖。Gemini冷却现在保存于私有kv，更新不改额度或绕过供应商限制；短阶段提示和options详情，不承诺到点供应商恢复。页面用户定时不创建服务器timer。

Windows0170579 typecheck/testtypecheck/build/server77/web41/browser8/built，RN build/testtypecheck/server77/web41/built通过0skip。9f9a57c仅真实播放后清旧重启提示及中文说明，另跑Windows类型/构建/77/41/built/daily browser1、RN构建/testtypecheck/77/41/built。没有重跑未改的deployment9；发布preflight已实际通过。

生产两次配对备份pre-0170579、pre-9f9a57c，目录700/文件600、停Emily一致SQLite+env/cmp；env不改、只Emily重启，adapter PID1964070保留，health200/两unitsactive/NRestarts0。current=/opt/emily/releases/9f9a57c，assets index-DMJ5OOuH.css/index-qpkWMq3q.js。代码回滚0170579或13237d1保留现有DB/env，不能盲还旧SQLite覆盖用户数据，不为冷却而回滚/重启。

真实Chrome：当前101字/91文字数字v6 Gemini24.4秒自然ended→同一原歌、Range206/private-no-store；歌曲12秒暂停后刷新恢复不重念主持；本首真实ended停止且未推进；30分钟UI设置/取消、collection最近实际播放与喜欢入口、四视口/单audio。第一轮timer检查脚本失败后有界复验通过，最后notice窄验也记录首次断言失败及复验通过，不隐去失败。最终paused/logout；13首/programme/漫游/settings/history/授权与配对备份一致，只有新增续听/最近播放元数据。未生产加歌/删歌/like/新programme/更换声线，queue仅原下一项next幂等no-op。Google固定窗口计数保持1，0新增生成；下一段旧tts_failed未变，不能声称均ready。

私有证据Emily-private/daily-review-20261004（仅David/SYSTEM/Administrators ACL）；普通测试six-*.log及design-daily。运维changes/2026-10-04-emily-daily-controls.md。线上有界结果不证明所有设备/音源/长期稳定，时限定时受后台冻结影响，异常退出位置保存best-effort。

## 历史窄发布：13237d1（2026-10-03，完整串场v6；当时长稿语音待恢复验证）

David实际纠正v5串场太短；Pi保留Sulafat及TTS/OAPI/UI/曲目，恢复每段完整展开，目标约90–160字/3–5句、硬280。正常稿与最多一次编辑稿共同检查≥60文字/数字、剔除metadata后≥40；长度是回归防线，不是自然度分数。编辑仍共享原HOST_ONE≤20s/batch deadline，失败才短报幕+warning，不重排曲目。Windows typecheck/testtypecheck/build/server74/browser7/built、RN build/testtypecheck/server74/built通过0skip；未重跑未改的web38/deployment9。最终一轮真实writer虚构情境9段91–123字，仍有假设句式同质化等质量边界，不是用户听感认可。

current=/opt/emily/releases/13237d1，旧9e345f3保留。停Emily后root-only /var/backups/emily-20260930/pre-13237d1配对SQLite+env备份/cmp；env不改、专用用户preflight/health200/两unitsactive/NRestarts0，adapter PID1964070保持。assets仍index-Yl2ZXD1U.css/index-n2wJRwpO.js。无依赖/schema/Node/DNS/proxy/其他业务变更。

真实现有节目写出当前97字/下一段124字v6稿，但Gemini均tts_failed，未验证新音频→原歌曲。最初浏览器等待音频超时，后一次人工复验也失败；固定非私人试听仅用于错误诊断，得到429/GEMINI_TTS_LIMIT。本地固定24h窗口8/60、分钟窗口已过，仅1次新增生成额度（7→8）后被进程冷却拦截。当前代码仅provider429设置该冷却，支持供应商429归因；原始Retry-After/错误正文未保留，不能确认Google每日配额或精确恢复时间。10月3日18:05（UTC+8）David要求继续后，有界复验366ms仍tts_failed，计数仍8、没有新供应商请求；没有重启/绕冷却/扩大限额/付费或Edge自动回退。

与停机备份只读对比settings/history/授权/programme/完整track队列/漫游/index全部保持，本轮现场13→13首，最终paused/logout。当前服务健康但**新长段语音未验收**，内容亲切感也未获用户认可。进程从04:38:44 UTC持续运行，provider冷却上限24h意味着该次应用拦截最迟约2026-10-04 04:39 UTC（UTC+8中午12:39）到期；这不是Google恢复保证，不启动定时或轮询重试。回滚只切9e345f3代码、保留DB/env，不用旧SQLite覆盖新数据，也不将重启当限流绕过。运维changes/2026-10-03-emily-paragraph-copy.md。

## 历史窄发布：9e345f3（2026-10-03，口语策略v5）

David批准少解释腔/真实上下文接话/连续段落去重复，且已明确肯定新音色；本轮仅写稿策略和有界copy edit，不改声线/合成参数/OAPI配置/前端/选曲。Windows typecheck/testtypecheck/build/server71/browser7/built、RN build/testtypecheck/server71/built通过0skip；未重跑未改的web38/deployment9。多轮真实OAPI虚构场景检验提示遵循不足，新增有限已知话术匹配、最多一次索引固定的稿件编辑，共享原始写稿deadline；编辑失败保留已选曲目/顺序，仅相应稿降级。不是语义正确或情感质量保证。

current=/opt/emily/releases/9e345f3，旧7280ba1保留。停Emily后root-only /var/backups/emily-20260930/pre-9e345f3配对SQLite+env备份/cmp；env不变，preflight/health200/两unitsactive/Emily NRestarts0/adapter PID1964070未变。与停机备份只读对比settings/history/授权/节目/队列完整track/漫游/index保留。仅Emily重启，无新依赖/schema/Node/DNS/proxy/其他业务变化。

真实Chrome现有节目：27字v5串场准备11.403s、Sulafat音频6.44s自然ended→同一原网易歌；Range206/private-no-store、singleaudio/gain0.9、现场16→16首/原programme/漫游/settings/history通过，最终paused/logout，无加歌/换节目/改设置。随后只读DB当前及下一段v5/Gemini ready。assets仍index-Yl2ZXD1U.css/index-n2wJRwpO.js。新台词亲切感、长段上下文仍待实际用户反馈，不以短段技术播放外推。

代码回滚7280ba1并仅重启Emily，保留当前DB/env；旧版本可能按其策略版本lazy重备串场。不得盲目恢复旧SQLite覆盖新用户数据。运维changes/2026-10-03-emily-conversational-copy.md，详细验证见development.md。

## 历史窄发布：2e993d4（2026-10-02）

current=/opt/emily/releases/2e993d4，功能546b66f，旧536815c保留代码回滚。第一候选发布前RN server时序断言失败，没有停生产；测试等实际persist后完整RN server55/web38/build/testtypecheck通过。既有ffmpeg用于合成完整性检查，无系统安装。专用用户真实晓伊14.832s/解码/cache通过。停Emily后root-only pre-2e993d4 SQLite+env/key/cmp，owner preflight新增decoder存在检查、health/unitsactive/NRestarts0，adapterPID不变，无schema/env/依赖版本/Node/DNS/其他业务改动。Windows typecheck/testtypecheck/build/server55/web38/browser5/deployment8/built通过。线上首次末尾状态读取失败，健康正常；有界复跑原6首/节目/漫游/声线/history保留，78字14.88s晓伊→原歌曲，3固定样文11.472/12.888/14.64s且同gain0.9/同audio/自然ended恢复paused位置，4视口/pageErrors[]/logout通过，无新节目/歌曲/网易写入。不是人工自然度验收。assets index-Yl2ZXD1U.css / index-BJnyt9Vq.js。运维changes/2026-10-02-emily-tts-delivery.md。

## 上轮窄发布：536815c（2026-10-02）

current=/opt/emily/releases/536815c，旧a11d094保留代码回滚。停Emily后root-only pre-536815c SQLite+env/key/cmp，服务用户preflight/health/unitsactive/NRestarts0，adapter PID未变。RN build/web37，本机typecheck/build/web37/browser5通过。无依赖版本/schema/env/Node/DNS/其他业务变化。最终真实8首/原曲/漫游/settings/history保留，seek preview/release106s/歌词/取消更换/草稿/4视口通过，最后paused/logout。早期真实检查9→8队列变化原因未确定，不声称全程队列未变化；metadata等待/对象状态比较和slider.fill步长问题见development.md。运维changes/2026-10-02-emily-ux-continuity.md。

## 上轮窄发布：a11d094（2026-10-02）

current=/opt/emily/releases/a11d094；仅Emily app重启，adapter PID未变，两unitsactive/NRestarts0。停应用后root-only pre-a11d094 SQLite+env/key备份/cmp，保留69e7c08代码回滚，不覆盖新用户数据。RN identity/preflight/health/build/web37通过。无env/schema/依赖/Node/DNS/反代变化。线上原11首/漫游/settings/history不变，实际主持字标/歌曲面板三频、4视口/reduce/面板pause通过，最终paused/logout。运维changes/2026-10-02-emily-listening-details.md。

## 上轮窄发布：69e7c08（2026-10-02）

current=/opt/emily/releases/69e7c08；仅Emily app重启，adapter PID未变，两unitsactive/NRestarts0。停应用后root-only pre-69e7c08 SQLite+env/key备份/cmp，保留7d2c642可代码回滚，不覆盖新用户数据。RN identity/preflight/health/build/web36通过。无新env/schema/依赖/Node/DNS/反代变更。线上原11首/漫游/settings/history不变，真实DJ→歌曲100帧响应/4视口/sheet/reduce/pause通过；最后paused/logout。运维记录changes/2026-10-02-emily-restrained-rhythm.md，更多见development.md顶部。

## 正式Gemini主持7280ba1 / 功能759f482（2026-10-03，已发布）

David明确要求线上可用Gemini主持，已确认专用项目Free Tier。官方Flash-Lite在RN三次样稿成功，正式代码759f482已通过Windows65/38/browser7/deployment9/类型/构建/built、RN65/38/隔离deployment9/测试类型/构建/built。模型固定gemini-3.8-flash-lite-tts，当前saved voice=gemini:Sulafat/zh；最终中文稿≤280+固定style，写稿OAPI不改，no Edge/paid自动回退，shared2/min60/day本地生成上限，缓存和lookahead保留。

生产私有env新增独立key/free确认/hosting enable，原env项目保留；先停Emily，root-only pre-759f482一致性SQLite+env/cmp，再切current/服务用户preflight后启动。仅Emily重启，adapter PID1964070保持、health200/两unitsactive/NRestarts0；无Node/DNS/proxy/主站/其他业务修改。临时Key输入已删除。真实Chrome显式保存Gemini后74字/准备9.274s/语音17.84s/自然ended→原网易歌、单audio/gain0.9/Range206/private-no-store/四视口通过，原17首/programme/漫游/history保留，settings只改voice，最终paused/logout。只读DB current+next都Gemini ready。

7280ba1窄修设置页残留旧voice摘要，Windows类型/构建/web38/专项browser1、RN构建/web38通过；停Emily做pre-7280ba1配对SQLite/env备份/cmp，再切current7280ba1，预检/健康/adapter保持，env不改。最后真实只读Chrome0生成请求、17首/Gemini ready/摘要一致通过。当前assets index-Yl2ZXD1U.css/index-n2wJRwpO.js；更详细状态和证据见development.md。运维changes/2026-10-03-emily-gemini-hosting.md。

回滚：显示修正可仅切759f482代码、保留当前DB/env。若回2e993d4旧Edge代码，先用当前API显式保存Edge voice（原晓伊zh-CN-XiaoyiNeural），确认停止Gemini准备后窄回滚；必要时从pre-759f482恢复仅env以移除新key，但不得盲目还原旧SQLite覆盖后续账号/曲目。旧f88676b候选并未上线。未将听感/长期稳定性或免费无限量记为通过。

## 历史Gemini试听候选f88676b（2026-10-03，当时真实生成超时，未发布）

David已确认专用项目Free Tier；两个新变量`EMILY_GEMINI_TTS_API_KEY`与`EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED`尚未加入生产env。后者是操作者确认，不是Google计费开关/硬零费用证明。仅固定非私人样文/无私人派生稿，旧Edge主持/用户声线与OAPI不改。

Windows实际3次生成：Sulafat transition HTTP200/45.867s、MP3音频12.48s通过；Aoede/Kore各60s超时。RN候选/opt/emily/releases/f88676b隔离构建、testtypecheck/server62/web38/built通过；deployment首次固定3101与运行中的adapter冲突，停在发布前，改用一次性unshare --net/loopback完整9项通过，不动宿主网络或adapter。RN专用emily用户只用隔离/var/lib/emily/gemini-check-20261003调用Sulafat reflective，60s以及唯一一次120s诊断都超时。RN只读models.get HTTP200/187ms，基础连通不代表生成稳定；尚无根因/429证据。

未停服务、未切current、未打开生产SQLite或改env；安全传输的临时Key输入已删除并验证。最终current仍2e993d4，health200/两unitsactive/NRestarts0/adapter PID1964070未变；候选保留不启用，无必要生产备份。实际生成可用性及主观听感未过，不用fixture、模型列表或本地单次成功宣称生产接入完成。本阶段未发布的经过合并记于changes/2026-10-03-emily-gemini-hosting.md，不另建candidate记录；详情见development.md。

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

- Codex负责此次Pi Cloudflare MCP接入；2026-09-30 reload后Pi已连接并只读核对zone、DNS、SSL、origin rules及active page rules，未修改云资源。
- DNS/公开入口的目标须确认；保留原记录、原服务和回滚信息，不默认创建付费资源。
- `/api/*`、二维码、媒体音频必须绕过边缘及反代缓存；不能采用全站Cache Everything规则。尊重private/no-store，不缓存Set-Cookie；登录Cookie为Secure/HttpOnly/SameSite=Strict。
- 保持Range/Content-Range/Accept-Ranges，不把媒体错误改写成index.html；无通用任意URL代理。
- JS/CSS哈希资产可immutable；index、manifest、sw必须可更新。图标路径 `/icon.svg`、`/icons/emily-*.png` 必须实际200。
- 不盲信外部Forwarded/X-Forwarded-*；当前Fastify `trustProxy=false`，反代后登录限流按代理入口聚合。若需要可信真实IP，必须按固定代理拓扑另做验证，不直接开放信任所有代理。
- 对媒体传输/Cloudflare入口限制核对适用条款与能力，不凭MCP连通就保证音频代理合适。

## 部署材料与检查

- `deploy/emily.service.example`：专用非root账户、只写 `/var/lib/emily`、保护home和系统目录、环境文件加载、离线预检、优雅停机。已按该模板在RN安装专用systemd服务；运行/回滚导航见下节。
- `deploy/nginx-locations.conf.example`：独立HTTPS站点的location片段，API不缓存、不落代理临时文件、不改写错误、保持Range，关闭含QR票据的访问日志。不含证书和server块，完整 `deploy/nginx-site.conf.example` 已用于独立Emily站点，目标OpenResty syntax/reload通过；不能直接覆盖其他站点。
- `scripts/deployment-preflight.mjs`：离线、只读，检查HTTPS origin/回环/专用凭据配置、现有私有环境与数据权限及恢复状态、PWA文件和TTS执行文件，不打开数据库、不启动服务、不调用模型/网易/TTS、不打印配置值。Windows没有ACL验收时明确阻断；不把chmod当ACL证明。此检查不证明适配器解灰关闭、路径未同步或外部服务可用，仍需操作者核验。
- 测试：`npm run test:deployment`。正式预检须在构建后**以专用服务用户**执行，使用同一私有文件，不使用其他代理环境：

  ```sh
  node --env-file=/etc/emily/emily.env scripts/deployment-preflight.mjs /etc/emily/emily.env
  ```

### RN候选核对（2026-09-30只读快照）

现有SSH严格主机校验及hostname匹配，已读实际运维RUNBOOK/INVENTORY；RN有OpenResty及约4.4GiB可用内存、41GiB空闲磁盘。本轮未安装、写入或重启服务器。

- 系统Node为22.23.3/npm10.9.9，满足后端SQLite最低版本，但尚未在该版本跑Emily全套检查；前端Node TS-stripping测试参数差异也需实测，不能把Windows24的测试当成RN22验收。不计划为了此应用全局升级Node。
- 已有ffmpeg/ffprobe；uvx仅在root私有home，不能借给受 `ProtectHome=true` 限制的专用用户。后续需在获准后安装独立、可复核版本的edge-tts执行文件，并将HOME及缓存限制在Emily私有目录。
- `127.0.0.1:3000`已占用。候选Emily端口3100、私有适配器3101当时无监听，仅是建议，部署前重查。
- 无现成 `/opt/emily`、`/etc/emily`、`/var/lib/emily`、Emily网站或emily服务账户。建议新建独立服务，不复用既有生产数据。
- `emily.unbow.de`无DNS记录，Cloudflare zone active、SSL strict；现有origin规则仅命中panel/oapi，active page rules为空。主站与www记录未改；仍须决定音频入口是否经过Cloudflare代理并核对适用条款，不能因SSL strict就宣称Emily HTTPS完成。
- 候选网易适配器上游README仍明确 `ENABLE_GENERAL_UNBLOCK` 默认为true；不直接pull latest即运行。必须审核并固定具体版本/摘要，显式关闭解灰、匹配及代理插件后才允许本人授权。来源：[上游README](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)，2026-09-30读取；不是已选择该版本或已接入声明。
- 应用专用模型base/name/key与本人音乐授权尚无；不读取或复用其他代理密钥。现有 `oapi.unbow.de` 只是可选网关，需主人提供/创建Emily专用key并确认模型及费用范围。

2026-09-30 David已确认目标RN与OAPI优先Gemini，承接独立子域名及专用服务/适配器安装和反代/DNS范围；不再重复询问方向。RN/NC hostname及stripped machine-id SHA256均已匹配fleet入口。主人口令与加密key可以于私有目录生成，不要求发到聊天；模型专用key通过安全文件提供，本人扫码另走受保护页面。本机已创建空白 `C:/Users/David/AppData/Local/Emily-private/oapi-key.txt`，核验目录关闭继承且目录/文件只允许David、SYSTEM及Administrators访问，不在源码或同步目录；David已保存专用key，Pi权限核验及OAPI模型/实际编排调用通过；值不进入正文或工具输出。授权不包括复制代理密钥或任意修改OAPI通道，需用Emily专用令牌核验实际Gemini可用性。保留提交与旧release，首次上线前无Emily数据可回滚；之后停专用实例、一致性保存SQLite及key后升级，回滚只改Emily入口，不触碰既有服务。

## RN运行导航（2026-09-30已部署，非最终收听验收）

- URL：`https://emily.unbow.de`，Cloudflare DNS-only A/TTL300，直连RN，不代理音乐到CDN；Let's Encrypt独立证书。
- App：`/opt/emily/current` → `/opt/emily/releases/7d2c642`（中文情感段落/日文安全指代；点歌入队/原队列漫游保留/聊天与克制动效/固定声线试听；中文/真实歌词/整屏保留）（Git快照、RN Node22构建），`emily.service`。专用账户emily，回环3100。
- Music：`/opt/emily/adapter-135df9e` upstream4.40.1/135df9eddab12cc8879f63c090c0ce808040504f，专用lockfile与MIT LICENSE；解灰依赖/分支/route移除，audit0。仅 `/opt/emily/netease-bridge.cjs` 私有桥接，`emily-adapter.service` 回环3101；ENABLE_GENERAL_UNBLOCK/ENABLE_PROXY/ENABLE_RANDOM_CN_IP=false。新xeapi注册在RN超时，桥接把xeapi请求改成网易eapi原始传输；本人QR授权、实际2首安全网易CDN整曲数据与浏览器连播通过；不代表全目录/VIP档位验收。重建补丁用 `deploy/prepare-netease-upstream.mjs`，拒绝不匹配的上游文件hash；bridge test为明确fixture安全测试。
- 私有环境：`/etc/emily/emily.env`、`adapter.env`（0600/emily），data=`/var/lib/emily/radio`（0700），SQLite0600；模型=`https://oapi.unbow.de/v1` / `gemini-3.8-flash` / Emily专用key，timeout30秒。主人密码本机安全副本 `C:/Users/David/AppData/Local/Emily-private/owner-password.txt`，已核验ACL；不打印/上传/提交。
- TTS：`/opt/emily/tools/tts/bin/edge-tts` 7.2.3专用venv，requirements-resolved.txt记录依赖；专用用户真实合成与解码/缓存成功；当前默认晓晓zh-CN-XiaoxiaoNeural，晓伊、晓臻/晓雨台湾国语及七款英文可选，试听不自动保存声线/恢复音乐。应用无需使用root uvx。
- HTTPS：`/opt/1panel/www/conf.d/emily.unbow.de.conf`，专用网站SSL/ACME路径；API无缓存/无代理落盘/无票据日志，保留Range，TLS1.2/1.3、HTTP308。只做nginx-t+平滑reload，原容器和业务未重启。已有nginx listen-http2弃用警告未顺手处理。
- 续期：`/etc/emily/acme` 为本应用专用acme配置，`emily-cert-renew.timer` 每日随机延迟/持久化，实际cron检查Result=success；reloadcmd先nginx-t再reload。不更改其他ACME账户/证书/任务。
- 查看：`systemctl status emily emily-adapter`，`systemctl list-timers emily-cert-renew.timer`；不得用 `systemctl show Environment`、输出private env或raw provider日志。health=/api/health，未登录保护接口401。
- 首次回滚：`/var/backups/emily-20260930/rollback.txt`；停止并禁用Emily两个units及专用续期timer，移出新增Emily nginx配置后nginx-t/reload，撤销仅Emily新增DNS记录；保留 `/etc/emily` 与 `/var/lib/emily`，不删除主人授权或修改主站/网关。DNS对象ID仅留运行记录，不保留令牌。
- 升级：停止Emily专用实例或一致性备份SQLite，与AES key同等保护；新release构建/test/权限预检后原子换current，再仅restart相关Emily units（通常仅app，54b04f1固定歌词桥也涉及adapter）。适配器单独审核与锁版本，不更新latest/整个fleet。权限、TLS和续期检查分别记录，不把网页200当最终体验通过。

实际验证更新：fcf4df6后本地后端28+前端28+部署7+Chrome fixture1=64全绿，RN后端28+前端28/build/testtypecheck通过，私有preflight再次全通过。本人扫码及服务重启后连接保留；真实Gemini 2首programme200/0 warning、真实TTS/歌曲切换、pause/seek/quiet/logout与Range通过，两首完整媒体3,210,388/3,543,981bytes。另一次安静模式自然播完200.587秒并自动下一首成功。未知VIP档位和未测试曲目不泛化通过；小米物理后台未测试但已取消门槛。

超时修复：Fastify idle connection150秒（原10秒造成真实programme502），入站body timeout30秒/16KB不变；前端programme/player135秒，普通read45秒。现有model/provider30秒、TTS60秒有限制，不把等待伪装进度。修复只更新Emily application、保留旧release和 `/var/backups/emily-20260930/pre-fcf4df6` 一致性SQLite/env备份。密钥备份必须和数据库配对；无schema改动，不用备份覆盖新授权/历史作为默认回滚。

### 历史54b04f1更新（2026-10-01）

固定上游版本不改；私有桥新增第10路固定POST lyric，仅id/cookie/timestamp/noCookie。App新增owner/no-store/known catalogue lyrics/LRC parser，真实49行歌词、当前行随actual media seek/pause/全文同源通过。中文Gemini programme200/model/0warnings→晓晓真实语音→网易歌曲、12手机首屏/暂停reduce/退出通过；本机server40/web31/deployment7/browser2，RNserver40/web31/build/testtypecheck与专用用户晓晓解码缓存通过。旧e3328e8和root-only `pre-54b04f1`（停app一致性SQLite+emily.env/key+adapter.env+旧bridge，cmp）保留；不改系统Node/DNS/proxy/其他业务。初次脚本缺voice行断言停，第二次root误跑owner-preflight回滚，最终以服务用户预检发布通过；权限未放宽。回滚优先旧code+必要bridge/env窄恢复，不能默认覆盖后续授权/历史；如要回英文须显式选择声线（一次性中文迁移已持久化）。

### 历史5ca516d更新（2026-10-01）

功能e18b3d1→lookup动词窄修bea0f80→前端预算/版本选择5ca516d。只application停启，adapter PID unchanged；env/bridge/Node/DNS/proxy/其他业务/SQLschema/dependency不改。每次先RN身份、npm ci/build/相关测试，再停Emily一致性SQLite+emily.env/key备份cmp于root-only pre-e18b3d1/pre-bea0f80/pre-5ca516d；原子current/owner preflight/health200/两unitsactive/NRestarts0。保留54b04f1与中间release；优先code回滚，不覆盖新授权/history。

RN server46/web34及service-user Edge晓臻34,704bytes/5.784秒、晓晓29,808/4.968秒/metadata/decode/cache；最后5ca516d web34/build。真实公开Gemini错署名澄清/正确署名2完整权益版本、原12queue/漫游/history不变、duplicate enqueue recheck/already_present保持当前实际音源/time/playing、真实短中文DJ→原网易song/平滑竖条连续观察/12手机首屏/pause/reduce、同audio晓臻preview真实ended恢复原source/time保持paused，原quiet restored/voice未保存不变/logout/pageErrors[]/completed=true。准确新增目标因署名仍需用户确认未执行，新增一首/next/pause/refill/clear/replace/close由fixture回归证明；不冒称已给用户加入李剑青《匆匆》或人声舒适验收。无new programme/history/permanentfeedback/网易write。

### 当前7d2c642更新（2026-10-02）

中文主持v3段落/上下文视角、ordered与manual/旧队列lazy HOST_ONE（20s+既有TTS60s），不重复选歌/不在add换音源。日文假名名自然指代，原UI不变、纯汉字日文读音不保证。Raw listenerNote≤600只内存，owner context-clear/logout等清理，已生成稿/音频仍私有保存。

RN build/testtypecheck/server53/web34、owner preflight/health/两unitsactive/NRestarts0；只Emily app restart，adapter PID不变，其余env/Node/schema/dependencies/bridge/proxy/DNS/业务不动。root-only停后SQLite+env/key/cmp `/var/backups/emily-20260930/pre-7d2c642`，旧5ca516d保留，回滚优先code不覆盖新用户数据。

真实Chrome当前11首原列表/原漫游/历史/settings保留，实际晓伊中文67字14.304s→原日文歌、原名UI、singleaudio/context-clear不换源、paused/logout/pageErrors[]/complete=true；不新建节目/加歌/改voice/quiet。真实混日文晓晓probe合成可解码不是发音验收；本次具体曲目链路通过不代表David所有日语跳过问题根因已确认。文案仍有泛化，情感体验待用户。assets index-C9ElvXDJ.css/index-DbojVw-b.js。

## 验收与放行

- 本地：typecheck、后端测试类型检查、前后端测试、build、`test:built`、`test:tts`、`test:browser`。
- 可复跑浏览器检查默认使用已安装Chrome；或设 `EMILY_BROWSER_EXECUTABLE` 指向允许的浏览器。需ffmpeg生成明确test-only音频，无真实账号读取。Playwright为开发依赖，不进入生产业务。
- 测试fixture成功只证明浏览器/接口/真实解码切换，不证明网易或模型连通。
- 真实账号：扫码/重启后加密授权、本人歌单、会员/许可整曲、不可用/试听歌曲明确排除、实际CDN和模型返回、节目主持→歌曲→下一首、seek/安静模式/暂停/恢复/错误提示。
- 浏览器PWA：图标和SW200，实际ready/controller，离线外壳能打开、私有API/二维码/歌单/音频不在Cache Storage，退出清空播放器。
- 小米12S：真实HTTPS、扫码返回、自动播放限制、锁屏按钮、后台/熄屏连续收听及PWA安装；桌面手机视口不代替真机。
- 最后才给主人试用链接。费用、新资源或可能影响既有生产服务的动作按当次范围处理，不能把测试成功当已公开发布。
