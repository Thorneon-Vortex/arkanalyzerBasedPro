# 📚 项目架构与知识点详解

## 🎯 项目概述

这个项目是一个**静态代码分析工具**，用于检测代码中特定API调用的安全性。核心思想是：
- 将代码转换成**抽象语法树（AST）** 或 **中间表示（IR）**
- 遍历代码结构查找特定的函数调用、语句类型等
- 根据检查规则生成分析报告

---

## 📖 核心知识点

### 1️⃣ 静态代码分析基础

#### 什么是静态代码分析？
```
代码 → 不执行代码，直接分析源代码结构 → 生成报告
```

vs 动态分析（运行时分析）：
```
代码 → 执行代码，收集运行时信息 → 生成报告
```

**特点：**
- ✅ 无需运行代码，速度快
- ✅ 能检查隐藏在多条执行路径中的问题
- ❌ 有假阳性和假阴性的可能

---

### 2️⃣ 抽象语法树（AST）& 中间表示（IR）

#### 代码转换流程

```
源代码（.ts/.js）
    ↓
词法分析（Lexical Analysis）- 分解成Token
    ↓
语法分析（Syntax Analysis）- 生成AST
    ↓
语义分析（Semantic Analysis）- 生成IR（中间表示）
    ↓
分析工具处理 - 遍历IR查找规则
```

#### 例子

**原始代码：**
```typescript
const location = await geoLocationManager.getCurrentLocation();
```

**转换成IR后：**
```
ArkAssignStmt: %0 = instanceinvoke geoLocationManager.<...getCurrentLocation()>()
ArkAssignStmt: location = await %0
```

**关键概念：**
- `ArkAssignStmt` - 赋值语句
- `instanceinvoke` - 实例方法调用
- `geoLocationManager` - 对象
- `getCurrentLocation()` - 方法名

---

### 3️⃣ 方法签名与方法解析

#### ArkAnalyzer中的方法表示

```typescript
// 完整方法签名
@demo/demo.ts: Index.checkIn()

// 解析结构
@[package]/[file]: [Class].[method]([params])
```

#### 提取方法信息

```typescript
const expr = ...; // 某个调用表达式

// 获取方法签名
const methodSig = expr.getMethodSignature();

// 获取方法的完整签名信息
const subSig = methodSig.getMethodSubSignature();
const methodName = subSig.getMethodName();
const params = subSig.getParameters();
const returnType = subSig.getReturnType();
```

---

### 4️⃣ 控制流图（CFG）

#### 什么是CFG？

将代码的执行流程表示为图形结构：
```
    ┌─ Entry
    │
    ├─ 语句1
    │
    ├─ 条件判断
    │   ├─ 路径A
    │   └─ 路径B
    │
    └─ Exit
```

#### ArkAnalyzer中的CFG

```typescript
const method = scene.getMethods()[0];
const body = method.getBody();
const cfg = body.getCfg();  // 获取控制流图

// 获取所有语句
const stmts = cfg.getStmts();

for (const stmt of stmts) {
  const exprs = stmt.getExprs();  // 语句中的表达式
  // 处理表达式...
}
```

**为什么重要？** 
- 可以追踪变量流向
- 可以检查所有可能的执行路径
- 可以验证异常处理覆盖

---

### 5️⃣ 表达式类型

#### ArkAnalyzer支持的主要表达式类型

```typescript
import {
  ArkStaticInvokeExpr,      // 静态方法调用: Math.max()
  ArkInstanceInvokeExpr,    // 实例方法调用: obj.method()
  ArkVirtualInvokeExpr,     // 虚方法调用（多态）
  ArkAssignStmt,            // 赋值语句
  ArkReturnVoidStmt,        // void返回
  ArkReturnStmt,            // 返回值
  ArkInvokeStmt,            // 方法调用语句
} from 'arkanalyzer';
```

#### 识别调用表达式

```typescript
// 检查是否是方法调用
if (expr instanceof ArkStaticInvokeExpr || 
    expr instanceof ArkInstanceInvokeExpr) {
  
  // 安全获取方法信息（可能失败）
  try {
    const methodSig = (expr as any).getMethodSignature();
    if (methodSig?.getMethodSubSignature) {
      const name = methodSig.getMethodSubSignature().getMethodName();
      console.log(`调用方法: ${name}`);
    }
  } catch (e) {
    // 某些表达式可能不支持getMethodSignature
  }
}
```

---

### 6️⃣ 异常处理识别

#### 项目中的发现

ArkAnalyzer在处理异常时的特殊性：
- **不用 `Catch` 或 `Try` 语句类型**
- **而是用 `caughtexception` 关键字**

