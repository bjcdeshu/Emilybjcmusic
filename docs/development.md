# Emily Development Guide

## 当前阶段：整站交互与动效精修实施中（2026-10-04，Pi）

David在9f9a57c实用后确认「直接听歌」功能没问题，但UI很不舒服，要求进一步打磨整体UI/交互/设计/动效。Pi唯一写入者（任务01a0f204-d57a-75b4-93d4-c35f2fa8aeae）从clean d8e29be接续。计划：跳主持移入稳定的进度/transport语义区；native sheet完整进出与焦点生命周期；待播菜单/定时/回看信息层级；统一按钮、导航、内容轻过渡。保留已认可的整屏夜色/点阵身份/native sheet与纸色阅读页、Sulafat/完整v6、单audio与六项功能语义。只改前端呈现，不新增供应商请求、付费服务、人格记忆或服务端功能。实现已完成：44px跳主持迁入进度行，固定文本槽与phase轻淡过渡，音频/transport不重挂；useModalDialog统一280ms进入/180ms退出，保留native modal/焦点/scroll lock至动画结束，240ms安全兜底，reduce/hidden即时清理；queue渐展/inert/焦点恢复和过期scope guard，ListeningOptions分组直接定时，回看分段控件/说明折叠，chat与共享点击/导航/反馈节奏统一。Windows typecheck/build/web41/完整browser8通过0skip，未改后端不额外全跑server/deployment；首次browser两项因旧测试在退出动画结束前找到双暂停按钮，改等实际detached并保留原断言后完整通过。新增fixture检查四视口44px跳过/transport不跳/skip后焦点/队列remove后焦点/退出期间仍modal/reduce清理/聊天draft和焦点。证据polish-*.log/design-polish；未调用真实TTS或writer。RN已只读确认仍9f9a57c、两unitsactive/adapter1964070，待候选构建/窄发布/无生成线上呈现检查；技术通过不代替David审美认可。

## 上轮：六项日常体验优化已发布9f9a57c（功能0170579，2026-10-04，Pi）

David本人新反馈『我刚试了试没问题了，整体Emily很舒服了』，并明确批准六项增量优化：暂停态续听位置/已听串场不重复；本次直接听歌；队列下一首/移出/撤销加入；本首结束及15/30/60分钟定时停止；Emily内喜欢/最近实际播放回看；清晰且真实的等待/错误/冷却提示。保持Sulafat、完整串场v6、整屏/native sheet/单audio、原歌单漫游与本人权益，不重做视觉/引擎或加付费服务。新反馈取代旧的用户未认可状态，但不是Pi补跑技术验收。

Pi（任务01a0f204-d57a-75b4-93d4-c35f2fa8aeae）仍唯一写入者，从clean ea8db54、pi/emily-continue-20260930接续。六项0170579已发布，Windows typecheck/testtypecheck/build/server77/web41/browser8/built、RN build/testtypecheck/server77/web41/built全部通过0skip。线上13首、settings/history/授权/programme/完整queue/漫游/index保持；当前真实长稿101字/91文字数字、Gemini24.4秒自然ended→原歌、私有Range206/no-store已通过，已补上之前长语音未通过项。刷新歌曲12秒位置暂停续听/不重念串场、本首真实ended停止不换歌、历史喜欢/最近实际播放入口、四视口/单audio检查通过，最终paused/logout。续听与最近播放采用owner服务端有界元数据，浏览器不持久化聊天/歌单/音频；续听仅匹配同programme/queue item、保持暂停。定时停止基于真实ended/墙钟，不假造音乐进度，手机后台限制须明确。新增owner checkpoint/collection/resume/queue-edit接口，复用kv无需schema迁移；实际播放每10秒及边界保存位置，近期100首仅真实song playing报告，不从programme捏造历史。单次跳过保持pause；队列仅未来item精确操作、seen保留、撤销不还原旧快照。定时只本页生效，真实ended/墙钟核对，刷新退出取消、手动切歌取消本首模式。Gemini安全failure枚举与已知retryAt，不猜Google恢复；新冷却持久于私有kv、防重启绕过。两次窄发布都只重启Emily，保留DB/env及adapter。

回归过程保留事实：首次新增完整server运行3项既有HTTP fixture发生PROVIDER_UNAVAILABLE，未删断言/扩等待，后续两次完整77全部通过；新增web41通过。浏览器首轮7/8因撤销提示挤压小屏聊天输入，移入聊天滚动区修复并保留旧视口断言。补冷却UI fixture最初受模拟墙钟快进影响，retryAt早于测试浏览器时间，修正fixture时间而非放松冷却判定；最终完整browser8/8。证据../.tmp/emily-deployment-review/six-*，浏览器design-daily；不代表物理小米后台或15/30/60分钟真实等待验收。无真实writer/TTS调用用于开发。

0170579发布：pre-0170579一致SQLite+env/cmp，env未改，只有Emily重启、adapter PID1964070保持、health200/NRestarts0。线上第一轮真实host成功，但定时检查脚本中止，未冒称完整通过；后将seek数值显式对齐0.1秒步长，有界续查完成timer/collection/四视口，未重播主持（正确歌曲phase续听）。前次失败没有记录详细错误，故不声称确证根因。在线队列仅下一项next幂等no-op，未加歌/删歌/喜欢/新programme/改偏好；破坏性队列路径以fixture验证。私有证据Emily-private/daily-review-20261004，ACL仅David/SYSTEM/Administrators。

随后修线上观察到的旧重启提示：resume意图不虚称音源已验证，真实song playing checkpoint才清除重启提示并返回剩余warning，UI同步，不删其他报幕/服务警告；提示改中文。新增边界保留其他warning检查。此窄修9f9a57c的Windows typecheck/testtypecheck/build/server77/web41/built、daily browser1，以及RN build/testtypecheck/server77/web41/built通过0skip（没有冒称重新跑browser8）；保留所有旧断言。增加fixture先错误要求所有warning消失，实际有效短报幕warning被保留；修正为只移除重启提示并保留其余warning。pre-9f9a57c一致SQLite+env备份/cmp、原子切current9f9a57c、preflight/health200/两unitsactive/NRestarts0，adapter PID1964070未动，env/schema/依赖/Node/DNS/proxy不改。最终assets index-DMJ5OOuH.css/index-qpkWMq3q.js。

最终实播续听窄验：首次检测出现AssertionError（初版未采集详细断言，不能断定根因），随后只读确认服务端已清重启提示；补安全诊断的一次复验completed=true，12秒歌曲暂停恢复、实际播放后UI无旧重启提示，13首/原programme/settings/history保持、singleaudio/pageErrors[]、最终paused/logout。未重复长稿TTS或全业务回归。发布前后Google本地固定窗口计数均1，0新增供应商生成请求；当前v6/Gemini ready，但下一段仍为此前tts_failed且无旧失败细节，不能声称当前+下一段均ready或长期供应商稳定。当前长段技术链路通过；David10月4日对原整体舒适度肯定，不等于本轮新六项已获主观验收。

本轮完成，未建立后台恢复轮询/定时生成或收费回退。页面定时是用户主动控制，不是服务器常驻任务；后台冻结可能延迟，15/30/60精确到时仅fixture墙钟覆盖。破坏性queue移出/真实like写入未在生产试验，自动fixture通过。异常退出保存best-effort，跨设备并发不承诺接力锁。代码回滚优先0170579（仅撤notice修正）或13237d1（撤六项），保留当前DB/env，不盲还SQLite，不为冷却而重启。运维changes/2026-10-04-emily-daily-controls.md；证据six-*.log/私有daily-review-20261004。

## 上轮：完整串场v6已发布13237d1；当时Gemini冷却，新长稿语音未验收（2026-10-03历史观察）

David实际反馈『现在的问题变成串场词太短了』，否定v5普通过渡无下限导致的13–27字报幕效果。Pi从clean7d6fd8e接续，仍唯一写入者；承认上轮27字/6.44s技术播放不能当内容目标通过。保留Gemini/Sulafat与TTS参数、OAPI、UI和所有曲目/queue/history；重点取消短接默认/短句示例，完整口语段落成为常态，短报幕仅明确失败降级。补长度/展开检查并约束编辑不把合格段落删成报幕；连续真实稿必须检查内容和长度，数字不是质量证明。生产已从9e345f3窄发布到13237d1；不为凑字引入虚构经历/音乐事实或用户心情。

13237d1/v6已实现：正常稿（含普通过渡/批量后续/日文安全指代）目标3–5句、约90–160字，硬280；这些是Pi实现目标，David未指定精确字数。新增Unicode文字/数字计数≥60且剔除确切歌名/歌手/专辑后≥40，标点/metadata堆叠不能填满底线；数字不是语义质量评分。过短或已知问题仍只触发一次copy edit，共享原HOST_ONE≤20s/batch deadline，编辑完整复用主持规则且不能删成报幕，合格原稿和邻稿保留；失败才短报幕+warning。旧enum过渡保持原HOST_ONE路径，不新增无谓editor调用；v6懒失效沿用，无新上下文持久化。3项新增回归（server71→74）和既有断言全部保留。

本机typecheck/testtypecheck/build/server74/browser7/built通过0skip。真实OAPI以虚构情境/人工ID检查连续5单首+4批量稿，多轮暴露服务解释/猜心理/虚构经历/假设故事同质化，并非所有稿件质量通过；保留各轮结果，有限匹配和提示修正不冒称彻底解决。最后完整一轮6请求、9段91–123字、无短报幕/已知命中；仍可泛化、假设句式重复，不以检查通过当David听感认可。单独有界编辑1请求7.313s将3稿修订为114/107/109字，无降级/剩余已知命中，只是定向样本。全部writer probes不访问Radio/网易/TTS；私有结果位于Emily-private/paragraph-review-20261003，ACL已核仅David/SYSTEM/Administrators，测试日志../.tmp/emily-deployment-review/paragraph-*.log。RN13237d1 build/testtypecheck/server74/built通过0skip；未另跑未改的web38/deployment9。Windows完整browser7最终重跑通过，assets仍index-Yl2ZXD1U.css/index-n2wJRwpO.js。

发布完成：核RN身份，停Emily后root-only /var/backups/emily-20260930/pre-13237d1配对SQLite+env备份/cmp；env不改、原子切current=/opt/emily/releases/13237d1、专用用户preflight/health200/两unitsactive/NRestarts0，adapter PID1964070未变。旧9e345f3保留代码回滚。只读对比settings/history/加密授权/programme/完整track队列/漫游/index全部保留，本轮现场13→13首（不是历史16首）。没有新programme/加歌/改设置或网易写入。

线上验证未完整通过：第一轮现有节目play后写出当前97字/下一段124字、均v6且无短报幕warning，但两段Gemini状态tts_failed；脚本等音频到120s超时，最后paused/logout。随后一次有界人工复验523ms返回tts_failed、队列保持，未继续循环。再用一次固定非私人试听接口仅诊断安全错误契约，429/GEMINI_TTS_LIMIT，没有保存其他声线或播放试听；只读DB当天本地计数8/60、分钟计数1且窗口早已过，备份发布前为7，说明本次仅1个生成额度被占用，后续被应用冷却拦截。当前代码只有provider429会设置此进程冷却，因此证据支持供应商429引发的冷却，不是本地60/day耗尽；原始provider响应/Retry-After未记录，不能断言Google每日配额、精确恢复时间或永久不可用。没有通过重启清冷却、扩大限额/等待预算、换声或付费回退。

