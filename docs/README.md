# 通用API安全性分析工具

> 基于 ArkAnalyzer 框架的HarmonyOS/OpenHarmony API调用安全性检测工具

##  功能简介

这个工具可以自动检测 ArkTS 代码中**所有HarmonyOS/OpenHarmony API调用**的安全性问题：

| 检查项 | 说明 | 输出示例 |
|------|-----|--------|
| **API调用检测** | 检测所有系统API调用 | 发现 5 个不同的API调用需要检查 |
| **能力检查** | 是否用 `canIUse()` 检查设备支持 | ⚠️ 缺少canIUse检查 |
| **异常处理** | 是否在 `try-catch` 中包裹 | 🚨 严重警告 - 可能出现多端错误 |
| **精确定位** | 提供文件名、方法名和行号 | demo/demo.ts: getCurrentLocation() 在方法 checkIn |

##  快速开始

### 准备环境

```bash
# 需要 Node.js >= 18.0.0
node -v

# 安装依赖包
npm install arkanalyzer
```

### 运行分析

```bash
# 方式1: 直接运行
npx ts-node src/LocationAPIAnalyzer.ts

# 方式2: 编译后运行
npm run build
node dist/LocationAPIAnalyzer.js
```

##  项目结构

```
LocationAPIAnalyzer/
├── src/
│   └── LocationAPIAnalyzer.ts          ⭐ 分析工具主程序
├── resources/
│   ├── demo.ts                         示例代码
│   └── arkanalyzer_config.json         配置文件
├── docs/
│   ├── README.md                       本文件（项目总述）
│   ├── QUICKSTART.md                   快速开始指南
│   ├── USAGE.md                        详细使用说明
│   └── ADVANCED.md                     高级用法
└── scripts/
    └── run.sh                          快速运行脚本
```

##  文档说明

| 文档 | 耗时 | 内容 |
|------|------|-----|
| **README.md** (本文件) | 5分钟 | 项目总体介绍 |
| **QUICKSTART.md** | 10分钟 | 快速上手指南 |
| **USAGE.md** | 20分钟 | 详细步骤说明 |
| **ADVANCED.md** | 30分钟 | 高级功能扩展 |

##  完整示例

### 代码示例

```typescript
import geoLocationManager from '@ohos.geoLocationManager';

class Index {
  async checkIn() {
    try {
      const location = await geoLocationManager.getCurrentLocation();
      console.log(`位置: ${location.latitude}, ${location.longitude}`);
    } catch (err) {
      console.error('获取位置失败');
    }
  }
}
```

### 分析结果


========== 通用API安全性分析 开始 ==========

发现 1 个不同的API调用需要检查:
  - getCurrentLocation

⚠️  缺少canIUse检查:
   ⚠️  demo/demo.ts: getCurrentLocation() 在方法 checkIn (位置未知)
      建议添加 canIUse("SystemCapability.Location.Location.Core")

========== 分析结果总结 ==========
总API调用数: 1
API调用实例数: 1
使用canIUse的实例数: 0
正确使用canIUse的实例数: 0
使用try-catch的实例数: 1

【建议】:
  - 建议: demo/demo.ts中checkIn方法的getCurrentLocation()添加canIUse检查

========== 分析结束 ==========

##  安全等级说明

### ❌ 严重警告

```typescript
const location = await geoLocationManager.getCurrentLocation();
console.log(location);
```

**问题**：无能力检查，无异常处理

### ⚠️ 基本安全，建议修改

```typescript
try {
  const location = await geoLocationManager.getCurrentLocation();
} catch (err) {
  console.error('错误');
}
```

**问题**：缺少能力检查

### 完全安全

```typescript
if (canIUse('SystemCapability.Location.Location.Core')) {
  try {
    const location = await geoLocationManager.getCurrentLocation();
  } catch (err) {
    console.error('错误');
  }
}
```

**状态**：通过检测 ✓

##  配置说明

编辑 `resources/arkanalyzer_config.json`：

```json
{
  "targetProjectName": "my_project",      // 项目名称
  "targetProjectDirectory": "./resources", // 项目目录
  "ohosSdkPath": "",
  "kitSdkPath": "",
  "systemSdkPath": "",
  "otherSdks": []
}
```

##  用途

 自动检测**20,848个HarmonyOS API**使用的安全问题  
 快速修复代码中的安全隐患  
 确保应用在多种设备上的兼容性  
 提升应用健壮性和用户体验  
 支持位置、相机、网络、文件等所有系统API  
 精确定位问题代码的文件和方法  

##  获取帮助

-  [快速开始指南](./QUICKSTART.md)
-  [详细使用说明](./USAGE.md)
-  [高级用法](./ADVANCED.md)

##  许可证

Apache License 2.0

---

**现在就开始**：查看 [QUICKSTART.md](./QUICKSTART.md)
