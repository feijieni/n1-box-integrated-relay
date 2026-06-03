# 中文专区：Linux Device AI Relay Package

这个项目最初来自一个很实际的需求：把一台小型 Linux 设备或服务器，变成一个长期在线的 AI relay 节点，而不是只在某一台机器上能跑的一堆临时脚本。

它不是只面向 N1 盒子。N1 风格部署只是起点，后续目标是让这套部署方式可以迁移到更多 Linux 主机上，例如：树莓派、刷 Linux 的电视盒子、ARM 开发板、迷你主机、家用服务器、小型 VPS，以及运行 Ubuntu / Debian / Armbian 等系统的 x86_64 或 ARM64 设备。

## 项目定位

本项目把 `CLIProxyAPI`、`openclaw-zero-token` 和一套 Linux 部署层整合在一起，重点解决这些问题：

- 服务如何开机自启；
- 小设备如何避免并发请求把机器打爆；
- 浏览器登录和 attach-only Web 模型如何长期保持可用；
- 局域网和公网访问如何配置；
- token、cookie、浏览器状态、ACCESS 文件等运行态内容如何留在目标机器上，而不是误提交到 GitHub；
- 部署失败时如何查看服务状态和日志。

更简单地说：这个仓库的价值不是把两个上游项目放在一起，而是给它们补了一层可复用、可检查、可维护的 Linux 小主机部署方式。

## 支持目标

当前设计适合这些设备或服务器：

- 树莓派；
- 运行 Linux 的电视盒子；
- ARM64 开发板；
- 迷你主机；
- 家用服务器；
- 小型 VPS；
- x86_64 / ARM64 Linux 主机。

推荐系统：

- Ubuntu；
- Debian；
- Armbian；
- 其他带 systemd、apt-get 行为相近的 Linux 发行版。

不建议直接在最小容器环境里运行安装脚本，因为安装脚本需要 systemd、端口监听、持久化目录和服务健康检查。

## 部署前检查

先在目标 Linux 主机上克隆项目：

```bash
git clone https://github.com/feijieni/n1-box-integrated-relay.git
cd n1-box-integrated-relay
```

执行非破坏性检查：

```bash
bash scripts/doctor.sh
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
```

这些检查不会安装软件、不会启动服务、不会改系统文件。它们主要检查仓库结构、必要文件、端口占用、Shell 语法、文档链接和明显的敏感文件风险。

## 一键部署

主安装脚本是：

```bash
install_n1.sh
```

名字里保留 `n1` 是历史兼容，并不代表只能在 N1 上运行。

### 局域网设备 / 家用服务器

```bash
chmod +x install_n1.sh
sudo N1_LAN_IP=192.168.1.100 ./install_n1.sh
```

把 `192.168.1.100` 换成你的树莓派、电视盒子、迷你主机、家用服务器或其他 Linux 主机的局域网 IP。

### 公网服务器 / 反向代理部署

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

`N1_LAN_IP` 这个变量名是为了兼容原脚本。它可以表示任意 Linux relay 主机的局域网 IP 或私有 IP。

## 安装脚本会做什么

安装脚本会：

- 检查项目文件、配置模板、systemd 服务模板、HAProxy 队列配置是否存在；
- 安装基础包，例如 `curl`、`jq`、`haproxy`、`xvfb`、`x11vnc`、`websockify`、`novnc`、构建工具、Python 等；
- 检测或安装 Chrome / Chromium；
- 安装 Node.js 22；
- 通过 Corepack 启用 pnpm；
- 把 `CLIProxyAPI` 复制到 `/opt/cli-proxy-api`；
- 把 `openclaw-zero-token` 复制到 `/opt/openclaw-zero-token`；
- 根据架构安装或源码构建 `cli-proxy-api`；
- 安装 OpenClaw 运行依赖；
- 安装 systemd 服务；
- 安装 HAProxy 串行队列；
- 自动生成 API key 和 gateway token；
- 写入本机访问说明文件；
- 如果 UFW 已启用，则开放必要端口；
- 启动并健康检查服务。

## 安装后怎么用

安装完成后，访问地址和密钥会写入目标机器上的本地文件：

```text
/opt/cli-proxy-api/ACCESS.txt
/opt/openclaw-zero-token/ACCESS.txt
```

查看方式：

```bash
sudo cat /opt/cli-proxy-api/ACCESS.txt
sudo cat /opt/openclaw-zero-token/ACCESS.txt
```

常用地址：

| 服务 | 默认地址格式 |
| --- | --- |
| CLIProxyAPI 管理页 | `http://<host>:8317/management.html` |
| CLIProxyAPI API | `http://<host>:8317` |
| OpenClaw 控制台 | `http://<host>:3001/#token=<OPENCLAW_GATEWAY_TOKEN>` |
| OpenClaw OpenAI-compatible API | `http://<host>:3002/v1` |
| Chrome debug endpoint | `http://127.0.0.1:9222/json/version` |
| noVNC 浏览器登录页 | `http://<host>:6080/vnc.html` |

OpenClaw API 客户端可以这样配置：

```text
Base URL: http://<host>:3002/v1
API Key:  查看 /opt/openclaw-zero-token/ACCESS.txt
```

CLIProxyAPI 客户端可以这样配置：

```text
Base URL: http://<host>:8317
API Key:  查看 /opt/cli-proxy-api/ACCESS.txt
```

需要 Web 登录时，手动启动浏览器登录服务：

```bash
sudo systemctl start openclaw-auth-browser.service
```

然后打开 `/opt/openclaw-zero-token/ACCESS.txt` 里显示的 noVNC 地址。

## 常用维护命令

查看服务状态：

```bash
sudo systemctl status cliproxyapi.service
sudo systemctl status openclaw-chrome-debug.service
sudo systemctl status openclaw-zero-token.service
sudo systemctl status openclaw-api-queue.service
```

查看日志：

```bash
sudo journalctl -u cliproxyapi.service -n 100 --no-pager
sudo journalctl -u openclaw-zero-token.service -n 100 --no-pager
sudo journalctl -u openclaw-api-queue.service -n 100 --no-pager
sudo journalctl -u openclaw-chrome-debug.service -n 100 --no-pager
```

重启服务：

```bash
sudo systemctl restart cliproxyapi.service
sudo systemctl restart openclaw-zero-token.service
sudo systemctl restart openclaw-api-queue.service
sudo systemctl restart openclaw-chrome-debug.service
```

## 安全注意事项

不要提交这些内容到 GitHub：

- `.openclaw-upstream-state/`；
- `auth-profiles.json`；
- 真实 `ACCESS.txt`；
- 真实 `config.yaml`；
- cookies；
- bearer tokens；
- 账号日志；
- 浏览器 profile；
- 机器特定运行目录。

公开仓库只应该保存源码、示例配置、服务模板、安装逻辑和文档。真实密钥、cookie 和运行态数据应该只保存在目标机器上。
