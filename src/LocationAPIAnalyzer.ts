/*
 * 位置API安全性分析工具
 * 功能：检查是否正确使用了 getCurrentLocation() API
 * 检查项：
 * 1. 是否调用了 getCurrentLocation()
 * 2. 是否使用了 canIUse('SystemCapability.Location.Location.Core')
 * 3. 是否在 try-catch 中包裹了调用
 */

import { SceneConfig, Scene, ArkStaticInvokeExpr, ArkInstanceInvokeExpr, Logger, LOG_LEVEL, LOG_MODULE_TYPE, DEFAULT_ARK_METHOD_NAME } from 'arkanalyzer';
import * as fs from 'fs';
import * as path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'LocationAPIAnalyzer');
Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.INFO, false);

interface AnalysisResult {
  hasGetCurrentLocationCall: boolean;
  hasCanIUseCheck: boolean;
  isTryCatchWrapped: boolean;
  recommendations: string[];
}

// 输出文件路径
const OUTPUT_FILE = path.join(__dirname, '../info.txt');
let outputBuffer: string[] = [];

// 自定义console.log，同时输出到控制台和文件
function logToFile(message: string = ''): void {
  console.log(message);
  outputBuffer.push(message);
}

export class LocationAPIAnalyzer {
  private scene: Scene | null = null;
  private results: AnalysisResult = {
    hasGetCurrentLocationCall: false,
    hasCanIUseCheck: false,
    isTryCatchWrapped: false,
    recommendations: []
  };

  /**
   * 构建Scene对象
   */
  public buildScene(configPath: string): Scene {
    let config: SceneConfig = new SceneConfig();
    config.buildFromJson(configPath);
    let scene: Scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    return scene;
  }