10月3日18:02（UTC+8）David明确『继续』。Pi重核checkout（13237d1，只有本端development.md收尾未提交）、RN身份/现有入口/规则；服务仍从04:38:44 UTC运行，无重启。18:05一次有界真实play复验366ms返回tts_failed、97字仍保留，随后paused/logout；本地生成计数仍8，确认没有新供应商生成请求、仍被同一进程冷却拦截。只读与pre-13237d1对比全部保持，现场仍13首。未再试音、改设置、重建programme、重启或开新provider进程绕过冷却。本地24h窗口从2026-10-02 17:24:15 UTC起算，不是Google每日配额证明。由于provider冷却上限24h，此次应用侧冷却最迟约2026-10-04 04:39 UTC（UTC+8中午12:39）结束；没有原始Retry-After，不能给出更精确的恢复时间，也不保证Google届时恢复。

停止进一步合成，未建立后台/定时重试。新文案已生效，但**新长段真实语音→原歌尚未验收，不能沿用旧27字或旧74字成功结果作本轮证明**；仅冷却结束后再按用户使用/请求做一次有界检查。节目最终paused/logout；最终health200/两unitsactive/NRestarts0/adapter不变。技术失败与长段亲切感未获认可分开记录。运维changes/2026-10-03-emily-paragraph-copy.md；私有live-first-failed.json/live-second-failed.json/live-continue-1805-failed.json/live-result.json/cooldown-result.json及private-live-scripts.json不入Git/共享记忆。回滚只切9e345f3代码、保留当前DB/env；回滚不被当作清除Google冷却的手段。

## 上轮：串场口语策略v5已发布9e345f3，但实际反馈台词过短（2026-10-03）

David实际听后明确『这次这个音色好很多了』，但台词仍『有人机的感觉』、不够亲切；随后认可少解释腔/不硬凑感悟、有具体上下文就展开、连续多段检查的方案。Pi仍为唯一写入者，从clean41778bd继续；保留正式Sulafat/Flash-Lite及所有TTS参数、OAPI写稿通道、界面、歌曲/queue/漫游/history，只调整写稿策略与例子，旧稿沿现有版本机制在正常准备时更新，不启动全队列生成。本轮从生产7280ba1升级到9e345f3。批准的是策略方向，不代表新台词已获听感认可；音色已有David『好很多了』的明确正面评价，不再把音色本身记为完全未反馈。

实现v5：重写提示/情境示意，无通用字数下限，有具体话题保留完整回应；单首与batch共用，batch避免把本批末项叫电台最后一首。多轮真实OAPI写稿（明确虚构上下文/人工ID、不走网易/TTS）暴露光改提示仍有心理推测/声音属性/服务解释回潮，故增加小范围已知话术检查，命中才最多一次copy edit，共享原始写稿deadline，不扩总20s单首预算。编辑只返回内部索引与稿，不动选择/顺序；失败或仍命中仅该稿降级报幕并提示，非全批重新选歌。检查是启发式，不是假称事实或自然度评分。保留原上下文清理、pause/late guard、懒失效与当前+下一段预生成。初版测试空值类型/可选属性类型错误已修；新增缺陷检查/fixture选择归属导致断言失败，补问题识别并把通用fixture改为明确测试说明，保留长段/状态断言后全server71通过。最终Windows typecheck/testtypecheck/build/server71/browser7/built通过0skip；未改web/deployment，不冒称另跑web38/deployment9。真实OAPI虚构上下文多轮迭代仍见泛化，这不是情感质量验收；最后口语编辑真实单次5.585s修订3段已知坏稿，保留上下文、无报幕降级/剩余已知匹配（只是启发式），后补同类措辞变体。所有写稿检查不访问网易/Radio/TTS；另一次独立编辑诊断曾因临时脚本缺base末尾斜杠失败，修成既有/v1/后成功，应用base处理未改。最终再次Windows typecheck/testtypecheck/build/server71/browser7/built通过0skip；最新真实内部编辑一次5.107s修订3段明确虚构场景坏稿、无降级且无剩余已知命中。RN9e345f3 build/testtypecheck/server71/built通过。没有运行未改动的web38/deployment9；线上UI资产与7280ba1相同。

已完成发布：RN身份核对、仅停Emily，root-only /var/backups/emily-20260930/pre-9e345f3配对SQLite+env备份/cmp，env/TTS/OAPI配置不改，保留7280ba1回滚；切current9e345f3、服务用户preflight/health200/两unitsactive/NRestarts0，adapter PID1964070不变。只读与停机备份对比确认settings/history/加密授权/节目/队列完整track对象/漫游/index均保留。旧稿lazy失效，启动未调用写稿/TTS。

真实Chrome当前节目检查completed=true/pageErrors[]：现场16首（与上轮17首不是同次观测），v5中文串场27字、准备11.403s、Gemini/Sulafat语音6.44s/gain0.9，natural ended→同一原网易歌；受保护Range206/private-no-store、同audio、queue16→16/原programme/漫游/settings/history通过，最终paused/logout，未加歌/新programme/改设置。随后只读DB确认当前＋下一段hostingVersion5/Gemini ready，原备份状态对比全部通过。截图已读取；本段是无新私人聊天的短过渡，不是长篇上下文质量验收，日文原名UI保留。新策略仍可能有泛化/过短，已知话术检查不是全面语义保证，最终亲切感待David实际反馈。

证据：本机私有Emily-private/copy-review-20261003含多轮虚构上下文稿、editor-result.json、live-result.json及线上截图/私有稿；不入Git/共享记忆。测试与候选日志../.tmp/emily-deployment-review/copy-*.log，运维changes/2026-10-03-emily-conversational-copy.md。回滚可切7280ba1代码并仅重启Emily，保持当前DB/env（旧版按其版本机制重备稿）；不得用旧DB覆盖用户新数据。

## 上轮：正式Gemini主持已上线7280ba1（功能759f482），线上真实串场→歌曲通过（2026-10-03）

David本轮明确『我就要可用的线上 Gemini 主持，推进』，取代此前只做试听/不更换正式声线的阶段边界。Pi仍唯一写入者，从f88676b和本端上轮六份未提交收尾文档继续并保留；目标为解决真实生成路径、正式串场、必要配置和Emily窄发布/线上验证，不以只有样音收尾。专用项目Free Tier已由David确认；不充值/付费中转/无限重试。只把必要最终朗读稿及固定风格交给Google，原聊天/凭据/完整目录不发送；免费服务数据政策不被store=false覆盖。保留原歌曲、programme/queue/漫游/history和OAPI写稿，同audio与pause优先不改。优先核官方另一受支持API/限额免费模型路径，以真实成功和时延选择，而非继续等3.8 Interactions。

进展：RN官方3.1 generateContent单次探测503/50.3s，未作为运行路径。官方3.8 Flash-Lite＋短固定style＋默认WAV的Interactions连续两次真实成功：transition5.469s准备/12.7655s语音、reflective37.114s/16.1655s。据此固定Flash-Lite，未声称定位了旧模型超时根因。实现内部TtsPort/显式Sulafat正式voice/独立hosting enable；OAPI写稿不改，仅最终中文稿≤280发送；原聊天/目录对象/凭据不传。Voice→provider显式分流，无Edge自动回退；host+preview共享2/min60/day上限和cache、当前＋一首lookahead≤2jobs，provider/model/style/version缓存身份与旧DJ引用双重失效。UI正式声线与试听统一，披露免费输入输出政策。新增3后端回归及1正式主持浏览器联合回归；首次浏览器抓到『未播放状态切voice后客户端继续旧text-only曲源』，在初始time0重备新声线，保留中途切voice不打断当前音源。

Windows最终typecheck/testtypecheck/build/server65/web38/browser7/deployment9/built全部通过0skip；新增3项server+1项formal browser保留原全部断言。RN候选759f482 build/testtypecheck/server65/web38/隔离deployment9/built通过；专用用户通过正式内部TtsPort真实bright样文7.887s准备/16.248s语音/cache无再请求。仅停Emily、root-only pre-759f482 SQLite+旧env配对备份/cmp，再私有加入Gemini专用key/free确认/hosting开关、切current759f482并重启Emily；旧2e993d4保留。身份/preflight/health200/两unitsactive/NRestarts0/adapter PID1964070未变，临时Key输入已删除，无Node/DNS/proxy/其他服务变化。

线上真实Chrome154 completed=true/pageErrors[]：现场17首，按David新授权从晓伊显式保存gemini:Sulafat/zh，74字串场9.274s准备、17.84s语音/gain0.9、自然ended→原网易歌；受保护Range206/no-store、单audio、4手机视口、原programme/queue17→17/漫游/history保留，settings仅voice/hostLanguage改变，最终paused/logout。只读生产DB确认当前＋下一首都Gemini tts_ready；未新建programme/加歌或写网易。截图已读，非人工情感/停顿/全文ASR认可；长期/全目录未本轮验收。

收尾发现服务摘要在本页保存Gemini后仍显示旧setup.voice『晓伊』，实际音频和持久设置已经Gemini。窄修摘要读已保存settings.voice，新增浏览器断言不刷新即可显示Gemini；Windows typecheck/build/web38/专项formal browser1通过，未冒称重跑完整server/browser7。此修正不改TTS/transport/配置/歌曲。7280ba1已窄发布：RN build/web38、停Emily后root-only pre-7280ba1配对备份/cmp、preflight/health/units/NRestarts0/adapter不变；原Gemini配置保持。最后真实Chrome只读检查0生成请求、17首、Gemini current tts_ready、设置摘要Sulafat即时一致、completed=true；截图已看。current=/opt/emily/releases/7280ba1，assets index-Yl2ZXD1U.css/index-n2wJRwpO.js；代码级回滚759f482不需要恢复DB/env。回到旧Edge版本2e993d4时需先显式将saved voice改回允许的Edge声线，不能直接用旧DB覆盖新增用户数据。运维changes/2026-10-03-emily-gemini-hosting.md，私有证据../.tmp/emily-browser-tools/design-gemini-host-live及gemini-host/gemini-label日志。

### 上轮结果：首段真实样音成功，后续生成超时，未发布

2026-10-03（本机日期）：David直接确认此Key所属AI Studio项目『是免费层』。Pi从clean已同步6e97529继续；先单次真实固定中文样文请求，成功才在本地限额内比较候选，不自动重试/付费回退。该确认不是模型列表的计费证明，也不把免费服务store=false当作禁止训练。Key仅私有读取，音频/诊断私有保存，不改线上节目/声线/OAPI。Windows实际3次请求：Sulafat/transition HTTP200、端到端45.867s，12.480s/150668B MP324k单声道、严格WAV/转码/decoder/cache复用通过；随后Aoede/transition与Kore/transition各60s超时，未拿到HTTP响应、未发布partial、没有自动重试。不能据此说三声线稳定或已改善自然度。新增明确504/GEMINI_TTS_TIMEOUT与页面首次等待/缓存文案，预算仍原85s内有界。已重新核RN身份/current=2e993d4/两unitsactive/NRestarts0/adapter PID1964070。下面2026-10-02的『免费层待确认』与请求0为当时历史状态。

