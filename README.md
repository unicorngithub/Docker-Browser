# Docker Browser

面向本机 **Docker 引擎** 的桌面客户端：在图形界面中管理容器、镜像、网络与数据卷，查看引擎信息与事件流，支持中英文界面与浅色 / 深色主题。

仓库：<https://github.com/unicorngithub/Docker-Browser>

## 功能概览

| 模块 | 说明 |
|------|------|
| **容器** | 列表展示；按 Compose 项目（`com.docker.compose.project`）分组，可折叠；启动 / 停止 / 重启 / 暂停等；端口映射多行展示；一次性在容器内执行命令；右键打开**独立窗口**查看**实时日志**；右键**配置**（编辑镜像、名称、端口、环境变量、命令、自动删除等，保存为**停止并删除后按新配置重建**） |
| **镜像** | 列表、拉取、删除、打标签 |
| **网络** | 列表与删除 |
| **数据卷** | 列表与删除 |
| **事件** | 订阅引擎事件流（摘要展示） |
| **系统** | 引擎信息与磁盘占用（`docker system df`） |

其他说明：

- 通过本机 Docker API 连接（默认与 Docker Desktop / 已配置的 `DOCKER_HOST` 一致）。
- 容器页标题旁可快速**创建并运行**新容器。

## 环境要求

- 已安装并运行 **Docker Engine**（例如 Docker Desktop for Windows / macOS，或 Linux 上的 Docker）。
- **Node.js** 建议 20+。
- 包管理使用 **pnpm**。

## 开发与运行

```bash
pnpm install
pnpm dev
```

开发模式下会启动 Vite 与 Electron；请确保本机 Docker 可访问。

## 类型检查与构建

```bash
pnpm typecheck
pnpm build
```

## 打包安装程序

```bash
pnpm dist
```

产物目录见 `electron-builder.json` 中的 `directories.output`（默认 `release/<version>`）。Windows 为 NSIS 安装包，macOS 为 dmg / zip（需在本机平台执行对应打包）。

## 许可

MIT License（见仓库内 `LICENSE`）。
