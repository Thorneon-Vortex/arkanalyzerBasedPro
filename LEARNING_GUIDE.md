# 🎓 快速学习指南 - 从零开始实现代码分析工具

## 📚 知识体系

```
静态代码分析
├─ 编译原理基础
│  ├─ 词法分析 (Lexical Analysis)
│  ├─ 语法分析 (Syntax Analysis)
│  └─ 语义分析 (Semantic Analysis)
│
├─ 核心数据结构
│  ├─ 抽象语法树 (AST)
│  ├─ 中间表示 (IR)
│  └─ 控制流图 (CFG)
│
└─ 实现工具
   ├─ 遍历算法
   ├─ 模式匹配
   └─ 规则引擎
```

---

## 🔥 5分钟快速入门

### 核心概念 (只需记住3个)

| 概念 | 解释 | 例子 |
|------|------|------|
| **Scene** | 整个项目的代码表示 | 所有文件、方法、语句的集合 |
| **Method** | 方法或函数 | `checkIn()`, `build()` |
| **Stmt** | 语句 | `const x = 1;`, `return;` |

### 最简单的检查

```typescript
import { Scene, SceneConfig } from 'arkanalyzer';

// 1. 加载项目
const config = new SceneConfig();
config.buildFromJson('./config.json');
const scene = new Scene();
scene.buildSceneFromProjectDir(config);

// 2. 获取所有方法
const methods = scene.getMethods();

// 3. 遍历找目标
for (const method of methods) {
  const body = method.getBody();
  if (!body) continue;
  
  for (const stmt of body.getCfg().getStmts()) {
    console.log(stmt.toString());  // 打印每个语句
  }
}
```

---

## 📖 学习路径

### Day 1: 理解基础 (1小时)

- [ ] 阅读 `docs/ARCHITECTURE.md` 第1-4节
- [ ] 理解 Scene → Method → Stmt → Expr 的层次关系
- [ ] 运行 `npm start` 查看输出

**关键问题要能答出来：**
- Q: 什么是Scene?
- Q: 一个方法包含什么?
- Q: 如何获取方法中的所有语句?

### Day 2: 学习API (1小时)

- [ ] 研究 `checkGetCurrentLocationCall()` 函数
- [ ] 理解 `instanceof` 和类型检查
- [ ] 理解 `getMethodSignature()` 和方法名提取

**动手练习：**
```typescript
// 练习：找出所有静态方法调用
private findAllStaticCalls(scene: Scene): string[] {
  const calls: string[] = [];
  // 你的代码...
  return calls;
}
```

### Day 3: 实现检查规则 (2小时)

- [ ] 修改 `demo.ts` 添加不同的调用模式
- [ ] 为每种情况编写检查函数
- [ ] 验证检查结果是否正确

**挑战：**
```typescript
// 编写函数检查：console.log调用的个数
private countConsoleLogs(scene: Scene): number {
  // 实现这个函数
}
```

### Day 4: 高级特性 (2小时)

- [ ] 阅读 `docs/ADVANCED.md`
- [ ] 实现跨方法的数据流分析
- [ ] 添加输出到多种格式（JSON、HTML等）

---

## 🎯 实战项目创意

### 初级（适合入门）

1. **内存泄漏检测器**
   - 检查是否有未释放的资源
   - 检查是否有循环引用

2. **性能检查器**
   - 检查是否在循环中调用耗时操作
   - 统计函数调用次数

3. **安全检查器**
   - 检查是否有硬编码的密钥
   - 检查是否有不安全的序列化

### 中级（需要更深入理解）

1. **API使用规范检查**
   - 检查API参数是否合法
   - 检查返回值是否被处理

2. **代码风格检查**
   - 检查命名规范
   - 检查函数长度

3. **依赖分析工具**
   - 生成方法调用图
   - 检测循环依赖

### 高级（需要优化和架构设计）

1. **数据流分析**
   - 追踪变量值的流向
   - 检查潜在的数据泄露

2. **类型推断**
   - 推断变量类型
   - 检查类型不匹配

3. **复杂度分析**
   - 计算圈复杂度
   - 计算认知复杂度

---

## 💡 调试技巧

### 技巧1：打印所有信息

```typescript
// 当不确定某个API如何工作时，打印它！
private debugPrintEverything(scene: Scene) {
  for (const method of scene.getMethods()) {
    console.log('Method:', method.getSignature());
    
    const body = method.getBody();
    if (!body) continue;
    
    for (const stmt of body.getCfg().getStmts()) {
      console.log('  Stmt Type:', stmt.constructor.name);
      console.log('  Stmt String:', stmt.toString());
      
      for (const expr of stmt.getExprs()) {
        console.log('    Expr Type:', expr.constructor.name);
        console.log('    Expr String:', expr.toString());
      }
    }
  }
}
```

### 技巧2：使用Try-Catch