本轮结论：共5次真实生成调用（Windows3、RN2），1次成功、4次超时。RN专用emily用户/隔离数据调用Sulafat reflective在60s超时；额外一次明确有界120s诊断仍超时，未把预算扩大写入生产代码，没有自动重试或改用付费渠道。随后RN只读models.get HTTP200/187ms，说明当次基础连通和鉴权可用，不能确定语音请求超时根因，也不能说免费额度已耗尽（未收到429）。实际Gemini MP3在Chrome154自然播至ended、12.48s/gain0.9/单audio通过；这是本地单文件技术播放，不是全应用线上验收、全文ASR或中文情感/停顿认可。样音与安全诊断保存在本机ACL保护的Emily-private/gemini-audition-20261003；便于本人播放的文件名Sulafat-transition.mp3。

代码f88676b已push同名独立分支：明确504/GEMINI_TTS_TIMEOUT和等待/缓存文案，三声线仍只是候选，正式主持不改。Windows重新typecheck/testtypecheck/build/server62/web38/browser6/deployment9/built通过0skip；实际读取新增fixture截图，不是线上截图。RN候选/opt/emily/releases/f88676b build/testtypecheck/server62/web38/built通过；首轮部署fixture固定3101与正在运行的adapter冲突，停止在发布前，未动adapter。随后使用一次性unshare --net只启loopback完整deployment9通过0skip，未删除/弱化断言或改变宿主网络。日志../.tmp/emily-deployment-review/gemini-real-*.log、gemini-rn-{candidate,isolated-check,diagnostic}.log。

发布决定：真实RN语音路径未达可用条件，候选不切current、不修改生产env/SQLite/队列/settings/OAPI、不重启任何服务。用于隔离检查的专用Key临时输入已删除并确认不存在；没有把Key装入生产配置。最终current仍2e993d4、health200/两unitsactive/NRestarts0、adapter PID未变；不冒称本轮读取/验证了原节目数量。保留f88676b候选便于后续，未创建无必要的生产备份。下一步先让David听已成功的真实样音，另择一次有界检查定位生成可用性，不能把升到付费或无限等待当默认解决办法。正式个性化Gemini主持还需明确免费服务数据使用及听感接受。

### 前一阶段本地实现（2026-10-02）

David已选定Google官方Gemini TTS并安全提供专用Key，明确要求高效直接推进；子代理只是可选提效手段，不为配置多代理延误主线。Pi继续唯一源码写入者/原任务，从clean ba27ff3开始；当前生产仍为2e993d4的Edge。官方models.list认证HTTP200并列出gemini-3.8-flash-tts，未发送合成请求；该接口不能确认Free Tier，需要项目层级确认，不开通付费/自动付费回退。

本阶段先交付独立、可关闭的官方Gemini固定样文试听通道：中文女声、三段非私人样文、同audio/同gain/结束恢复暂停；不默默把晓伊映射成其他声线，不自动改变settings/queue/history，不向免费API发送私人上下文或派生串场。先真实样音、听感选择再决定正式主持切换，避免再以解码通过冒充情绪和停顿改善。官方3.8的Interactions协议与旧generateContent分开核验；store=false、固定官方origin、限长/超时/限流/私有MP3验证缓存。两个无工具Pi子进程仅审阅提供的公开文档/源码，未获得Key或生产访问权；不安装插件、不改Pi全局设置。免费状态未确认前不执行真实生成或配置上线。

已完成：新增gemini-tts.ts独立固定样文适配器（不实现任意text的TtsPort），官方Interactions/store=false/固定style metadata/unary WAV24k；严格RIFF chunks/格式/时长/8MBJSON/3MBWAV，既有ffmpeg转MP3后decoder验证和原子发布；无自动重试或供应商回退。单job/同key去重，model+voice+style+text+encoding版本cache、signature map12；本地durable2次/min、12次/24h仅计算cache miss，provider429冷却。ready是独立key＋人工确认配置，不冒称API已确认计费。现有preview85秒内总预算80秒，网络最多60秒，转换8秒/decoder10秒，close排空且不发布迟到结果。

Settings按服务端ready显示独立试听引擎与Sulafat/Aoede/Kore，三种固定样文；保存偏好不会将Gemini试听声线设置成正式主持。现有Radio/model/playback源码不变，同audio/0.9gain/自然结束或停止恢复同源同位置paused，切引擎/声线丢弃迟到响应；免费TTS不接收私人聊天、目录、个性化派生稿。共享DjSegment扩展可选provider/model/deliveryVersion，旧Edge接口兼容。默认门禁关闭，新密钥尚未配置到线上。

Windows typecheck/testtypecheck/build、server62/web38/browser6/deployment9/built全部通过0skip。新增七项Gemini单测、一项真实Chrome但使用明确HTTP/WAV音调fixture的联合检查；涵盖门禁零请求/严格协议/实际转码解码/cache/429/超限/timeout/close/owner/禁任意text/不可保存Gemini、单audio/暂停恢复/取消/4手机宽高/logout。初次新增fixture payload unknown与DOM类型断言触发typecheck失败，修精确类型后保留断言完整重跑通过。私有证据../.tmp/emily-deployment-review/gemini-*.log、../.tmp/emily-browser-tools/design-gemini；截图已读，非用户听感认可。两个无工具子进程已结束；其建议由主Pi核原文取舍，未照搬过时2.5候选或把不完整资料当完整API证据。

尚待：David确认Key所属项目Free Tier后，执行有界真实固定样音请求，核真实返回/延迟/中文音色与语义停顿；不得把models.list或fixture作为合成成功。正式个性化主持需先明确免费服务的数据使用边界；本阶段不偷换为固定罐头串场。未访问或改动RN配置/服务，生产仍2e993d4，未生成真实Gemini音频、付费或上线切换。

## 上轮：TTS口语表达与可靠性优化已发布2e993d4（2026-10-02）

David明确『你来优化吧』。Pi从clean ec19847继续同一独立分支单写入，已核RN current=536815c/两units active。范围：现有Edge TTS/专用Gemini内改善口语写稿、固定真实试听与正式响度一致、合成质量验证，先测量原始参数/首尾静音与响度再决定调整；不擅改用户声线/节目/原音源，不加付费服务/混响/配乐/逐句拼接。保留单audio与试听恢复暂停、pause/quiet/队列竞态。测试与实际测量不是人工自然度验收。完成后按既有窄授权仅发布Emily，保留536815c回滚。

功能546b66f、测试时序修正2e993d4已发布：hosting v4增加口语气口/语义落句/不加填充词，保留完整情感段落和事实边界；三个固定非私人样稿transition/bright/reflective，未提供任意text/引擎情绪模式；试听/正式DJ统一0.9 gain，包括调音量和恢复暂停。合成后ffmpeg限定MP3/local protocols/10s/4MB PCM验证实际解码、0.25–<120s与非近静音，cache按文件签名每进程验证、有界128；并发≤2去重包含验证，profile与CLI单源，metadata/synthesis共享deadline，preview85s。已有中文参数/声线不变，不裁静音/归一化/混音/新服务。Windows typecheck/testtypecheck/build/server55/web38/browser5/deployment8/built通过0skip；固定decoder后窄测试及真实晓伊69字14.88s/解码/cache通过。四中文声线同稿current/native共8段测量：时长12.552–17.232s、RMS约-23.6至-20.5dBFS、首尾空白约0.17–0.20/0.55–0.86s；不是LUFS/人工自然度，不足以选择新调音。真实Gemini两轮各3稿，最终66/70/73字13.464/13.8/14.976s，3固定晓伊样文全通过。首轮发现泛化/心理扩大，补约束后二轮仍有泛化推测，不能把解码或prompt当情感质量保证。未写生产列表/历史。

RN首次候选546b66f在发布前server测试发现hostingVersion断言仍可能早于写入完成（已发请求不等于完成，undefined≠4）；未停止生产/未切current，仍536815c。2e993d4测试等待实际持久化版本而不删除断言，Windows server55、RN build/testtypecheck/server55/web38完整重跑通过0skip。RN专用用户真实晓伊长样文14.832s/解码/cache通过。随后停Emily后root-only pre-2e993d4 SQLite+env/key/cmp，current=/opt/emily/releases/2e993d4；旧536815c保留，identity/preflight（含ffmpeg）/health/units active/NRestarts0，adapter PID不变。无依赖版本/schema/env/Node/DNS/其他业务修改，使用既有ffmpeg。

线上第一次检查完成主持→歌曲/三样试听/四视口后末尾状态请求出现Error，未确定网络层根因；健康active/0restart，未伪称第一次全部通过。有界第二次复跑completed=true/pageErrors[]：本次现场6首（不是上一轮8首，不推断历史变化原因），78字晓伊14.88s主持自然ended→原网易歌，3固定样文11.472/12.888/14.64s，正式与试听gain均0.9；各次自然结束恢复同源同位置paused，单audio，四手机视口无横溢出。原6首顺序/programme/roaming/settings/history保持，无新增歌曲/节目/网易写入，最终paused/logout。已读截图，未人工音色/外文发音/长期播放验收。私有证据work/.tmp/emily-browser-tools/design-tts[-live]及tts-*.log，assets index-Yl2ZXD1U.css / index-BJnyt9Vq.js；运维changes/2026-10-02-emily-tts-delivery.md。

## 上轮：收听体验一致性优化已发布536815c（2026-10-02）

David认可源码审阅清单并明确『可以啊，你规划推进』。Pi从干净7e725bc/已同步独立分支继续单写入；生产起点a11d094。计划按安全点歌→阅读连续性→拖动手感推进：搜索单曲默认metadata-only加入，替换明确确认；聊天仅页面内存草稿/不抢回看；真实LRC全文定位/跟随/手动暂停/切歌更新；队列首次定位当前和当前行无损；拖动预览松手提交，键盘保留；清理短英文旧提示。保持现有布局/律动/单audio/声线/原节目边界。已发布536815c：搜索现节目默认加入，空节目显式单首开始；Library新节目/history重编排native确认和scope guard；草稿App内存/clear/logout/disconnect清理，近底跟随/新回复按钮；useLyrics共用12项volatile cache，全文真实当前行/初始定位/手动暂停/回到当前/切歌更新；队列初始定位和当前行不重载；SeekControl pointer预览/release提交/Escape和cancel丢弃/track-phase guard，键盘即时；旧短英文提示和歧义欢迎示例清理。visualViewport适配输入区域，400px高模拟通过，不冒充真机软键盘验证。

Windows typecheck/build/web37/browser5通过0skip，新增tests/ux-browser.test.ts纳入test:browser串行运行；RN build/web37通过。本轮未改server/shared契约，不重跑历史server53/deployment7。早期browser失败：鼠标停在主持区阻止阅读滚动、证据目录依赖、替换确认新增后旧测试缺一步、fixture类型缺picUrl和歌词跨层重复selector；相称修正并保留断言全跑通过。

