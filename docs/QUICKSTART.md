# ⚡ 快速开始

## 🎯 3步钟快速运行通用API安全性分析

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
该项目会自动分析目标文件夹下的所有内容

### 第3步：运行分析

```bash
npx ts-node src/LocationAPIAnalyzer.ts
```

## 📊 预期输出

```
========== 通用API安全性分析 开始 ==========

发现 5 个不同的API调用需要检查:
  - getCurrentLocation
  - getLastLocation
  - getCameraManager
  - getSupportedCameras
  - isLocationEnabled

🚨 严重警告 - 可能出现多端错误:
   ❌ demo/test_multiple_apis.ts: getCurrentLocation() 在方法 testWithoutTryCatch (位置未知)
      缺少 canIUse("SystemCapability.Location.Location.Core") 且缺少 try-catch

⚠️  缺少canIUse检查:
   ⚠️  demo/demo.ts: getCurrentLocation() 在方法 checkIn (位置未知)
      建议添加 canIUse("SystemCapability.Location.Location.Core")

✅ 正确使用的API:
   ✅ demo/test_multiple_apis.ts: getCurrentLocation() 在方法 testLocationAPIs - 使用规范

========== 分析结果总结 ==========
总API调用数: 5
API调用实例数: 7
使用canIUse的实例数: 5
正确使用canIUse的实例数: 3
使用try-catch的实例数: 6
```

## ✨ 结果解读

- 🚨 **严重警告**：API调用既没有`canIUse`检查也没有`try-catch`包裹，可能导致多端兼容性问题
- ⚠️ **缺少canIUse检查**：建议添加设备能力检查以提高兼容性
- ✅ **正确使用**：API调用规范，有适当的安全检查

## 🎉 恭喜！

你已经成功运行了通用API安全性分析工具！

## 📚 下一步

- 📋 查看 [详细使用说明](./USAGE.md) 了解更多功能
- 🔧 查看 [高级用法](./ADVANCED.md) 进行自定义配置
- 📊 分析结果已自动保存到 `info.txt` 文件
