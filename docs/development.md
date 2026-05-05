# Emily Development Guide

Emily 当前从本仓库根目录开发。第一阶段已经包含工程骨架；第二阶段目标是先跑通 mock 播放器闭环，不接真实音乐、OAI 模型、TTS 或 SQLite。

## 本地命令

```bash
npm install
npm run dev
npm run dev:web
npm run dev:server
npm run typecheck
npm run build
```

## Phase 2 范围

已实现的 mock 闭环：

- `GET /api/health`
- `GET /api/now`
- `GET /api/queue`
- `POST /api/player/play`
- `POST /api/player/pause`
- `POST /api/player/next`
- 前端播放器读取当前状态、显示 mock 歌曲、队列、串场文案
- 前端播放、暂停、下一首按钮会调用后端并刷新状态

暂不实现：

- 真实音乐平台
- OAI-compatible 模型调用
- TTS 语音生成
- SQLite 持久化
- 登录鉴权

## 验收标准

- `http://localhost:3000/api/health` 返回 `ok`
- `http://localhost:3000/api/now` 返回 mock 当前播放状态
- `http://localhost:5173` 能打开播放器壳
- 页面上的播放、暂停、下一首能改变后端状态
