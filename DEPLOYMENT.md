# 部署指南 (Deployment Guide)

这份文档涵盖了如何部署 CIS-5120 Discussion Thread Analysis Platform 到生产环境。

## 📋 前置条件

- GitHub 账户（用于连接仓库）
- Vercel 账户（前端部署）- [注册](https://vercel.com/signup)
- Render 账户（后端部署）- [注册](https://render.com)
- OpenAI API 密钥（可选，用于 AI 功能）

---

## 🐳 使用 Docker Compose 快速部署（本地测试）

### 安装 Docker

#### macOS
```bash
# 使用 Homebrew
brew install docker
brew install docker-compose

# 或下载 Docker Desktop: https://www.docker.com/products/docker-desktop
```

#### 启动容器
```bash
# 进入项目目录
cd /Users/jasondai/dev/CIS-5120-final-project

# 启动所有服务
docker-compose up
```

访问地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 停止容器
```bash
docker-compose down
```

---

## ☁️ 云端部署（推荐方案）

### 方案 1：Render + Vercel（最简单）

#### 第一步：部署后端到 Render

1. **推送到 GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **创建 Render 账户** https://render.com

3. **连接 GitHub 仓库**
   - 进入 https://dashboard.render.com
   - 点击 "New +"
   - 选择 "Web Service"
   - 连接你的 GitHub 仓库
   - 选择 `CIS-5120-final-project` 仓库

4. **配置 Render 服务**
   - **Service 名称**: `cis5120-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build 命令**: `pip install -r requirements.txt`
   - **Start 命令**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - **Plan**: Free（免费层）

5. **添加环境变量** 在 Render 中
   - `OPENAI_API_KEY`: 你的 OpenAI API 密钥（可选）
   - `FRONTEND_URL`: 你的前端 URL（稍后添加）

6. **部署**: 点击 "Deploy"
   - 等待部署完成
   - 记下你的后端 URL（例如：`https://cis5120-backend.onrender.com`）

#### 第二步：部署前端到 Vercel

1. **创建 Vercel 账户** https://vercel.com/signup

2. **导入项目**
   - 进入 https://vercel.com/new
   - 连接你的 GitHub 账户
   - 选择 `CIS-5120-final-project` 仓库
   - 设置 **Root Directory** 为 `./frontend`

3. **配置环境变量**
   - `NEXT_PUBLIC_API_URL`: 你的 Render 后端 URL
     （例如：`https://cis5120-backend.onrender.com`）

4. **部署**: 点击 "Deploy"
   - 等待部署完成
   - Vercel 会提供你的前端 URL（例如：`https://cis5120.vercel.app`）

5. **更新后端 CORS**（回到 Render）
   - 进入你的 Render 后端服务设置
   - 更新 `FRONTEND_URL` 环境变量为你的 Vercel URL
   - 重新部署

---

## 📁 部署文件说明

### Docker 配置
- `docker-compose.yml` - 本地完整栈部署配置
- `backend/Dockerfile` - 后端容器化配置
- `frontend/Dockerfile` - 前端容器化配置

### 环境变量
- `backend/.env.example` - 后端环境变量模板
- `frontend/.env.example` - 前端环境变量模板

### 云平台配置
- `render.yaml` - Render 部署配置（备选）

---

## 🔧 环境变量配置

### 后端 (`backend/.env`)
```
OPENAI_API_KEY=sk-...           # 可选，OpenAI API 密钥
FRONTEND_URL=https://your-frontend.com
PORT=8000
HOST=0.0.0.0
```

### 前端 (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=https://your-backend.com
```

---

## ✅ 部署后验证清单

完成部署后：

- [ ] 后端 API 可访问
- [ ] 健康检查通过：`GET /`
- [ ] API 文档可用：`GET /docs`
- [ ] 前端在你的域名加载成功
- [ ] 前端能从后端获取数据集
- [ ] 浏览器控制台没有 CORS 错误
- [ ] 讨论线程可视化正常工作
- [ ] AI 标注功能工作（如果配置了 API 密钥）

---

## 🐛 故障排除

### 前端无法连接到后端

**问题**: 前端请求后端时网络错误
**解决**:
1. 检查 `NEXT_PUBLIC_API_URL` 环境变量
2. 验证后端正在运行且可访问
3. 检查后端 CORS 配置
4. 确保 URL 末尾没有斜杠

### 后端无法启动

**问题**: Render/Railway 显示"构建失败"
**解决**:
1. 检查日志获取详细错误
2. 验证 `requirements.txt` 在正确的目录
3. 确保 Python 版本是 3.8+
4. 检查 `app/main.py` 是否有语法错误

### CORS 错误

**问题**: 浏览器控制台显示 CORS 错误
**解决**:
1. 更新后端环境变量中的 `FRONTEND_URL`
2. 重新部署后端
3. 检查后端日志确认 CORS 配置

---

## 💾 数据持久化（生产环境）

当前实现使用内存存储。对于生产环境，建议：

1. **添加数据库支持**（如 PostgreSQL）
2. **使用对象存储**（如 AWS S3）存储上传的数据集
3. **实现缓存机制**（如 Redis）

详见 `backend/README.md` 的高级配置部分。

---

## 📊 监控和维护

### Render 监控
- 仪表板：https://dashboard.render.com
- 实时查看日志
- 监控 CPU 和内存使用情况
- 设置告警

### Vercel 分析
- 仪表板：https://vercel.com/dashboard
- 查看分析和性能指标
- 监控构建时间
- 检查错误追踪

---

## 💡 部署提示

- 使用免费层测试/开发
- API 密钥要保安全（使用环境变量）
- 定期检查日志
- 在发布到生产前测试暂存环境
- 考虑使用 CloudFlare 提供 CDN 和 DDoS 保护

---

## 🔗 相关文档

- [Render 文档](https://render.com/docs)
- [Vercel 文档](https://vercel.com/docs)
- [Docker 文档](https://docs.docker.com)
- [FastAPI 部署](https://fastapi.tiangolo.com/deployment/)
- [Next.js 部署](https://nextjs.org/docs/app/building-your-application/deploying)
