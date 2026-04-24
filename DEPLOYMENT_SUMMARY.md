# 部署文件总结

为了帮助你快速部署这个项目，我已经创建了以下文件：

## 📦 新增文件

### 1. Docker 配置
| 文件 | 说明 |
|-----|------|
| `docker-compose.yml` | 完整应用栈（前端+后端）本地部署配置 |
| `backend/Dockerfile` | 后端 FastAPI 容器化配置 |
| `frontend/Dockerfile` | 前端 Next.js 容器化配置 |

### 2. 环境配置
| 文件 | 说明 |
|-----|------|
| `backend/.env.example` | 后端环境变量模板 |
| `frontend/.env.example` | 前端环境变量模板 |

### 3. 云平台配置
| 文件 | 说明 |
|-----|------|
| `render.yaml` | Render.com 部署配置 |
| `frontend/vercel.json` | Vercel 前端部署配置 |

### 4. 文档
| 文件 | 说明 |
|-----|------|
| `DEPLOYMENT.md` | 完整部署指南（中文）|
| `deployment-checklist.sh` | 快速检查清单脚本 |
| `README.md` (已更新) | 主文档中添加了部署章节 |

---

## 🚀 三种部署方式

### 方式 1️⃣：本地 Docker（推荐用于测试）

```bash
# 安装 Docker
brew install docker docker-compose

# 启动应用
cd /Users/jasondai/dev/CIS-5120-final-project
docker-compose up
```

访问：
- 前端：http://localhost:3000
- 后端：http://localhost:8000

### 方式 2️⃣：Render + Vercel（推荐用于生产）✨

最快部署方案，完全免费：

1. **后端部署到 Render**
   - GitHub 连接 → 选择 `backend/` 文件夹
   - 自动部署，3 分钟完成

2. **前端部署到 Vercel**
   - GitHub 连接 → 选择 `frontend/` 文件夹
   - 自动部署，1-2 分钟完成

3. **配置通信**
   - 在后端设置前端 URL
   - 在前端设置后端 API URL

### 方式 3️⃣：Railway（全in一个平台）

两个服务都部署到 Railway，统一管理。

---

## 📋 快速开始

### 选择你的部署方式：

#### 如果你想先本地测试：
```bash
# 1. 安装 Docker（如果还没有）
brew install docker docker-compose

# 2. 运行
cd /Users/jasondai/dev/CIS-5120-final-project
docker-compose up

# 3. 打开浏览器
# http://localhost:3000
```

#### 如果你想直接部署到云：
1. 打开 `DEPLOYMENT.md` 文件
2. 按照 "方案 1: Render + Vercel（最简单）" 部分操作
3. 5-10 分钟内完成部署！

---

## 🔧 配置说明

### 后端环境变量 (`backend/.env`)

```env
# OpenAI API（可选，用于 AI 功能）
OPENAI_API_KEY=sk-...

# CORS 配置
FRONTEND_URL=http://localhost:3000  # 本地使用这个
# 生产：FRONTEND_URL=https://your-frontend.vercel.app

# 服务器配置
PORT=8000
HOST=0.0.0.0
```

### 前端环境变量 (`frontend/.env.local`)

```env
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000  # 本地使用这个
# 生产：NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## ✅ 验证部署

部署后检查：

- [ ] 后端健康检查：`curl http://localhost:8000/`
- [ ] 获取数据集列表：`curl http://localhost:8000/datasets`
- [ ] 前端页面加载：http://localhost:3000
- [ ] 无 CORS 错误（检查浏览器控制台）
- [ ] 数据可视化正常显示

---

## 🎯 下一步

1. **本地测试** → 运行 `docker-compose up`
2. **部署后端** → 参考 `DEPLOYMENT.md` 的 Render 部分
3. **部署前端** → 参考 `DEPLOYMENT.md` 的 Vercel 部分
4. **配置通信** → 更新环境变量，确保前后端连接

---

## 💡 常见问题

**Q: 我没有 Docker 怎么办？**
A: 没关系，直接用 Render + Vercel 部署到云，无需本地 Docker。

**Q: 费用是多少？**
A: 免费！Render 和 Vercel 都有慷慨的免费层。

**Q: 部署需要多长时间？**
A: Render 3 分钟，Vercel 1-2 分钟，总共 5-10 分钟。

**Q: 数据会保存吗？**
A: 当前使用内存存储。关闭服务后数据丢失。生产环境可添加数据库（PostgreSQL）。

---

## 📚 相关文档

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - 完整部署指南
- [`backend/README.md`](./backend/README.md) - 后端文档
- [`frontend/README.md`](./frontend/README.md) - 前端文档
- [Render 文档](https://render.com/docs)
- [Vercel 文档](https://vercel.com/docs)
- [Docker 文档](https://docs.docker.com)

---

祝部署顺利！🎉