```typescript
// catch块中的语句会被标记为：
ArkAssignStmt: err = caughtexception: unknown

// 这是识别异常处理的关键！
```

#### 完整识别逻辑

```typescript
private checkTryCatchWrapping(scene: Scene): boolean {
  for (const method of scene.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    for (const stmt of body.getCfg().getStmts()) {
      const stmtStr = stmt.toString();
      
      // 方式1：直接检查caughtexception
      if (stmtStr.includes('caughtexception')) {
        return true;
      }
      
      // 方式2：检查throw语句
      if (stmtStr.includes('throw')) {
        return true;
      }
    }
  }
  return false;
}
```

---

## 🏗️ 架构设计

### 核心流程

```
┌─────────────────────────────────────┐
│      LocationAPIAnalyzer            │
│  (静态代码分析工具)                  │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   配置文件解析                       │
│   arkanalyzer_config.json            │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   Scene构建                          │
│   从项目目录加载所有代码             │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   多个检查函数并行运行               │
│   ├─ checkGetCurrentLocationCall()   │
│   ├─ checkCanIUse()                  │
│   └─ checkTryCatchWrapping()         │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   收集结果 & 生成建议                │
│   AnalysisResult & Recommendations   │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   输出报告                           │
│   控制台 + 文件                      │
└─────────────────────────────────────┘
```

---

## 💻 核心代码结构

### 第1步：环境初始化

```typescript
import { SceneConfig, Scene, Logger, LOG_LEVEL } from 'arkanalyzer';

// 配置日志级别
Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.INFO, false);
```

### 第2步：加载项目

```typescript
private buildScene(configPath: string): Scene {
  // 读取配置文件
  let config: SceneConfig = new SceneConfig();
  config.buildFromJson(configPath);  // 从JSON加载配置
  
  // 构建Scene（项目代码的IR表示）
  let scene: Scene = new Scene();
  scene.buildSceneFromProjectDir(config);  // 分析项目目录
  
  return scene;
}
```

### 第3步：检查规则

```typescript
private checkGetCurrentLocationCall(scene: Scene): boolean {
  // 获取所有方法
  const methods = scene.getMethods();
  
  for (const method of methods) {
    // 获取方法体
    const body = method.getBody();
    if (!body) continue;

    // 获取控制流图和所有语句
    const cfg = body.getCfg();
    const stmts = cfg.getStmts();

    // 遍历每个语句
    for (const stmt of stmts) {
      // 获取语句中的表达式
      const exprs = stmt.getExprs();
      
      for (const expr of exprs) {
        // 检查是否是方法调用
        if (expr instanceof ArkInstanceInvokeExpr) {
          const methodName = expr.getMethodSignature()
            .getMethodSubSignature()
            .getMethodName();
          
          // 匹配目标方法
          if (methodName === 'getCurrentLocation') {
            return true;  // 发现了！
          }
        }
      }
    }
  }
  
  return false;  // 没有发现
}
```

---

## 🎨 检查规则设计模式

### 模式1：简单方法调用检测

```typescript
/**
 * 检查是否调用了特定方法
 * 用途：检查API调用
 */
private hasMethodCall(scene: Scene, targetMethod: string): boolean {
  for (const method of scene.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    for (const stmt of body.getCfg().getStmts()) {
      for (const expr of stmt.getExprs()) {
        if (expr instanceof ArkInstanceInvokeExpr) {
          const name = (expr as any)
            .getMethodSignature()
            .getMethodSubSignature()
            .getMethodName();
          
          if (name === targetMethod) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
```

### 模式2：关键字检测

```typescript
/**
 * 检查代码中是否存在特定关键字
 * 用途：检查异常处理、日志等
 */
private hasKeyword(scene: Scene, keyword: string): boolean {
  for (const method of scene.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    for (const stmt of body.getCfg().getStmts()) {
      if (stmt.toString().includes(keyword)) {
        return true;
      }
    }
  }
  return false;
}
```

### 模式3：方法对关系检测

```typescript
/**
 * 检查两个方法是否在同一作用域内
 * 用途：检查能力检查和API调用是否配对
 */
private hasMethodPair(
  scene: Scene, 
  method1: string, 
  method2: string
): boolean {
  for (const method of scene.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    let found1 = false;
    let found2 = false;

    for (const stmt of body.getCfg().getStmts()) {
      const stmtStr = stmt.toString();
      
      if (stmtStr.includes(method1)) found1 = true;
      if (stmtStr.includes(method2)) found2 = true;
    }

    // 如果在同一方法中找到了两个调用
    if (found1 && found2) {
      return true;
    }
  }
  return false;
}
```

