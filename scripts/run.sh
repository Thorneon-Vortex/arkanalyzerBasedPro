#!/bin/bash

echo "=========================================="
echo "位置API安全性分析工具"
echo "=========================================="
echo ""

# 检查Node.js版本
echo "[1] 检查环境..."
node_version=$(node -v)
echo "✓ Node.js 版本: $node_version"
echo ""

# 安装依赖
echo "[2] 安装依赖..."
npm install
echo "✓ 依赖安装完成"
echo ""

# 运行分析
echo "[3] 运行位置API安全性分析..."
echo ""
npm start

echo ""
echo "=========================================="
echo "分析完成！"
echo "=========================================="
