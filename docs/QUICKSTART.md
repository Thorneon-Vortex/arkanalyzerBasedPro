# ⚡ 快速开始

## 🎯 3步钟快速运行

### 第1步：安装依赖

```bash
npm install arkanalyzer ts-node
```

### 第2步：配置项目

编辑 `resources/arkanalyzer_config.json`：

```json
{
  "targetProjectName": "demo",
  "targetProjectDirectory": "./resources",
  "ohosSdkPath": "",
  "kitSdkPath": "",
  "systemSdkPath": "",
  "otherSdks": []
}
```

### 第3步：运行分析

```bash
npx ts-node src/LocationAPIAnalyzer.ts
```

## 📊 预期输出

```
========== 位置API安全性分析 开始 ==========

✗ 发现 getCurrentLocation() 调用
✗ 【建议】 未检测到 canIUse("SystemCapability.Location.Location.Core") 调用
✓ getCurrentLocation() 调用已在 try-catch 中包裹

========== 分析结果总结 ==========
1. 是否有 getCurrentLocation() 调用: 是
2. 是否使用了 canIUse 检查: 否
3. 是否在 try-catch 中包裹: 是

【建议】:
  - 建议使用canIUse

========== 分析结束 ==========
```

## ✨ 结果解读

- ✓ = 检查通过
- ✗ = 检查失败需要改进
- 【建议】= 需要改进的地方
- 【严重】= 严重安全问题

## 📚 下一步

- 详细了解 → [USAGE.md](./USAGE.md)
- 高级用法 → [ADVANCED.md](./ADVANCED.md)