  /**
   * 检查是否使用了 canIUse
   */
  private checkCanIUse(scene: Scene): boolean {
    const methods = scene.getMethods();
    
    for (const method of methods) {
      const body = method.getBody();
      if (!body) continue;

      const cfg = body.getCfg();
      const stmts = cfg.getStmts();

      for (const stmt of stmts) {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
          // 检查是否调用了 canIUse
          if ((expr instanceof ArkStaticInvokeExpr || expr instanceof ArkInstanceInvokeExpr)) {
            try {
              const methodSig = (expr as any).getMethodSignature();
              if (methodSig && methodSig.getMethodSubSignature) {
                const methodName = methodSig.getMethodSubSignature().getMethodName();
                if (methodName === 'canIUse') {
                  // 检查参数是否包含 'SystemCapability.Location.Location.Core'
                  const args = (expr as any).getArgs();
                  for (const arg of args) {
                    const argStr = arg.toString();
                    if (argStr.includes('SystemCapability.Location.Location.Core')) {
                      return true;
                    }
                  }
                }
              }
            } catch (e) {
              // 继续检查其他表达式
              continue;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * 检查 getCurrentLocation 调用是否在 try-catch 中
   */
  private checkTryCatchWrapping(scene: Scene): boolean {
    const methods = scene.getMethods();
    let foundTryCatch = false;
    
    for (const method of methods) {
      const body = method.getBody();
      if (!body) continue;

      const cfg = body.getCfg();
      const stmts = cfg.getStmts();

      for (const stmt of stmts) {
        const stmtType = stmt.constructor.name;
        const stmtStr = stmt.toString();
        
        // ArkAnalyzer 中的 try-catch 相关语句
        // 1. 检查语句类型（可能包含Try、Catch、TryCatch等）
        if (stmtType.includes('Catch') || stmtType.includes('Try') || 
            stmtType.includes('TryCatch') || stmtType.includes('Throw')) {
          foundTryCatch = true;
          break;
        }

        // 2. 检查语句字符串中的关键字
        // ArkAnalyzer 会将异常处理表示为 "caughtexception" 
        if (stmtStr.includes('caughtexception') || stmtStr.includes('caught')) {
          foundTryCatch = true;
          break;
        }
        
        // 3. 检查throw语句
        if (stmtStr.includes('throw')) {
          foundTryCatch = true;
          break;
        }
      }
      
      if (foundTryCatch) {
        break;
      }
    }
    
    return foundTryCatch;
  }

  /**
   * 检查是否有 getCurrentLocation 调用
   */
  private checkGetCurrentLocationCall(scene: Scene): boolean {
    const methods = scene.getMethods();
    
    for (const method of methods) {
      const body = method.getBody();
      if (!body) continue;

      const cfg = body.getCfg();
      const stmts = cfg.getStmts();

      for (const stmt of stmts) {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
          if (expr instanceof ArkStaticInvokeExpr || expr instanceof ArkInstanceInvokeExpr) {
            try {
              const methodSig = (expr as any).getMethodSignature();
              if (methodSig && methodSig.getMethodSubSignature) {
                const methodName = methodSig.getMethodSubSignature().getMethodName();
                // 检查是否是 getCurrentLocation 调用
                if (methodName === 'getCurrentLocation') {
                  return true;
                }
              }
            } catch (e) {
              // 继续检查其他表达式
              continue;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * 执行分析
   */
  public analyze(configPath: string): AnalysisResult {
    logToFile('\n========== 位置API安全性分析 开始 ==========\n');
    
    try {
      this.scene = this.buildScene(configPath);
      
      // 执行检查
      this.results.hasGetCurrentLocationCall = this.checkGetCurrentLocationCall(this.scene);
      
      if (!this.results.hasGetCurrentLocationCall) {
        logToFile('✓ 未发现 getCurrentLocation() 调用');
        logToFile('\n========== 分析结束 ==========\n');
        return this.results;
      }

      logToFile('✗ 发现 getCurrentLocation() 调用');
      
      // 检查 canIUse
      this.results.hasCanIUseCheck = this.checkCanIUse(this.scene);
      if (!this.results.hasCanIUseCheck) {
        logToFile('✗ 【建议】 未检测到 canIUse("SystemCapability.Location.Location.Core") 调用');
        this.results.recommendations.push('建议使用canIUse');
      } else {
        logToFile('✓ 检测到 canIUse 调用');
      }

      // 检查 try-catch
      this.results.isTryCatchWrapped = this.checkTryCatchWrapping(this.scene);
      if (!this.results.isTryCatchWrapped) {
        logToFile('✗ 【严重】 getCurrentLocation() 调用未在 try-catch 中包裹');
        this.results.recommendations.push('该项目在多端中严重不安全');
      } else {
        logToFile('✓ getCurrentLocation() 调用已在 try-catch 中包裹');
      }

    } catch (error) {
      logToFile('分析过程中出错: ' + error);
      this.results.recommendations.push('分析异常');
    }

    logToFile('\n========== 分析结果总结 ==========');
    logToFile(`1. 是否有 getCurrentLocation() 调用: ${this.results.hasGetCurrentLocationCall ? '是' : '否'}`);
    if (this.results.hasGetCurrentLocationCall) {
      logToFile(`2. 是否使用了 canIUse 检查: ${this.results.hasCanIUseCheck ? '是' : '否'}`);
      logToFile(`3. 是否在 try-catch 中包裹: ${this.results.isTryCatchWrapped ? '是' : '否'}`);
    }
    
    if (this.results.recommendations.length > 0) {
      logToFile('\n【建议】:');
      this.results.recommendations.forEach(rec => {
        logToFile(`  - ${rec}`);
      });
    }

    logToFile('\n========== 分析结束 ==========\n');
    
    return this.results;
  }

  /**
   * 获取分析结果
   */
  public getResults(): AnalysisResult {
    return this.results;
  }

  /**
   * 保存输出到文件
   */
  public saveToFile(): void {
    const outputContent = outputBuffer.join('\n');
    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
    logToFile(`\n✅ 分析结果已保存到: ${OUTPUT_FILE}`);
  }
}

// 执行分析
const analyzer = new LocationAPIAnalyzer();
const configPath = './resources/arkanalyzer_config.json';
const result = analyzer.analyze(configPath);
analyzer.saveToFile();
