#!/bin/bash
# 快速部署检查清单

echo "🚀 CIS-5120 部署检查清单"
echo "=================================="
echo ""

# 检查文件是否存在
echo "✓ 检查部署文件..."
files=(
  "DEPLOYMENT.md"
  "docker-compose.yml"
  "backend/Dockerfile"
  "frontend/Dockerfile"
  "backend/.env.example"
  "frontend/.env.example"
  "render.yaml"
  "frontend/vercel.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (缺失)"
  fi
done

echo ""
echo "📋 后续步骤："
echo "=============="
echo ""
echo "1. 🐳 本地测试（需要 Docker）:"
echo "   brew install docker docker-compose"
echo "   docker-compose up"
echo ""
echo "2. ☁️ 云端部署："
echo "   选项 A: Render (后端) + Vercel (前端)  【推荐】"
echo "   选项 B: 两者都用 Railway"
echo ""
echo "3. 📖 详细说明："
echo "   请查看 DEPLOYMENT.md 文件"
echo ""
