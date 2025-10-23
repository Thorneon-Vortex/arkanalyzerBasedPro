# 📖 详细使用指南

## 📋 目录

1. [环境准备](#环境准备)
2. [基础使用](#基础使用)
3. [分析自己的项目](#分析自己的项目)
4. [常见问题](#常见问题)

## 环境准备

### 检查Node.js版本

```bash
node -v
# 需要 >= v18.0.0
```

### 安装依赖

```bash
npm install
```

## 基础使用

### 使用示例项目

```bash
# 1. 进入项目目录
cd LocationAPIAnalyzer

# 2. 安装依赖（首次）
npm install arkanalyzer ts-node

# 3. 运行分析
npx ts-node src/LocationAPIAnalyzer.ts
```

## 分析自己的项目

### 第1步：准备项目文件

确保你的项目中有 `.ts` 或 `.ets` 文件：

```
my_project/
├── src/
│   ├── pages/
│   │   └── Index.ts
│   └── utils/
│       └── location.ts
```

### 第2步：创建配置文件

创建 `resources/arkanalyzer_config.json`：

```json
{
  "targetProjectName": "my_project",
  "targetProjectDirectory": "/absolute/path/to/your/project",
  "ohosSdkPath": "",
  "kitSdkPath": "",
  "systemSdkPath": "",
  "otherSdks": []
}
```

**重要**：使用绝对路径！

### 第3步：修改分析脚本

编辑 `src/LocationAPIAnalyzer.ts` 的最后几行：

```typescript
// 执行分析
const analyzer = new LocationAPIAnalyzer();
const configPath = './resources/arkanalyzer_config.json';  // 修改路径
const result = analyzer.analyze(configPath);
```

### 第4步：运行分析

```bash
npx ts-node src/LocationAPIAnalyzer.ts
```

## 常见问题

### Q1: "Cannot find module arkanalyzer"

```bash
npm install arkanalyzer ts-node
```

### Q2: 分析没有结果

检查：
1. 配置文件路径是否正确？
2. 项目目录下是否有 `.ts` 文件？
3. 文件中是否包含 `getCurrentLocation` 调用？

### Q3: 配置文件错误

确保路径是绝对路径，示例：
```json
{
  "targetProjectDirectory": "/Users/username/my_project"
}
```

### Q4: 我想调试代码

在代码中添加 `console.log`：

```typescript
console.log('Debug:', this.scene?.getMethods().length);
```

然后运行：
```bash
npx ts-node src/LocationAPIAnalyzer.ts
```

## 输出说明

### 分析项

| 项 | 说明 |
|----|------|
| getCurrentLocation() 调用 | 是否发现API调用 |
| canIUse 检查 | 是否有能力检查 |
| try-catch 包裹 | 是否有异常处理 |

### 建议信息

| 建议 | 含义 |
|-----|------|
| 建议使用canIUse | 缺少能力检查 |
| 该项目在多端中严重不安全 | 缺少异常处理 |

## 下一步

- [高级用法](./ADVANCED.md)
- [项目总述](./README.md)