RN current=/opt/emily/releases/536815c；旧a11d094保留，stopEmily后root-only pre-536815c SQLite+env/key/cmp；identity/preflight/health/两unitsactive/NRestarts0，adapter PID未变；无依赖版本/schema/env/Node/DNS/其他业务变化。真实验证早期现场队列9后8（未确定变化原因，不外推原11首保留），首轮未等歌曲metadata导致拖动验证不通过/整队列状态比较不适当，后轮脚本fill精度不匹配0.1step；修正脚本后有界复跑。最终8首原曲在准备前后相同、曲序/programme/roaming/settings/history不变；无新programme/歌曲/网易写入。真实拖动预览不seek、目标106秒/release实际106秒、恢复暂停位置、58行真实歌词、搜索默认add但线上未执行不同曲新增（fixture覆盖新增/重复）、替换取消/草稿/4视口/singleaudio通过，最后paused/logout/pageErrors[]/completed=true。不声称第一次即成功，也不声称初始9首全过程无变化。

私有证据work/.tmp/emily-browser-tools/design-ux[-live]，最终result.json及state-result.json；assets index-Yl2ZXD1U.css / index-BpvrdQPW.js。运维changes/2026-10-02-emily-ux-continuity.md。用户主观体验/真机键盘/长期播放未本轮验收。

## 上轮：细节与律动第二轮已发布a11d094（2026-10-02）

David要求继续研究可优化细节和律动位置，明确研究后直接做。Pi在干净7ba008d同名已同步分支单写入；生产起点69e7c08。范围：主持字标以真实中频强弱微亮、面板内常驻轻量真实三频提示（背景仍衰减）、切歌不位移及队列阅读细节；不添加伪节拍/歌词跳动/全屏特效，不改变transport/声线/账户或节目。已完成窄发布，不记David主观验收。真实中频包络驱动主持字标opacity .88–1/微光，面板16×18px固定三频提示110/320ms，背景仍衰减；无新graph/RAF/transport。切歌opacity-only，队列aria-current/低对比当前背景/中性副文案最多两行，按下图标微反馈，无持续心形/歌词/进度跳动。

本机typecheck/build/web37/browser4通过0skip，RN build/web37通过。早期浏览器断言采样在面板入场/分析包络前及暂停按钮未限定面板而失败，修等待/selector保留断言后完整重跑通过。本轮前端范围未重跑后端/部署fixture。RN current=/opt/emily/releases/a11d094，旧69e7c08保留，停Emily后root-only pre-a11d094 SQLite+env/key/cmp、identity/preflight/health、两unitsactive/NRestarts0、adapter PID未变。无依赖/schema/env/Node/DNS/其他业务变更。

真实Chrome：既有中文DJ→原网易歌；主持20帧字标响应但位置稳定、面板30帧三频响应/固定占位/同audio、4手机视口、reduce/面板暂停静止通过。原11首/programme/漫游/settings/history不变，无新programme/歌曲/网易写入，最后paused/logout/pageErrors[]/completed=true。实际截图已审阅；不代表自然听感/主观设计或精确节拍验收。私有证据work/.tmp/emily-browser-tools/design-detail[-live]，assets index-DDNwBc7q.css / index-BSziHJfN.js。运维changes/2026-10-02-emily-listening-details.md；代码及收尾文档同步既有独立开发分支。

## 上轮：克制节奏响应与视觉细节已发布69e7c08（2026-10-02）

David认可上轮方案可用，但认为视觉不够高级，要求更多克制到能感到节奏而非乱跳的律动；已明确『ok，推进优化』。Pi在干净d71a4ae/已同步同名分支继续单写入：真实分组频段/轻重音包络、细环微响应、音频驱动慢光、主持小灯，阅读/transport固定；取消定时漂移与面板淡入叠影，保留整屏与真实音频所有权。本轮已发布69e7c08，生产current=/opt/emily/releases/69e7c08；上轮7d2c642保留回滚。单graph/单RAF真实非重叠频段≤24、85/330ms声音条、900/1600ms慢光、低频增量accent≤.65（非BPM）驱动细环≤3.6%；取消固定漂移，主持弱accent/小灯，dialog降低背景响应且不透明平移入场。pause/静音/hidden/offscreen/reduce归零。

Windows typecheck/build、web36、browser4（含实际解码低频脉冲）全部通过0skip；RN build/web36通过。本轮前端范围未重跑server53/deployment7，上一轮结果不冒充本轮。RN身份/专用用户preflight/health正常，两unitsactive、Emily NRestarts0、adapter PID未变；停Emily后root-only SQLite+env/key一致性备份pre-69e7c08/cmp。无依赖/schema/env/Node/DNS/其他业务改动。真实Chrome既有中文DJ自然结束→原网易歌曲，100帧accent0–.65、阅读锚点稳定、4手机视口、sheet同audio/reduce/pause通过；原11首/programme/漫游/settings/history未改，无新programme/新增歌曲，最终paused/logout/pageErrors[]。实际截图已审阅，测试不代表David主观认可或精确节拍检测。

私有证据：work/.tmp/emily-browser-tools/design-rhythm[-live]；线上result.json completed=true。assets index-DUIzW0H_.css / index-CXBvGHUQ.js。RN运维记录changes/2026-10-02-emily-restrained-rhythm.md；开发分支按既有范围同步，不覆盖main。

## 上轮：Emily主持表达与日文名字安全承接已发布7d2c642（2026-10-02）

David在5ca516d实际体验后纠正：串场太短，情感不足，也缺少作为Emily的情感表达；并明确回复『是的，你优化吧』授权实施。Pi继续单写入，当前checkout ee0a9e4干净且已同步origin同名分支。此次不以加字数代替质量：恢复有视角/承接/长短变化的自然主持，不虚构听众心境、个人经历或音乐事实；检查旧队列/ordered确认/手动入队/漫游路径，保留原队列/播放/quiet/voice与页面内存聊天边界。现已发布7d2c642，以下5ca516d为上一轮历史。当轮RN current=/opt/emily/releases/7d2c642，两unitsactive/NRestarts0；最新见本页顶部。

追加问题（2026-10-02）：David报告中文朗读遇部分日语歌曲不读/跳过，怀疑TTS；未提供具体歌，不确定漏读名字/整个串场/歌曲。实际代码允许混日文，晓晓混合样文9.432秒/中文参照9.288秒均tts_ready/解码；不能证明发音正确或复现全部故障。此次对含假名metadata采用自然中文指代，保留原名UI、不造译名、不更换声线/拼接多音源/跳曲，纯汉字日文不能可靠识别。

上一轮生产current=`/opt/emily/releases/5ca516d`（功能e18b3d1、精确检索窄修bea0f80、准备预算/单版本接受5ca516d）。David实际否定54b04f1振幅太杂和晓晓人机感；随后要求具体一首加入当前漫游队列，并一起优化聊天。默认逐曲确认加入队尾/留在聊天，只有显式『另选一组』才更换节目；原音源/位置/暂停/队列/漫游不被入队接管。竖条空间/时间平滑、密度/亮度降低，串场缩短套话并提供同一audio真实声线试听。保留已认可的e3328e8整屏和底部面板。

真实网易查询『李建清《匆匆》』无准确署名；同名实际结果为李剑青等。新版给出明确署名澄清，未悄悄改歌手/添加目标。准确『李剑青《匆匆》』查询返回两个完整权益版本，仍需David确认/选择。真实验证保留12首原队列/原漫游/历史，用已有待播曲测试duplicate/no-op；完整新增一首与竞态由fixture证明，不冒称已将未确认目标加入。最新真实短主持→网易歌、18连续动态采样、暂停/reduce、固定台湾国语女声试听恢复同源位置且保持暂停、12手机首屏/logout通过。原quiet=false djEnabled已恢复，最后paused/logout。自然听感及视觉舒适度仍待David实际评价，测试不替代认可。

本文件是唯一的项目当前执行状态入口。日期交接快照见 [handoff-to-pi-20260930.md](handoff-to-pi-20260930.md)，机器可读验证见 [handoff-verification-20260930.json](handoff-verification-20260930.json)。

- 最新授权（2026-09-30）：David确认持续在本目录由Pi开发，并明确同意部署到RN，承接已提出的 `emily.unbow.de`、专用服务/私有适配器/TTS、独立HTTPS反代与DNS范围；不改主站、不升级系统Node、不重启其他业务。模型使用OAPI，优先Gemini；具体可用模型及Emily专用key仍需核验，未授权复制其他代理密钥或任意修改网关通道。普通实现与必要验证直接推进，需本人输入集中说明。Codex本次负责Cloudflare MCP配置，Pi负责源码及部署；已完成RN独立Emily服务、DNS及HTTPS部署，本人扫码授权、真实曲目与浏览器连续播放已通过有界验证，David最新纠正：取消锁屏/小米专项验收门槛，当前优先改UI/UX。
- 当前写入者：Pi，任务 `01a0f204-d57a-75b4-93d4-c35f2fa8aeae`；原交接整理与验证由 Iris / Hermes default 执行，原任务 `emily-v1-english-20260930`。
- 本机接续目录：`C:/workspace/codex/work/Emily`；分支 `pi/emily-continue-20260930`，基于 Iris 交接提交 `c7af2c2ce8a01e023647e2047befa525aa68c6b4`。
- 接续前已确认 `C:/workspace/codex/音乐开发` 为干净旧 main，使用独立 worktree 保留原目录和分支；来源分支 `iris/emily-v1-english-20260930`，不覆盖 main。
- Iris 已停止功能开发，不再并发修改 Pi 后续责任源码。原两个 Hermes 子代理均已结束，无仍在后台执行的开发子代理。
- 范围继续有效：独立个人 Web/PWA 电台、个人登录、网易云本人权益、中文女声（最新请求取代初始英文默认，英文可选）、精致移动优先视觉；主要设备为小米12S安卓Chrome。不做公众房间、共享VIP池或主站联动。
- 当前代码：React/Vite 前端、Fastify 后端、SQLite、NetEase HTTP 适配、OpenAI-compatible 编排、Edge中/英文TTS、实际音频状态机、PWA和测试。接口见 [api-contract.md](api-contract.md) 及 `packages/shared/src/index.ts`。
- Iris 历史验证：`npm ci`、类型检查、构建和编译启动检查通过；前端26/26、后端21/23，共47通过、2失败。真实英文Edge合成、解码、缓存复用通过。锁文件修正后的当时审计报告0项漏洞。Pi 本机结果见下节，不能将历史 Linux 结果当作 Windows 实测。
- Pi 已修复原两项失败：有界、去重的单首主持预准备；pause 不走网络动作互斥，使用暂停版本阻止迟到 play/next 恢复播放。其他准备动作仍互斥。原断言保留并新增 play、清空、声线变化与关闭竞态测试。
- Iris 的英文主持自由文本修正已保留；`model-hosting.test.ts`三项回归通过。常见无依据事实筛选不等于完整事实认证。
- 证据边界：物理后台/锁屏未测试，但David已取消它们作为交付/继续开发门槛，不再安排专项验证。未确认具体VIP档位或覆盖所有会员/地域曲目。本人授权及2首真实网易歌曲、CDN完整数据、实际Gemini编排、英文主持与浏览器连续切换已验证，见第五阶段；仅对实际测试曲目作结论。
- 交接边界：允许提交和同步Git开发分支；不覆盖 `main`、丢弃本机修改或推送秘密。后续RN独立Emily部署与DNS已获David本轮批准（见最新授权），历史交接本身不授予其他生产操作权限。网站已部署，实际授权/真实音源浏览器链路已通过，未测的物理设备/长时行为不记为通过，也不再作为待交付阻断。

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

