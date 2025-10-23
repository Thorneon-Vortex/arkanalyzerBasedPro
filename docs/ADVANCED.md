# 🚀 高级用法

## 📚 扩展分析功能

### 添加自定义检查

编辑 `src/LocationAPIAnalyzer.ts`，添加新的检查方法：

```typescript
/**
 * 检查是否设置了超时
 */
private checkTimeout(scene: Scene): boolean {
  const methods = scene.getMethods();
  
  for (const method of methods) {
    const body = method.getBody();
    if (!body) continue;

    const cfg = body.getCfg();
    const stmts = cfg.getStmts();

    for (const stmt of stmts) {
      const exprs = stmt.getExprs();
      for (const expr of exprs) {
        if (expr instanceof ArkStaticInvokeExpr) {
          const methodName = expr.getMethodSignature()
            .getMethodSubSignature()
            .getMethodName();
          
          if (methodName === 'setTimeout') {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}
```

在 `analyze()` 方法中调用：

```typescript
const hasTimeout = this.checkTimeout(this.scene);
if (!hasTimeout) {
  console.log('⚠️  建议设置请求超时时间');
}
```

### 检查权限请求

```typescript
private checkPermissions(scene: Scene): boolean {
  const methods = scene.getMethods();
  
  for (const method of methods) {
    // 检查是否请求了位置权限
    // 实现权限检查逻辑
  }
  
  return false;
}
```

## 🔧 工具扩展

### 支持多个检查规则

创建多个分析器类：

```typescript
export class LocationAPIValidator {
  // 验证位置API的使用
}

export class PermissionValidator {
  // 验证权限申请
}

export class PerformanceValidator {
  // 验证性能相关
}
```

### 批量分析项目

创建 `scripts/batch_analyze.ts`：

```typescript
import { LocationAPIAnalyzer } from '../src/LocationAPIAnalyzer';

const projects = [
  './project1/arkanalyzer_config.json',
  './project2/arkanalyzer_config.json',
  './project3/arkanalyzer_config.json'
];

for (const configPath of projects) {
  console.log(`\n分析: ${configPath}`);
  const analyzer = new LocationAPIAnalyzer();
  analyzer.analyze(configPath);
}
```

运行：
```bash
npx ts-node scripts/batch_analyze.ts
```

## 📊 高级输出

### 生成JSON报告

```typescript
const analyzer = new LocationAPIAnalyzer();
const result = analyzer.analyze('./resources/arkanalyzer_config.json');

// 导出为JSON
const report = {
  timestamp: new Date().toISOString(),
  project: 'demo',
  results: result,
  severity: result.recommendations.length > 0 ? 'warning' : 'ok'
};

console.log(JSON.stringify(report, null, 2));
```

### 生成HTML报告

```typescript
const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <title>位置API分析报告</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .pass { color: green; }
    .fail { color: red; }
  </style>
</head>
<body>
  <h1>位置API安全性分析报告</h1>
  <div class="${result.hasGetCurrentLocationCall ? 'fail' : 'pass'}">
    getCurrentLocation() 调用: ${result.hasGetCurrentLocationCall ? '✗' : '✓'}
  </div>
  <div class="${result.hasCanIUseCheck ? 'pass' : 'fail'}">
    canIUse 检查: ${result.hasCanIUseCheck ? '✓' : '✗'}
  </div>
  <div class="${result.isTryCatchWrapped ? 'pass' : 'fail'}">
    try-catch 包裹: ${result.isTryCatchWrapped ? '✓' : '✗'}
  </div>
</body>
</html>
`;
```

## 🔌 集成CI/CD

### GitHub Actions

创建 `.github/workflows/location-check.yml`：

```yaml
name: Location API Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npx ts-node src/LocationAPIAnalyzer.ts
```

## 📈 性能优化

### 缓存分析结果

```typescript
class CachedAnalyzer extends LocationAPIAnalyzer {
  private cache = new Map<string, AnalysisResult>();

  public analyze(configPath: string): AnalysisResult {
    if (this.cache.has(configPath)) {
      return this.cache.get(configPath)!;
    }

    const result = super.analyze(configPath);
    this.cache.set(configPath, result);
    return result;
  }
}
```

### 并行分析

```typescript
async function analyzeProjects(configPaths: string[]) {
  const promises = configPaths.map(path => {
    return new Promise(resolve => {
      const analyzer = new LocationAPIAnalyzer();
      const result = analyzer.analyze(path);
      resolve(result);
    });
  });

  return Promise.all(promises);
}
```

## 📚 学习资源

- [ArkAnalyzer 官方文档](https://github.com/openharmony-sig/arkanalyzer)
- [ArkTS 语言文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/introduction-to-arkts-V5)
- [OpenHarmony API 文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-references-V5)

---

更多内容敬请期待！