---

## 🚀 实现自己的分析工具步骤

### 步骤1：确定检查目标

```
你要检查什么？
├─ API调用
├─ 函数参数
├─ 异常处理
├─ 性能问题
└─ 安全问题
```

### 步骤2：学习ArkAnalyzer API

```typescript
// 核心API
scene.getMethods()                    // 获取所有方法
method.getBody()                      // 获取方法体
body.getCfg()                         // 获取控制流图
cfg.getStmts()                        // 获取语句
stmt.getExprs()                       // 获取表达式
expr.getMethodSignature()             // 获取方法签名
```

### 步骤3：编写检查规则

```typescript
class MyAnalyzer {
  public analyze(configPath: string) {
    const scene = this.buildScene(configPath);
    
    // 编写自己的检查逻辑
    const result1 = this.checkRule1(scene);
    const result2 = this.checkRule2(scene);
    const result3 = this.checkRule3(scene);
    
    return {
      rule1: result1,
      rule2: result2,
      rule3: result3
    };
  }
  
  private checkRule1(scene: Scene) {
    // 你的检查逻辑...
  }
}
```

### 步骤4：完整例子 - 检查日志语句

```typescript
/**
 * 检查是否有console.log调用
 */
private checkConsoleLogs(scene: Scene): number {
  let count = 0;
  
  for (const method of scene.getMethods()) {
    const body = method.getBody();
    if (!body) continue;

    for (const stmt of body.getCfg().getStmts()) {
      for (const expr of stmt.getExprs()) {
        if (expr instanceof ArkInstanceInvokeExpr) {
          try {
            const methodName = (expr as any)
              .getMethodSignature()
              .getMethodSubSignature()
              .getMethodName();
            
            if (methodName === 'log') {
              count++;
            }
          } catch (e) {
            // 跳过异常
          }
        }
      }
    }
  }
  
  return count;
}
```

---

## ⚙️ 配置文件说明

### arkanalyzer_config.json

```json
{
  "targetProjectName": "demo",           // 项目名称
  "targetProjectDirectory": "./resources", // 要分析的目录
  "ohosSdkPath": "",                    // OpenHarmony SDK路径
  "kitSdkPath": "",                     // Kit SDK路径
  "systemSdkPath": "",                  // System SDK路径
  "otherSdks": []                       // 其他SDK
}
```

---

## 📊 测试与调试

### 添加调试输出

```typescript
private checkSomething(scene: Scene): boolean {
  // 添加调试日志
  logToFile('\n[调试信息]');
  
  for (const method of scene.getMethods()) {
    logToFile(`方法: ${method.getSignature()}`);
    
    // 打印所有语句类型
    for (const stmt of body.getCfg().getStmts()) {
      logToFile(`  语句: ${stmt.constructor.name}`);
      logToFile(`  内容: ${stmt.toString()}`);
    }
  }
  
  return false;
}
```

### 运行测试

```bash
# 增加输出详细程度
npm start 2>&1 | tee output.log

# 查看生成的报告
cat info.txt
```

---

## 📚 学习资源

### 关键概念
- 📖 [编译原理 - 龙书](https://en.wikipedia.org/wiki/Compilers:_Principles,_Techniques,_and_Tools)
- 🎯 [抽象语法树(AST)](https://en.wikipedia.org/wiki/Abstract_syntax_tree)
- 🔄 [控制流图(CFG)](https://en.wikipedia.org/wiki/Control-flow_graph)

### 框架文档
- 📚 [ArkAnalyzer GitHub](https://github.com/openharmony-sig/arkanalyzer)
- 🔗 [OpenHarmony 官方文档](https://docs.openharmony.cn/)

### 类似工具
- 🔍 [ESLint](https://eslint.org/) - JavaScript静态分析
- 🛡️ [SonarQube](https://www.sonarqube.org/) - 综合代码分析
- 🐍 [Pylint](https://www.pylint.org/) - Python静态分析

---

## 🎯 常见问题

### Q1: 为什么检测不到某些调用？
**A:** ArkAnalyzer可能存在以下限制：
- 动态调用（通过反射）无法检测
- 跨文件的调用可能丢失
- 某些特殊语法可能不支持

### Q2: 为什么有假阳性？
**A:** 静态分析的局限：
- 无法追踪运行时值
- 条件判断可能不被正确分析
- 库代码的内部调用难以跟踪

### Q3: 如何扩展检查规则？
**A:** 参考本文档的"检查规则设计模式"和"实现自己的分析工具步骤"

---

**下一步**：克隆项目，修改检查规则，实现你自己的分析工具！🚀