## Pi 第五阶段：本人授权、真实音源与超时修复（2026-09-30）

- David直接确认已扫码。公开HTTPS核验music connected=true，读取70个真实歌单；没有输出本人账号、曲目ID/歌单名称或Cookie，未写网易歌单/收藏。SQLite中授权为加密对象，升级停专用服务前一致性备份SQLite+环境key至RN root-only `/var/backups/emily-20260930/pre-fcf4df6`。服务重启后本人连接、歌单读取保持可用。
- 真实Chrome154/393px原节目：5条模型来源队列、真实英文DJ MP3播放、221.447秒歌曲duration与目录一致，暂停位置稳定、seek→恢复成功；Range206/Content-Range/private-no-store。测试代码首次用Playwright fill直接拖曲尾没有触发第二次React input事件，不记为产品seek故障；原生audio seek加真实ended验证完成自动下一段DJ→第二首，后续键盘UI seek真实移动也通过。
- 真实新建节目复现502非JSON：Fastify idle connectionTimeout10秒短于Gemini+首段TTS准备；应用服务仍active无restart，公网代理收到断链。改connectionTimeout150秒、保留30秒入站body timeout/16KB bodyLimit；前端programme/player准备预算135秒，普通read45秒；外部provider/model30秒与TTS60秒仍有界。新增后端/frontend回归，本地typecheck/testtypecheck/build、后端28/28+前端28/28、部署7/7、浏览器fixture1/1，共64全绿0跳过，built启动通过。
- 提交 `fcf4df6` 已构建到RN独立release并原子切current，只停/启动emily，adapter与其他服务未重启；Node22上build/testtypecheck、后端28+前端28全通过。current=`/opt/emily/releases/fcf4df6`；私有preflight重新通过，两服务active/0restart。保留旧release478a12e与一致性备份作为窄回滚。
- 修复后真实programme200/source=model/2条/0 warning，Gemini只编排实际已授权目录，首段TTS就绪；真实host→song→真实ended→next200/tts_ready→host→second song，UI键盘seek、pause/resume、安静模式保持音乐、退出确认登录页后音源清空，无pageerror/横溢出。音乐全字节获取两首分别3,210,388与3,543,981字节、HTTP200/private-no-store；约200.587及221.447秒的实际曲目，不凭试听短片声称整曲。
- 额外自然播放：安静模式下第一首200.587秒未跳曲尾，暂停/恢复后实际播至ended并自动下一首成功，无媒体error；不是人工听感或真机后台验收。DJ连播的前次检查使用曲尾seek加真实ended，不能混写为整个主持节目数小时无中断。检查完成后恢复DJ enabled=true，节目保持paused；测试期间产生实际programme历史，不写永久like/dislike。
- 登录限流在多次开发登录后曾正确返回429，未删rate_limit/绕过验证，等待窗口结束后继续；反代IP聚合限制仍保留，不为方便将trustProxy打开。

## 最新方向纠正与UI/UX重做（2026-09-30）

David认为当前UI/UX丑、没有做好mm参考，明确说锁屏/小米12S验证完全没必要。取消这些专项验收门槛，停止要求本人设备测试；保留已测/未测事实，不泛化为停止功能回归。

- Pi重看原三图，实际打开 `https://mmguo.dev/claudio-fm/` 的ENTER RADIO演示，对照紧凑主持区、黑白重叠节目层、普通无衬线标题、主持文案中心。另看Apple Music网页真实库页面的封面优先组织方式；Poolsuite页面只得到空加载截图，不冒称完成视觉借鉴。
- 删除旧版绿色拟物外框、螺钉、巨大e装饰、桌面营销栏与收听页服务状态卡。单居中播放器，石墨色点阵主持区+白色programme层，正常可读字号。声音状态条仅装饰状态，不冒充音频波形/逐字对齐；真实文案保持完整展示。
- 歌单改封面网格，首次8条/展开全部，开始按钮在歌单前避免70个歌单把行动埋到页底；节目/历史/设置页有常驻真实迷你播放器，切页可播放/暂停/下一首。保留audio状态机和私有接口/缓存政策。
- 原三图、Iris实现归属、授权及真实数据保持；不复制mm头像/语音或第三方素材，不新增云平台/服务或费用。
- UI提交 `80484eb` 已在RN构建发布，current=`/opt/emily/releases/80484eb`，仅重启Emily application；adapter/其他业务不动。私有一致性备份 `/var/backups/emily-20260930/pre-80484eb`；前版fcf4df6保留。后端源码/数据schema/音频状态机未改。
- 本地typecheck/build、前端28项、Chrome联合fixture回归通过（补了历史页mini play/pause）；公开HTTPS确认新hashed JS、真实歌单8→70→收起、选中后开始按钮可用、mini存在、393px无溢出/pageerror、登录200和退出成功。无需本人锁屏或设备检查；视觉是否满意由David实际反馈，不以这些技术通过替代设计认可。

## 第二轮视觉与动效（2026-09-30）

David再次明确第一轮前端仍不够、动效和UI都不好，80484eb不能记为视觉认可。Pi继续前端重做：桌面封面唱片区/节目控制双栏，手机层叠；真实封面为主视觉，CSS黑胶盘只作装饰。唱片展开/旋转仅在实际music playing启用，暂停停止；主持状态有柔和文案面板反馈。Canvas三层连续曲线是设计的phase指示，不是音频分析或语音时间轴；按voice/music状态区别节奏，页面隐藏/不可见/暂停稳定后停止RAF，系统reduce motion静态显示。切页/曲目/主持文字进入、控件按压/选中、封面hover有统一ease，成功消息改toast避免挤动播放器。

新增 `RadioSignal.tsx`、`radio-design.css`；底层audio engine及后端未改。已实际看手机/桌面fixture截图，并在Chrome核对canvas随playing变帧、vinyl music running/pause paused、reduced-motion静态与原play/pause/quiet/seek/next/mini/logout回归通过。设计结果仍需David实际评价，功能检查不能冒充美学认可。

第二轮UI提交 `6493d9e` 已在RN Node22构建发布，current=`/opt/emily/releases/6493d9e`；仅停/启动Emily application，一致性私有备份pre-6493d9e，保留80484eb作为回滚。公开真实Chrome确认新asset、真实封面/Canvas/唱片/paused停止、本人登录200、8→70歌单/开始按钮/mini/退出、393px无overflow/pageerror；已看真实封面手机/桌面截图。未重新跑耗时真实模型programme或设备验收，backend/授权/私有缓存规则不改。

## 参考还原与英文朗读修复（2026-10-01本机时间，接续9月30日）

David再次要求把既有mm参考做好，同时报告英文TTS夹带中文歌名/歌手名。第二轮6493d9e不能当作认可。Pi已发布 `4c70e9f`，RN current=`/opt/emily/releases/4c70e9f`。

- 删除黑胶/封面舞台和双栏，回到600px单列黑色点阵主持区、重叠白色节目卡，点阵Emily字标、真实进度、小型transport、主持文案主位。辅助音量/反馈/安静模式置于文案后；success toast不再遮住页头。原图和人物/语音素材不复制。
- `audio-analysis.ts`持有音频元素生命周期内的单个Web Audio graph；Canvas竖条读取真实频率数据，不再用phase曲线或预设波形。暂停/隐藏/离屏停止RAF，reduce motion静态；audio engine继续负责transport，不伪造逐字字幕时间轴。
- 根因是旧prose仅要求有英文字母，fallback还直接拼原始元数据。新增 `hosting-language.ts`拒绝非Latin字母/markup/controls，模型提示提供nullable spokenTitle/spokenArtist，模型主持及TTS CLI前再拦截。混合名字整体省略，缺可靠可朗读名字用自然英文指代，不编译名/音译，UI歌名歌手保持原样。此为文字脚本边界，不是完整语言识别。
- 重启升级会修复当前SQLite已存混合主持词、失效旧DJ引用，保留授权/曲目/队列/历史。首次播放缺DJ时先解析生成修复后的主持；新增浏览器回归防止静默直接跳过。
- 本地typecheck、server testtypecheck、build、server31/web28/Chrome fixture1、built入口通过。首次server并行测试曾有一次无关media 502/404瞬态，单独及完整重跑通过；reduce-motion断言补等待媒体查询change重绘，不删断言。实际看fixture及公开手机/桌面截图，不能替代David设计认可。
- RN Node22构建/testtypecheck/server31通过；一致性私有备份 `/var/backups/emily-20260930/pre-4c70e9f`，SQLite+env配对、停服务后复制并cmp核验。仅重启Emily application，保留6493d9e，adapter/其他业务未动。
- 公开真实Chrome：本人登录200/连接保持，当前旧混合DJ引用已失效，原名可见；实际Gemini新两首节目200/model/0warnings，全英文首段TTS ready；主持实际播放→真实歌曲，voice与music均有真实分析竖条、暂停静态；393px无overflow/pageerror、8歌单/mini/退出音源清空。产生新节目历史但不写永久反馈、不改网易歌单；最后paused/退出。此轮没有重新做自然完整曲目或设备专项验证。

## 整站一致性重整（2026-10-01）

David直接纠正『整体的ui你为什么不去设计，一致性太差』。4c70e9f技术通过不代表视觉认可；本轮从播放器局部调整改为整站设计，设计约定见 [ui-design.md](ui-design.md)。

- 发布源码 `e4e1b01`，RN current=`/opt/emily/releases/e4e1b01`。共享styles.css控制字体、色彩、间距、圆角、44px主控件与动效，radio-design.css仅负责收听布局；StationIdentity/PageHeading统一登录、节目、历史、设置与QR。桌面认证后四页同680px，手机同16px外边距；黑点阵stage+重叠白paper扩展到全站，mint用于选中，红色限错误/退出。
- 节目方向卡去不同粉彩，歌单仍真实封面优先；设置按实际DOM顺序排列听感→主持与选曲→音乐与服务→折叠帮助→退出，不用CSS视觉重排。导航、迷你播放器、表单、按钮、状态与弹窗统一；音频engine/后端/schema/TTS未改，4c70e9f英文边界保持。
- Windows typecheck/build、web28、Chrome fixture1通过；七类页面/空历史/QR错误态在360/393/768/1360px无横溢出、共有控件字体、主控件≥44px。原真实音频分析、暂停、reduce motion、seek、quiet、mini、历史、声线/保存、退出、SW离线外壳断言保留通过；QR与丰富封面只在显式测试fixture内。
- 实际打开fixture手机/桌面逐页截图及contact sheet；发布后公开真实Chrome登录200、四页共享字体与680px、393px无溢出、新asset、mini、折叠帮助、退出清音源/pageErrors[]通过，查看公开截图。公开检查只读取现有数据，未新建programme、调用模型或重做曲目长时播放；截图/功能不冒充David美学认可。
- RN严格hostname/stripped machine-id核验，npm ci/build通过；仅停启emily，停后一致性配对复制/cmp SQLite+env至root-only `/var/backups/emily-20260930/pre-e4e1b01`，保留4c70e9f。adapter/其他业务/系统Node/DNS/反代未改。资产index-TwDhxOjg.css/index-DssYHLj0.js。