```typescript
// 某些操作可能失败，一定要catch
try {
  const methodName = (expr as any)
    .getMethodSignature()
    .getMethodSubSignature()
    .getMethodName();
  console.log('Method:', methodName);
} catch (e) {
  console.log('This expr does not support getMethodSignature');
}
```

### 技巧3：在测试文件中运行

```typescript
// 创建 test.ts
import { LocationAPIAnalyzer } from './src/LocationAPIAnalyzer';

const analyzer = new LocationAPIAnalyzer();

// 测试不同的检查函数
analyzer.checkGetCurrentLocationCall(scene);
analyzer.checkCanIUse(scene);
// ...

// 运行: npx ts-node test.ts
```

---

## 🚀 快速上手项目模板

### 步骤1：复制项目结构

```bash
cp -r LocationAPIAnalyzer MyCodeAnalyzer
cd MyCodeAnalyzer
```

### 步骤2：修改核心文件

编辑 `src/MyAnalyzer.ts`：

```typescript
import { Scene, SceneConfig, ArkInstanceInvokeExpr } from 'arkanalyzer';

export class MyAnalyzer {
  // 第1步：加载项目
  private buildScene(configPath: string): Scene {
    let config = new SceneConfig();
    config.buildFromJson(configPath);
    let scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    return scene;
  }

  // 第2步：定义你的检查规则
  private myCheck(scene: Scene): boolean {
    for (const method of scene.getMethods()) {
      const body = method.getBody();
      if (!body) continue;

      for (const stmt of body.getCfg().getStmts()) {
        // 你的检查逻辑
        if (stmt.toString().includes('TODO')) {
          return true;
        }
      }
    }
    return false;
  }

  // 第3步：运行分析
  public analyze(configPath: string) {
    const scene = this.buildScene(configPath);
    console.log('检查结果:', this.myCheck(scene));
  }
}

// 第4步：执行
const analyzer = new MyAnalyzer();
analyzer.analyze('./config.json');
```

### 步骤3：运行

```bash
npm install
npm start
```

---

## 🎓 深入学习资源

### 推荐阅读顺序

1. **本项目文档**
   - `README.md` - 项目概述
   - `QUICKSTART.md` - 快速开始
   - `ARCHITECTURE.md` - 深入理解（你现在的位置）
   - `ADVANCED.md` - 高级功能

2. **编译原理基础**
   - 龙书（Compilers: Principles, Techniques, and Tools）
   - 虎书（Modern Compiler Implementation in C）

3. **框架文档**
   - [ArkAnalyzer GitHub](https://github.com/openharmony-sig/arkanalyzer)
   - [OpenHarmony 官方文档](https://docs.openharmony.cn/)

### 推荐项目参考

- [ESLint](https://github.com/eslint/eslint) - JavaScript代码检查
- [SonarQube](https://github.com/SonarSource/sonarqube) - 综合代码质量检查
- [Pylint](https://github.com/pylint-dev/pylint) - Python代码检查

---

## ❓ FAQ

**Q: 我想检查的东西很复杂，从哪里开始？**

A: 按这个顺序：
1. 先打印出所有方法、语句、表达式（使用 `debugPrintEverything`）
2. 找出你要检查的东西在输出中的特征（特定的字符串、类型、结构）
3. 根据特征写出检查逻辑
4. 测试并优化

**Q: 检查规则写错了怎么办？**

A: 这很正常！
1. 添加 `console.log` 打印中间结果
2. 对比预期输出和实际输出
3. 调整逻辑
4. 重新运行测试

**Q: 我的检查规则有假阳性怎么办？**

A: 可能的原因：
1. 规则太宽松（例如用 `includes` 但它匹配了不相关的代码）
2. 没有考虑所有情况（例如注释中也包含关键字）
3. 没有正确理解ArkAnalyzer的表示方式

解决方法：
1. 使用更严格的匹配
2. 添加更多的过滤条件
3. 查看ArkAnalyzer的原始输出理解表示方式

---

## 📝 学习笔记模板

创建 `NOTES.md`，记录你的学习内容：

```markdown
# 我的学习笔记

## 今天学到的
- [ ] Scene的作用
- [ ] 如何获取方法体
- [ ] 语句和表达式的区别

## 实现的检查规则
- [x] 检查method call
- [ ] 检查变量赋值

## 遇到的问题
- 问题：xxx无法工作
  解决方案：yyy
  
## 待深入研究
- 数据流分析
- 类型推断
```

---

## 🎉 完成第一个项目的清单

- [ ] 理解了Scene/Method/Stmt的关系
- [ ] 能够写出简单的检查函数
- [ ] 能够调试和定位问题
- [ ] 实现了至少3个不同的检查规则
- [ ] 生成了分析报告
- [ ] 理解了输出结果的含义

完成以上所有项，恭喜你已经掌握了代码分析工具的核心！🚀

---

**下一步建议：**
1. 修改 `demo.ts` 添加更多测试代码
2. 添加新的检查规则
3. 实现输出到JSON或HTML
4. 开始你自己的项目！

祝你学习愉快！😊