## 下方融合细化与对话选曲（2026-10-01）

David评价e4e1b01『音波表现形式不错，整体氛围感好了很多』，但下方没有融合。首次部分正面评价，不是整站认可。Pi发布a4b19a4：上部/分析不改，paper底色降为冷白#f5f7f5，文案移除嵌套灰卡、与标题左边缘对齐，减少固定空白，transport→文案→轻辅助工具→queue按DOM自然顺序，无CSS order。共享底色/mini保持整站一致。typecheck/build/web28/Chrome fixture1通过，四宽下方对齐/透明/DOM/44px断言、原音频及队列展开回归保留；真实公开五页/登录/mini/退出检查通过并查看截图。配对备份pre-a4b19a4，仅重启Emily。

David随后提出原参考对话框很有用，想与模型沟通音乐风格或具体听什么。Pi已实现并发布8536171，再修兼容性到**cc9ac16**；RN current=`/opt/emily/releases/cc9ac16`。

- 收听页『聊聊想听什么』、节目页『和 Emily 聊聊』打开同设计系统原生dialog。文字对话可用中文，独立于英文TTS；持续补充偏好/具体歌名，明确『播放这档节目』才切换，关闭/跨页可保留当前对话，清空/退出/断开/刷新清除。页面volatile≤30轮、发送最新≤11，未存SQLite/localStorage或日志；说明上下文与选曲元数据会发给已配置模型。
- 新owner/no-store `POST /api/conversation`：≤12消息/每条800chars/16KB、末条非空user；模型最多2搜索+1本人精确歌单，实际检索/完整权益筛选后第二模型请求只能选≤12个唯一候选ID，返回reply/tracks/warnings/ProgrammeRequest。咨询不改变radio/历史/TTS，接受时现有programme重新核验权益。缺模型/错误不假装聊天或播放成功。
- 单inflight、durable12请求/5min、外部timeout保留、95秒stage检查/frontend135秒；shutdown排空咨询再关Store，未升级schema/runtime/桥接或新服务。聊天是听歌咨询，不是公共聊天室。
- Windows typecheck/server testtypecheck/build、server33/web28/browser1、built入口通过；新auth/input/clarification/rights/catalogue IDs/duplicates/mismatch/failure/concurrency/rate及浏览器两轮细化/重开/明确播放/清空/四宽dialog检查。测试先遇origin缺失403预期401、fixture误用env名导致503，修正测试设置后完整通过，不删断言。
- 首次公开真实两轮：第一轮200/两首候选，第二轮502校验失败，诚实停止/退出；cc9ac16窄修兼容单JSON围栏、文字换行、optional null playlist，不修复/编造ID。新增fixture覆盖，并将intent/selection错误分开。再次公开两轮均200/两首proposal，咨询前后queue/status不变，点确认programme200/model、安全英文主持、实际audio播放成功；393/1360dialog fits、pageErrors[]，最终暂停/退出清音源。产生一条节目历史，不写永久反馈/改网易歌单；不冒称全目录、长时自然播放或人工听感。实际查看公开及fixture对话/播放器截图，私有截图不入Git。
- RN每个release npm ci/build，8536171/cc9ac16上server testtypecheck/33通过；仅停启Emily，停后一致性配对SQLite+env复制/cmp至root-only pre-8536171/pre-cc9ac16；旧a4b19a4/8536171保留。adapter/其他业务/Node/DNS/反代未动。公开新asset index-2CgEJQsm.css/index-C0_Cd1kt.js。

## 对话逻辑与自动漫游（2026-10-01）

David指出对话选歌逻辑需优化，询问一次几首并要求自动漫游。Pi功能发布 **e5df56f**，后续窄修 **07e8897**；RN current=`/opt/emily/releases/07e8897`。

- 歌单每批最多12首，候选/权益/模型可减。新建歌单UI默认『原歌单自动漫游』，可在节目页取消或播放器切换；原有节目不自动开启，明确点歌/搜索不启用。近末3首单去重后台准备同歌单下一批，原audio engine仍只由真实ended推进；等待时pause优先。未引入跨源发现/解灰或假进度。
- 同一轮去重，歌单100分页，≤1000已选ID，队列保留2首之前+有界待播。每次分页检索≤10页/60秒stage检查，故大量不可用歌可能触及准备预算，诚实停漫游，不外推全目录。耗尽/失败提示后关闭，不循环重复或切歌单。关闭/替换/清空/shutdown使迟到结果失效，close排空refill/intros；不改schema。
- 对话传前次direction/候选IDs，由Store回读元数据，UI显示当前方向；模型明确用户最新纠正优先、不重复问已答问题，点歌优先精确原唱，风格请求用具体检索而非心情整句。默认约6首或用户数量≤12。返回ordered proposal，确认后按已确认顺序/数量，不再第二次模型洗牌；主持用安全英文fallback且真实权益重核验，不谎称节目二次AI编排。
- Windows typecheck/server testtypecheck/build、server35/web28/browser1通过。新增漫游不重复/暂停/耗尽/重启/关闭与替换迟到、确认顺序、conversation prior context；浏览器显式16曲fixture用UI seek曲尾+真实ended自动跨12→13，非网易/自然长时证据。原播放/分析/PWA与四宽dialog回归保留，实际查看截图。
- 07e8897补修：关闭/替换后旧refill不会冒称仍在准备，失效工作排空后允许新scope续批；10页扫描预算耗尽明确按失败停，不谎称全歌单听完。前端轮询/开关只更新漫游元数据、不覆盖transport，并用actionId/track/title/updatedAt挡迟到旧队列。新增关闭label/暂停音源断言，typecheck/testtypecheck/server35/browser1/built复跑通过。RN同样npm ci/build/testtypecheck/server35、配对备份pre-07e8897/Emily-only原子发布；公开UI切开→关无残留准备label、保持pause/newasset/pageErrors[]。此前真实完整跨批次证据属于e5df56f未篡改。最新JS index-DVIK-w0D.js，CSS不变。
- RN身份核验/npm ci/build/testtypecheck/server35；停Emily后一致性SQLite+env配对/cmp root-only pre-e5df56f，仅Emily restart，旧cc9ac16保留。adapter/其他业务/Node/DNS/反代未动；资产index-BuJIO4F5.css/index-BXQ0VB0O.js。
- 公开真实Gemini/网易：现曲精确原唱请求两首→『这些里面只留第一首』返回1首/context/ordered；咨询queue不变，programme确认顺序相同。本人真实歌单limit1验证一批1首→refill2首/playlist范围/无重复/paused→play/pause/next跨批次且pause保持。无pageerror/溢出，实际查看相关截图。公开漫游是API有界跨批次，不是自然播完12首/人工听感/长期后台；最后漫游关闭、paused、原djEnabled恢复、logout。生成两条节目历史，未写永久反馈或网易歌单。页面效果及模型具体推荐质量仍需实际反馈，不将测试当美学或语义完美保证。

## 播放页沉浸与声音响应（2026-10-01）

David在前轮回复ok后提出整体沉浸感、播放界面更多区域动起来。Pi发布 **19ee849**，RN current=`/opt/emily/releases/19ee849`。不把ok外推为全站审美认可。

- 保留原真实频率竖条、点阵字标与统一paper。增加同一套轻mint/blue背景/主持stage光：只有本机实际playing且音波可见时缓慢漂移，装饰氛围不是波形或节拍检测。沿用RadioSignal现有单RAF/buffer，实际分析能量/低频强度写CSS变量，驱动stage光、paper接缝、on-air halo、播放键外圈、讲话dot；不逐帧React render、不另建audio graph。文字保持阅读稳定，原内容变化入场保留，不做逐字时间轴。
- 暂停/hidden/offscreen/reduce零能量、持续动画停；缺分析/静音不伪造声音数值。沉浸按钮隐藏header/nav/footer，桌面820px、responsive扩大音波stage，保留暂停/seek/切歌/chat/退出。Escape在无dialog时退出，不是浏览器/系统fullscreen，不存设置、不改audio engine/后端/英文边界/漫游逻辑。
- Windows typecheck/build/web29/Chrome fixture1通过，实际声音能量/暂停零/背景animationPlayState/reduce/沉浸播放不中断/四宽360,393,768,1360及Escape检查，原播放/对话/跨12→13/PWA完整断言保留。首轮沉浸四宽出现背景层横溢出，缩窄并约束transform后复跑通过，未删断言。查看playing/paused/mobile/desktop截图。
- RN身份核验/npm ci/build/testtypecheck/server35，通过后仅停Emily，配对SQLite+env root-only pre-19ee849/cmp、原子current切换；原07e8897保留，adapter/其他业务/Node/DNS/反代/schema未动。资产index-BJ7mneCr.css/index-CndaO8Ah.js。
- 公开真实Chrome登录200，现有真实节目英文DJ→歌曲能量非零、进入/退出沉浸保持audio、mobile/desktop截图/无overflow；reduce静态、pause能量归零/漂移停、Escape恢复导航、logout清audio、pageErrors[]。未新建节目/调用模型/写反馈/编辑网易歌单，本轮不重测长自然播放/人工听感/真机/全目录，保留现有漫游开关。最终paused/logout。视觉待David实际反馈；截图检查不是审美认可。

## 上下部连续沉浸融合（2026-10-01）

David肯定19ee849『上面动效感觉很好』，但下面播放卡片不够沉浸，希望与动效一体。Pi发布 **4e2f2fc**，RN current=`/opt/emily/releases/4e2f2fc`。

- 不推翻上部真实音波/声音响应。去掉下部独立白底、上圆角、重叠margin、边缘shadow，改同一石墨空间；night token仅scope radio-device，其他节目/历史/设置/dialog仍shared paper。新增aria-hidden整机柔光，复用现有energy/bass/data-motion，stage透明延伸到标题/控制/文案；下部柔光真实能量响应，不新增RAF/graph/假wave。频谱底8px alpha feather避免静音baseline成为视觉割线，采样/高度逻辑未改。文字稳定、原DOM/按钮44px/所有接口不改。
- Windows typecheck/build/web29/browser1通过；连续透明/无第二卡圆角/上下相接/文案对齐、全机与下部光响应、pause/reduce/沉浸四宽/Escape及原audio/conversation/roaming/PWA断言保留。实际看mobile/desktop/playing/paused截图。不把深色当全站换肤，不将Pi审阅当David认可。
- RN身份核验/npm ci/build/testtypecheck/server35；仅停Emily后配对SQLite+env root-only pre-4e2f2fc/cmp、原子切current，保留19ee849，无backend/schema/runtime/adapter/DNS/proxy/其他业务变化。资产index-DSNE-9WV.css/index-Cep3MmGf.js。
- 公开真实Chrome现有英文DJ→网易歌曲能量/下部光非零、continuous透明零圆角/全机light running；进入沉浸不断音、393/1360无overflow、reduce静态、pause零能量/漂移停、Escape/nav/logout清audio、pageErrors[]。无新节目/模型请求/feedback/网易写入，保持原漫游选择；最终paused/logout。未重测长自然播放/人工听感/真机。新下部融合仍待实际反馈。

## 手机首屏UX与信息取舍（2026-10-01）

David指出手机进入播放页仍不沉浸，要下滑才能看到信息，要求检查哪些内容必要。Pi发布 **f49c838**，RN current=`/opt/emily/releases/f49c838`；本轮实际效果待David反馈。

- 手机普通收听直接进入播放器，隐藏重复站名页头/营销页尾，保留底部导航；舞台/音波高度用dvh按实际视口收敛，短屏进一步压缩留白，不通过全局缩字或固定高度裁切内容。播放/切歌动作返回页面顶部。当前真实歌名成为主标题，歌手次级；长原名首屏最多两行/一行，完整原名仍在『听感与节目』可读。
- 移除重复计时与Emily FM标签、常驻AI徽章及大节目标题；节目名称/真实选曲来源/音量/减少类似/漫游开关与说明放入『听感与节目』。『接下来』默认显示真实下一首/剩余数，可展开完整有界队列。喜欢/安静/对话仍直接可达。
- 主持文案使用原生details：默认关闭，仅非安静DJ阶段显示最多两行真实预览（短屏一行），不伪逐字字幕；全文可展开、缺语音说明保留。播放失败/自动播放阻断/媒体警告、离线/缺配置/账号问题仍直接可见。节目编排警告和来源在返回now的展开区呈现，不再复制横幅挤占首屏。
- 小后端修正：重启提示只在成功重新解析音源后过期，普通programme警告不随play被抹除；新增36th server回归。未改音频engine、模型、权益、schema、桥接、依赖或缓存策略。保留真实频率/同一analysis能量/连续石墨空间、暂停/reduce/visibility gate。
- Windows typecheck/server testtypecheck/build、server36/web29/browser1/built通过。联合浏览器新增360×560、393×640/740/851首屏所有主控与展开入口高于导航、长歌名/歌手/长主持词stress、全文/音量可达与展开不改audio，保留旧四宽/audio/dialogue/跨12→13/immersion/PWA断言。首次stress差4px，缩短短屏留白后完整通过；不删断言。实际查看fixture与公开截图，私有素材不入Git。
- RN身份核验/npm ci/build/testtypecheck/server36；仅停Emily，停后一致性配对SQLite+env root-only `pre-f49c838`/cmp，再原子current，保留4e2f2fc。adapter/其他业务/Node/DNS/反代不改。资产index-K8zveFZd.css/index-B5koEqX9.js。
- 公开真实Chrome现有英文DJ→网易歌曲：restored/playing/immersive/paused四态各360×560、393×640/740/851，歌名/进度/切歌/主要工具/队列与选项入口均首屏可达无横溢出。真实能量/下部光、全文/音量展开不中断、入沉浸不断音、desktop1360、reduce/pause/Escape/logout/pageErrors[]通过。重启提示初始未出现，因此提示过期本轮由fixture证明，公开仅核验播放后无过时提示。不新建programme/调用模型/写永久反馈/编辑网易歌单，漫游选择保留，最终paused/logout；不外推长时/真机/人工听感或整体设计认可。

## 方案一：整屏电台与底部面板（2026-10-01）

David认为f49c838实现不够优雅；Pi比较三种方案后，David明确『毫无疑问选择方案一』。已发布 **e3328e8**，RN current=`/opt/emily/releases/e3328e8`。选择设计方向不等于认可最终页面；发布后David随后明确反馈『现在这个方案，我感觉很舒服』，因此当前整屏方案已获实际正面评价，不外推所有页面/功能完美。

- 手机普通收听即整屏：零卡片边缘/外边距、无常驻四栏nav，顶部明确『节目』返回和听感按钮；其他页面保留导航/真实mini。中部原真实频率条与声音柔光延展，底部歌名/歌手→真实进度→居中64px transport→喜欢/聊聊/队列。flex+100dvh分配空间，长内容不以hidden假裁切；短屏降低stage留白/主按钮56px，不改audio graph/RAF/engine。真实主持预览占稳定区域，点击阅读全文，歌曲时轻入口；无伪逐字字幕。
- 新RadioSheet原生modal dialog承载队列/主持全文/听感选项，独立内部滚动，底部固定真实当前歌曲/播放暂停/切歌。明确close、Escape、backdrop关闭，焦点锁定/返回trigger、body scroll cleanup；面板与页面使用同一audio，开关不seek/换源/暂停。选择队列曲才关闭并显式选歌。media错误面板内也可见，播放错误不藏；喜欢成功toast移至上方不盖底部transport。
- 桌面保留站点导航和较宽电台desk，沉浸切换继续可用；手机默认就是所选整屏，不增加第二个必点模式。Escape先关闭sheet，不意外退出桌面immersive；model dialogue依旧共享原dialog/volatile context/explicit accept。底部sheet是页面交互，不声称系统fullscreen或实现拖拽手势。
- Windows typecheck/build/web29/browser1/built通过；四宽原跨页/声音energy/pause/reduce/dialogue/seek+真实ended跨12→13/PWA回归保留；更新旧selector和导航断言以对应批准的新交互。新增360×560、393×640/740/851 fullbleed/navHidden/controlsFit，长名/长主持词stress、长sheet内部滚动/transport留在视口、focus trap/return/backdrop、四宽sheet边界及sheet play/pause不换源。首次长sheet footer差1px（顶border），调整inner max-height后保留断言通过。实际查看fixture播放/queue/desktop以及公开播放/queue/hosting截图，私有内容不入Git。
- RN身份核验/npm ci/build/testtypecheck/server36；仅停Emily，停后配对SQLite+env root-only `pre-e3328e8`/cmp、原子切current，保留f49c838。无backend/schema/runtime/adapter/DNS/反代/其他业务变化。资产index-CAbuvm08.css/index-D31jHOQU.js。
- 公开真实Chrome现有英文DJ→网易歌：restored/playing/paused各四手机viewport共12首屏fullbleed/navHidden/controlsFit/noOverflow；真实energy、主持全文/音量可达/focus返回、展开不断源、队列panel pause/resume保持同song、reduce静态/pause归零停止drift、返回节目后mini/nav、logout清audio/pageErrors[]全部通过。无新programme/model/permanentfeedback/网易写入，原漫游选择保留，最终paused/logout；非长时自然播放/真机/人工听感证据。
- David随后希望串场台词自然滚动、歌曲显示歌词。当前仅核对固定上游存在lyric/lyric_new模块（LRC/新版逐字接口），Emily私有bridge九路尚无歌词路由，项目无歌词API/解析/显示；未进行真实歌词请求，不能宣称歌词已可用。建议原文字区phase切换：台词慢速阅读辅助非伪时间对齐；歌词实际时间戳随真实audio.time/seek，无歌词或无时间轴诚实降级。新功能尚未实施，不把当前正面反馈当作已完成歌词。

## 中文主持、台词阅读滚动、歌词与波形（2026-10-01，已发布54b04f1）

David最新要求去掉『Emily正在串场』label，用效果提示；改中文女声并请Pi推荐；接续台词自然滚动/真实歌词；询问频谱左高右变。保留已『很舒服』的整屏与底部transport，不重做布局。中文批准替代初始英文默认，不再把旧English-only当当前禁令。

- 推荐晓晓，晓伊可选，原七款英文保留。默认/设置/模型/中文fallback/TTS及UI统一语言；一次性旧settings迁移保留quiet/volume/mood/discovery/授权/queue/history，失效旧DJ，后续主动英文选择可重启保存。Chinese guard要求Han、plain/no-controls/no-URL；英语保留非Latin脚本边界；二者非完整语言/事实识别。模型使用已有Gemini/OAPI，不新增付费服务。
- 实际Edge两款女声metadata/MP3解码/缓存通过：晓晓50,256bytes/8.376秒，晓伊50,400bytes/8.4秒；非人工试听，不能宣称主观听感已验收。
- DJ文字区慢速纵向8px/sec、开头hold2秒、长文到尾停止；short不滚，pause/手动hover-focus-touch-wheel/全文/modal/hidden/offscreen/reduce停，仅阅读辅助不平均配时。无可见串场/playing label，实际voice dot与连续柔光表明说话；暂停/媒体故障继续可见。
- 私有桥新增唯一固定POST `/lyric`（10路）且lyrics专用参数限id/cookie/timestamp/noCookie；其他allowlist/鉴权/4MB/16KB/限额/无cache/log/Set-Cookie保持。owner/no-store `GET /api/music/lyrics/:id` 要已知真实catalogue/本人连接，共享90/min provider-read；parser≤100k chars/2000rows/offset/multi-tags/fractions/blank，缺词/纯乐/无时间轴/错误诚实。歌曲actual media时间/seek定位current，上下淡，short只current；全文原native sheet不换源。volatile≤12cache/abort stale/清私有状态，不存歌词/发模型/SW。
- 左侧高的代码原因：旧pow1.8低→高bin映射在fft256下重复粗低频bin，音乐本身也常低频强。保留竖条，改真正time-domain RMS非重叠窗，固定sqrt显示尺度，静音/缺分析flat。频率energy/bass仍复用原graph/RAF/light，暂停/hidden/offscreen/reduce gate保留；不随机补右边/伪节拍/音源EQ。
- Windows typecheck/server testtypecheck/build/server40/web31/deployment7/browser2/built通过，0跳过。原联合回归audio/conversation/roaming12→13/PWA/four-width/short/sheets/focus保留；新增25秒tone与中文/lyrics explicitfixture覆盖scroll/pause/reduce/manual/modal、actual keyboard seek/paused、plain/instrumental/missing/error still plays。首次新增seek fixture失败是未等歌曲metadata且media fixture缺Range，补真实Range/metadata wait、保留断言后完整browser2通过；未把失败删掉。实际看fixture截图并移除主持链接默认button白底。
- RN身份核验、npm ci/build/server testtypecheck/server40/web31通过，专用用户实际晓晓49,824bytes/8.304秒/解码缓存；node22.23.3不改。停Emily后配对SQLite+env/key+adapter.env+原bridge保存/cmp至root-only `pre-54b04f1`，旧e3328e8保留；新固定lyrics桥与应用原子更新，仅Emily及其adapter停启，配置只加默认晓晓，不改Node/DNS/proxy/主站/其他业务/schema/依赖。两个units最终active/NRestarts0，专用用户preflight全通过。资产index-BASK9jz7.css/index-CamybVP6.js。
- 发布脚本第一次把不存在的EMILY_TTS_VOICE行当必须存在，断言停止后恢复两服务，current仍旧e3328e8（bridge已窄更新）；修为缺项添加而不覆盖其他env。第二次以root误跑owner预检导致uid检查失败，脚本按trap回滚code/env/bridge，两服务active；实际权限始终emily0700/0600未放宽。改以专用用户预检后完成正式发布，未重复/覆盖初始配对备份。
- 公开真实Chrome登录200/本人连接保留/setting=zh+Xiaoxiao/tts available；使用现有真实候选新编两首programme200/model/0warning，Gemini自然中文DJ/实际TTS ready→网易song；实际scroll/Chinese lang/无可见串场label/voice dot与振幅bars、hosting pause/fullsheet/focus/source通过。当前歌曲取到49条真实LRC，显示/actual media seek/current line/pause/fulllyrics sheet同源通过；12手机首屏（restored/song-lyrics/paused×360×560、393×640/740/851）controlsFit/fullbleed/navHidden/noOverflow；reduce零、pause零/driftstop/返回mini/中文声线选项/logout清音源与歌词/pageErrors[]、completed=true。实际看公开speaking/lyrics/fulllyrics截图，私有证据不入Git。新建一条节目历史，未写永久feedback或网易歌单；这次显式候选新programme不启漫游，不冒称保持旧programme scope。最终paused/logout，既有漫游功能由fixture保留证明，不外推本次真实跨批/全目录/长自然/人工听感/真机验证。随后David实际否定竖条过乱和晓晓人机感，最新反馈见本页开头；先前『很舒服』属于e3328e8布局，不升格为这些新功能认可。

## 点歌入队、聊天和克制听感（2026-10-01，已发布5ca516d）

- 功能e18b3d1：owner/no-store `POST /api/queue/add` 单真实ID+不透明programmeId，原节目加一首到队尾，detail/完整权益重查；当前/待播重复no-op，已播过可显式点回，48条有界。不触发programme/model/当前TTS，不改原queue顺序、title/history、transport、漫游source/offset；记录manual ID于原seen，refill晚到重读live seen防重复/覆盖。独立add inflight/24次5min，next/pause可并发，clear/替换/断开/close使迟到失败。前端metadata merge与结束/next后reconcile，绝不perform/restore/load/seek来加入。
- 单曲named target只能来自user原文/严格真实title+artist，不把李建清自动改李剑青，不补6首；无准确署名给实际同名clarifications先确认，多个正确版本展示专辑供只选一个；显式replace才返回programme。手机native底部paper对话/紧凑identity，逐首加入/成功提示/留在对话，固定可达composer/Enter与IME/重试/清空/焦点body lock/restore；volatile30轮/latest11不存聊天。
- calm bars≤40/width÷10，7邻域triangular spatial avg、280ms升/650ms降、幅度62%/opacity.6；测量加权历史而非即时波形，不random/mirror/BPM/EQ。实际静音/缺分析/pause/hidden/offscreen/reduce即flat/still，原频率energy/bass/单graph/RAF柔光保留。
- 中文fallback只说下一首，模型通常12–45字/一句，避免反复『陪你/忙了一天』套话；已有中文queue文案/旧cache一次短化，不改用户声线/settings/queue/history。中文Edge rate-2%/volume-12%/pitch-2Hz/versioned cache；英文profile及cache构成不变。晓晓无推荐标签，增晓臻/晓雨台湾国语，owner固定样文试听8次5min，不接任意text/SSML/新服务；同一audio暂停音乐→preview→恢复旧源/position **paused**，不自动续播/next/保存voice。
- 本机typecheck/server testtypecheck/build/server46/web34/deployment7/browser3/built全通过0跳过；原audio/dialogue/roaming12→13/PWA/lyrics/sheets/短屏断言保留，新增精确1首/署名差异/版本/权益、add尾序与history/暂停保持/重复/权限/上限/clear/替换/close/next/refill竞态与真实Chrome单audio preview restore。初次test unknown JSON payload触发415、未知目录ID导致404、重复gate使测试shutdown等待，修fixture并保留断言后全server通过；首新browser证据目录未创建ENOENT，补mkdir完整3测试重跑通过，没删功能断言。
- 实际Edge本机晓臻34,992bytes/5.832秒、晓晓30,384/5.064秒；RN专用用户晓臻34,704/5.784秒、晓晓29,808/4.968秒，female metadata/解码/cache；非人工试听。RN e18b3d1 server46/web34/build/testtypecheck，bea0f80 server46/build/testtypecheck，5ca516d web34/build；没有SQL schema/dependency/Node/bridge/env/DNS/proxy/其他业务修改。每次仅停启Emily，adapter PID未变；current原子切换，pre-e18b3d1/pre-bea0f80/pre-5ca516d各停后SQLite+env/key root-only复制/cmp，owner预检全通过/NRestarts0/两unitsactive。54b04f1及前轮release保留，回滚不默认覆盖用户新授权/历史。
- 真实第一检查准确查询写法『只查询李剑青…』被本地短语提取当歌手一部分，诚实停止；bea0f80补检索动词与测试。后续quiet原为djEnabled=false，脚本错误要求DJ必有导致false，不是音源故障；临时启DJ/重载，按queue/current/status/scope比较排除正常预准备updatedAt变化，finally恢复原quiet；最后5ca516d complete=true。入队api135s/试听75s与后端detail+rights/TTS预算对齐；多个版本接受一项后同proposal其他版本禁用。
- 公开真实Gemini两次consult200：错署名只澄清不扩/替换，正确署名返回2版本/完整权益，原12条current/title/scope/history不变。短中文51chars/真实TTS→原网易歌曲；连续18帧100ms观察，≤40根、变化有界（该曲该窗口最大相邻6px，非全目录舒适度证明）。实际playing时已有待播曲duplicate校验200/already_present，不换audio/time/暂停意图，原漫游继续；没有给目标歌执行加入。pause/reduce energy0/still、restored/song/paused×360×560、393×640/740/851共12首屏全部fits/noOverflow/navHidden；晓臻真实试听同audio、自然ended恢复原song/time保持paused、未保存voice不变、quiet恢复/logout音源清空/pageErrors[]。无新programme/history/permanentfeedback/网易写入；不外推长时/真机/自然听感/新美学认可。
- 最新资产index-C9ElvXDJ.css/index-juQzwINS.js；private evidence `../.tmp/emily-browser-tools/design-calm-enqueue` / `design-calm-enqueue-live`，已实际审阅，不入Git。公开结果complete=true只涵盖上述路径，真实新目标入队等待署名/版本确认。

## 主持表达与日文名字安全承接（2026-10-02，7d2c642）

- David明确授权纠正过短串场，随后追加中文朗读部分日语歌曲跳过的问题。Pi新增hosting-editor.ts：Emily温暖/敏锐/好奇、有自己视角，通常2–5句/60–140字、硬280，允许长短变化；情感来自真实点歌/节目上下文，不虚构听众心境、亲身经历、歌词/音频特征/歌曲背景，不把去套话等同去情感。提示词约束不是语义认证，也没有用户新的听感认可。
- 模型选曲与单首HOST_ONE写作分离：ordered确认保持选曲顺序，手动入队仍metadata-only/不调模型或TTS；到正常lookahead/navigation再为已选歌曲写稿。旧中文queue v2 DJ引用失效后按需生成v3，保留节目ID/原queue/历史/漫游/quiet/voice；已有v3稿件重启复用，英文原边界保留。单首模型≤20s、既有TTS≤60s、最多2个intro job、预准备下一首；失败一次后短报幕+明确warning，不循环重试。
- 点歌确认可携带最近≤3条用户原话/600chars listenerNote，服务端按queueitem存有界内存，不将原聊天写SQLite/日志；生成串场和音频沿用私有存储，UI已说明这一区别。消费后/清空聊天owner context-clear/logout/替换/断开/关闭/重启清理；context revision阻止清理后的迟到稿件采用旧原话。原音源/进度/暂停不由清理或入队操作接管。
- 日文：原中文校验并未禁止假名，真实晓晓混合日文样文tts_ready/9.432s、纯中文参照9.288s均可解码，未复现全部故障且未人工核音。现模型接收nullable spokenTitle/spokenArtist，含假名名字自然指代；若仍照搬已知名字则精确替换，残留假名退回安全报幕，不造译名/罗马字、不自动切女声/拼接、不跳曲。纯汉字日文仍可能按中文读，不能承诺准确日语发音。
- 实际修复两项回归：新写作await改变时序导致旧refill测试发现额外续填，intro完成只补lookahead不连锁调refill，原精确队列断言保留通过；clear期间旧prepare可能再次循环，增加item membership使迟到返回QUEUE_CHANGED。新增model-wait pause/voice/clear/close、旧稿lazy/version重用、ordered/manual/volatile context/fallback、日本metadata+TTSfailed保留歌曲测试。Windows typecheck/testtypecheck/build/server53/web34/deployment7/built/browser3通过0skip；RN build/testtypecheck/server53/web34同样通过。
- 真实Gemini多轮样稿审阅：早期仍劝放松/背景音乐/套话，迭代提示并核对4种场景；最终4单首66/88/64/81字及3首整组91/83/81字有效，88字晓晓真实17.952s/解码/cache通过。一次整组返回未通过validation，未伪称成功；增预算/单JSON围栏兼容后有界复跑通过，不修虚构ID。样稿仍有泛泛“自然展开”等表达，未证明稳定高质量。
- 窄发布：只重启Emily application，adapter PID未变，无依赖/SQLschema/env/Node/bridge/DNS/proxy/其他业务修改；停后SQLite+env一致性root-only pre-7d2c642/cmp，原子current/owner preflight/health通过，保留5ca516d及旧备份，回滚不盲覆盖新数据。
- 真实线上没有新建programme或加歌：实际当前11首（不是上一轮12，未擅自补回），原roaming enabled、djEnabled=true、voice=晓伊；本次日文当前曲目67字中文稿/14.304s真实晓伊DJ自然ended→原网易song，原目录日文标题保留。sameTrack/queue/programme/history/roaming/settings/singleaudio/pause/context-clear不换源全部通过，pageErrors[]/completed=true。最终paused/logout，截图实际读取，未保存私有截图/音频/列表入Git。
- assets index-C9ElvXDJ.css/index-DbojVw-b.js；private evidence ../.tmp/emily-browser-tools/design-presence[-live]、../.tmp/emily-deployment-review/presence-*.log。不外推人工自然度、正确日语发音、全部日本歌曲故障已修复或长期连续播放。当前实际稿仍偏泛，技术成功不是David情感认可。

## 下一步

1. 新版7d2c642已发布（上一版5ca516d），可直接在『聊聊』点歌加入；当前原12首漫游队列保留，无须再扫码/新建节目。若David指的是李剑青《匆匆》，先本人确认署名/版本，再加入；不得默认替他接受。默认晓晓未擅改，新增试听可按真实听感选择晓臻/晓雨/晓伊。尚无自然音色或新动效的David认可，不把技术通过当作体验彻底解决。
2. 本人授权保留，无需重新扫码。缺歌词不解灰/换源，不要求真机锁屏/PWA专项；保留舒服布局与连续声音响应，不将技术测试当新效果认可。
3. 上一轮源码5ca516d、发布文档已提交；2026-10-01已把独立分支 `pi/emily-continue-20260930` 推送到origin同名分支并建立tracking，工作树干净，无ahead/behind。旧main/Iris来源分支/原图/秘密未改或上传。继续维护本入口、契约与共享记忆，不以历史『未push』当当前状态。

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
