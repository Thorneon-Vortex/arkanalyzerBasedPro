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
import { API_TO_SYSCAP, getSystemCapability } from './ApiMapping';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'LocationAPIAnalyzer');
Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.INFO, false);

interface ApiCallInfo {
  methodName: string;
  requiredSysCap: string;
  hasCanIUse: boolean;
  hasCorrectCanIUse: boolean;
  isTryCatchWrapped: boolean;
  foundInMethod: string; // 记录在哪个方法中找到的
  lineNumber?: number; // API调用的行号
  fileName?: string; // 文件名
}

interface AnalysisResult {
  apiCalls: ApiCallInfo[];
  recommendations: string[];
  summary: {
    totalApiCalls: number;
    apisWithCanIUse: number;
    apisWithCorrectCanIUse: number;
    apisWithTryCatch: number;
  };
}

// 输出文件路径
const OUTPUT_FILE = path.join(__dirname, '../info.txt');
let outputBuffer: string[] = [];

// 自定义console.log，同时输出到控制台和文件
function logToFile(message: string = ''): void {
  console.log(message);
  outputBuffer.push(message);
}

export class UniversalAPIAnalyzer {
  private scene: Scene | null = null;
  private results: AnalysisResult = {
    apiCalls: [],
    recommendations: [],
    summary: {
      totalApiCalls: 0,
      apisWithCanIUse: 0,
      apisWithCorrectCanIUse: 0,
      apisWithTryCatch: 0
    }
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
   * 获取代码中所有的canIUse调用及其参数
   */
  private getCanIUseCalls(scene: Scene): Set<string> {
    const canIUseCalls = new Set<string>();
    const methods = scene.getMethods();
    
    for (const method of methods) {
      const body = method.getBody();
      if (!body) continue;

      const cfg = body.getCfg();
      const stmts = cfg.getStmts();

      for (const stmt of stmts) {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
          if ((expr instanceof ArkStaticInvokeExpr || expr instanceof ArkInstanceInvokeExpr)) {
            try {
              const methodSig = (expr as any).getMethodSignature();
              if (methodSig && methodSig.getMethodSubSignature) {
                const methodName = methodSig.getMethodSubSignature().getMethodName();
                if (methodName === 'canIUse') {
                  // 获取canIUse的参数
                  const args = (expr as any).getArgs();
                  for (const arg of args) {
                    const argStr = arg.toString();
                    // 提取SystemCapability字符串
                    const match = argStr.match(/SystemCapability\.[A-Za-z0-9.]+/);
                    if (match) {
                      canIUseCalls.add(match[0]);
                    }
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
    }
    
    return canIUseCalls;
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
   * 按方法分析API调用
   */
  private analyzeApiCallsByMethod(scene: Scene): ApiCallInfo[] {
    const apiCallInfos: ApiCallInfo[] = [];
    const methods = scene.getMethods();
    
    // 定义不需要检查的基础方法（JavaScript/TypeScript内置方法 + 系统能力检查方法）
    const excludedMethods = new Set([
      // JavaScript/TypeScript内置方法
      'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
      'toLocaleString', 'constructor', 'length', 'concat', 'join', 'pop', 'push',
      'reverse', 'shift', 'slice', 'sort', 'splice', 'unshift', 'indexOf', 'lastIndexOf',
      'every', 'some', 'forEach', 'map', 'filter', 'reduce', 'reduceRight',
      'charAt', 'charCodeAt', 'fromCharCode', 'indexOf', 'lastIndexOf', 'localeCompare',
      'match', 'replace', 'search', 'slice', 'split', 'substr', 'substring',
      'toLowerCase', 'toUpperCase', 'trim', 'trimLeft', 'trimRight',
      'log', 'info', 'warn', 'error', 'debug', 'trace', 'assert', 'clear',
      'count', 'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd', 'profile',
      'profileEnd', 'table', 'time', 'timeEnd', 'timeStamp',
      'parse', 'stringify', 'keys', 'values', 'entries', 'assign', 'create',
      'defineProperty', 'defineProperties', 'freeze', 'seal', 'preventExtensions',
      'isExtensible', 'isFrozen', 'isSealed', 'getOwnPropertyDescriptor',
      'getOwnPropertyNames', 'getOwnPropertySymbols', 'getPrototypeOf', 'setPrototypeOf',
      'call', 'apply', 'bind', 'then', 'catch', 'finally', 'resolve', 'reject',
      'all', 'race', 'allSettled', 'any'
    ]);
    
    for (const method of methods) {
      const body = method.getBody();
      if (!body) continue;

      const cfg = body.getCfg();
      const stmts = cfg.getStmts();
      const methodSignature = method.getSignature();

      // 在当前方法中收集API调用、canIUse调用和try-catch信息
      const methodApiCalls: string[] = [];
      const methodCanIUseCalls = new Set<string>();
      let methodHasTryCatch = false;

      for (const stmt of stmts) {
        const exprs = stmt.getExprs();
        const stmtStr = stmt.toString();
        
        // 检查try-catch
        if (stmtStr.includes('caughtexception') || stmtStr.includes('caught') || stmtStr.includes('throw')) {
          methodHasTryCatch = true;
        }

        for (const expr of exprs) {
          if (expr instanceof ArkStaticInvokeExpr || expr instanceof ArkInstanceInvokeExpr) {
            try {
              const methodSig = (expr as any).getMethodSignature();
              if (methodSig && methodSig.getMethodSubSignature) {
                const methodName = methodSig.getMethodSubSignature().getMethodName();
                
                // 跳过基础方法
                if (excludedMethods.has(methodName)) {
                  continue;
                }
                
                // 检查canIUse调用（不受排除列表影响）
                if (methodName === 'canIUse') {
                  const args = (expr as any).getArgs();
                  for (const arg of args) {
                    const argStr = arg.toString();
                    const match = argStr.match(/SystemCapability\.[A-Za-z0-9.]+/);
                    if (match) {
                      methodCanIUseCalls.add(match[0]);
                    }
                  }
                  continue; // 跳过后续的API检查逻辑
                }
                
                // 检查是否是已知的API调用
                if (getSystemCapability(methodName)) {
                  methodApiCalls.push(methodName);
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      // 为当前方法中的每个API调用创建分析结果（包含行号信息）
      const apiCallsWithLocation: Array<{api: string, lineNumber?: number, fileName?: string}> = [];
      
      // 重新遍历获取行号信息
      for (const stmt of stmts) {
        const exprs = stmt.getExprs();
        for (const expr of exprs) {
          if (expr instanceof ArkStaticInvokeExpr || expr instanceof ArkInstanceInvokeExpr) {
            try {
              const methodSig = (expr as any).getMethodSignature();
              if (methodSig && methodSig.getMethodSubSignature) {
                const methodName = methodSig.getMethodSubSignature().getMethodName();
                
                // 检查canIUse调用（不受排除列表影响，但不作为API调用记录）
                if (methodName === 'canIUse') {
                  continue; // canIUse不作为需要检查的API
                }
                
                // 跳过基础方法
                if (excludedMethods.has(methodName)) {
                  continue;
                }
                
                if (getSystemCapability(methodName)) {
                  // 尝试获取行号信息
                  let lineNumber: number | undefined;
                  let fileName: string | undefined;
                  
                  try {
                    // 从表达式中获取位置信息
                    const exprStr = expr.toString();
                    const stmtStr = stmt.toString();
                    
                    // 从方法签名中提取文件名
                    const methodSigStr = methodSignature.toString();
                    const fileMatch = methodSigStr.match(/@([^:]+):/);
                    if (fileMatch) {
                      fileName = fileMatch[1];
                    }
                  } catch (e) {
                    // 无法获取位置信息时继续
                  }
                  
                  apiCallsWithLocation.push({
                    api: methodName,
                    lineNumber: lineNumber,
                    fileName: fileName
                  });
                }
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      // 去重并创建分析结果
      const uniqueApiCalls = [...new Set(apiCallsWithLocation.map(item => item.api))];
      for (const apiName of uniqueApiCalls) {
        const requiredSysCap = getSystemCapability(apiName)!;
        const hasCanIUse = methodCanIUseCalls.size > 0;
        const hasCorrectCanIUse = methodCanIUseCalls.has(requiredSysCap);
        
        // 获取该API的位置信息
        const apiLocation = apiCallsWithLocation.find(item => item.api === apiName);

        apiCallInfos.push({
          methodName: apiName,
          requiredSysCap: requiredSysCap,
          hasCanIUse: hasCanIUse,
          hasCorrectCanIUse: hasCorrectCanIUse,
          isTryCatchWrapped: methodHasTryCatch,
          foundInMethod: methodSignature.toString(),
          lineNumber: apiLocation?.lineNumber,
          fileName: apiLocation?.fileName
        });
      }
    }
    
    return apiCallInfos;
  }

  /**
   * 执行分析
   */
  public analyze(configPath: string): AnalysisResult {
    logToFile('\n========== 通用API安全性分析 开始 ==========\n');
    
    try {
      this.scene = this.buildScene(configPath);
      
      // 按方法分析API调用
      const apiCallInfos = this.analyzeApiCallsByMethod(this.scene);
      
      if (apiCallInfos.length === 0) {
        logToFile('✓ 未发现需要检查的API调用');
        logToFile('\n========== 分析结束 ==========\n');
        return this.results;
      }

      // 去重API名称用于显示
      const uniqueApiNames = [...new Set(apiCallInfos.map(info => info.methodName))];
      logToFile(`发现 ${uniqueApiNames.length} 个不同的API调用需要检查:`);
      uniqueApiNames.forEach(api => {
        logToFile(`  - ${api}`);
      });
      logToFile('');

      this.results.apiCalls = apiCallInfos;

      // 按API分组显示结果
      const apiGroups = new Map<string, ApiCallInfo[]>();
      for (const apiInfo of apiCallInfos) {
        if (!apiGroups.has(apiInfo.methodName)) {
          apiGroups.set(apiInfo.methodName, []);
        }
        apiGroups.get(apiInfo.methodName)!.push(apiInfo);
      }

      // 分类处理问题
      const missingCanIUse: ApiCallInfo[] = [];
      const severeIssues: ApiCallInfo[] = [];
      const goodPractices: ApiCallInfo[] = [];

      for (const apiInfo of apiCallInfos) {
        if (!apiInfo.hasCorrectCanIUse && !apiInfo.isTryCatchWrapped) {
          severeIssues.push(apiInfo);
        } else if (!apiInfo.hasCorrectCanIUse) {
          missingCanIUse.push(apiInfo);
        } else {
          goodPractices.push(apiInfo);
        }
      }

      // 输出严重问题
      if (severeIssues.length > 0) {
        logToFile('🚨 严重警告 - 可能出现多端错误:');
        for (const apiInfo of severeIssues) {
          const fileName = apiInfo.fileName || '未知文件';
          const methodName = this.extractMethodName(apiInfo.foundInMethod);
          const location = apiInfo.lineNumber ? `第${apiInfo.lineNumber}行` : '位置未知';
          
          logToFile(`   ❌ ${fileName}: ${apiInfo.methodName}() 在方法 ${methodName} (${location})`);
          logToFile(`      缺少 canIUse("${apiInfo.requiredSysCap}") 且缺少 try-catch`);
          
          this.results.recommendations.push(`严重警告: ${fileName}中${methodName}方法的${apiInfo.methodName}()缺少canIUse和try-catch`);
        }
        logToFile('');
      }

      // 输出缺少canIUse的问题
      if (missingCanIUse.length > 0) {
        logToFile('⚠️  缺少canIUse检查:');
        for (const apiInfo of missingCanIUse) {
          const fileName = apiInfo.fileName || '未知文件';
          const methodName = this.extractMethodName(apiInfo.foundInMethod);
          const location = apiInfo.lineNumber ? `第${apiInfo.lineNumber}行` : '位置未知';
          
          logToFile(`   ⚠️  ${fileName}: ${apiInfo.methodName}() 在方法 ${methodName} (${location})`);
          logToFile(`      建议添加 canIUse("${apiInfo.requiredSysCap}")`);
          
          this.results.recommendations.push(`建议: ${fileName}中${methodName}方法的${apiInfo.methodName}()添加canIUse检查`);
        }
        logToFile('');
      }

      // 输出良好实践
      if (goodPractices.length > 0) {
        logToFile('✅ 正确使用的API:');
        const groupedGood = new Map<string, ApiCallInfo[]>();
        for (const apiInfo of goodPractices) {
          const key = `${apiInfo.fileName || '未知文件'}-${apiInfo.methodName}`;
          if (!groupedGood.has(key)) {
            groupedGood.set(key, []);
          }
          groupedGood.get(key)!.push(apiInfo);
        }

        for (const [key, apiInfos] of groupedGood) {
          const apiInfo = apiInfos[0];
          const fileName = apiInfo.fileName || '未知文件';
          const methodName = this.extractMethodName(apiInfo.foundInMethod);
          
          logToFile(`   ✅ ${fileName}: ${apiInfo.methodName}() 在方法 ${methodName} - 使用规范`);
        }
        logToFile('');
      }

      // 更新统计信息
      this.results.summary.totalApiCalls = uniqueApiNames.length;
      this.results.summary.apisWithCanIUse = apiCallInfos.filter(api => api.hasCanIUse).length;
      this.results.summary.apisWithCorrectCanIUse = apiCallInfos.filter(api => api.hasCorrectCanIUse).length;
      this.results.summary.apisWithTryCatch = apiCallInfos.filter(api => api.isTryCatchWrapped).length;

    } catch (error) {
      logToFile('分析过程中出错: ' + error);
      this.results.recommendations.push('分析异常');
    }

    // 输出总结
    logToFile('========== 分析结果总结 ==========');
    logToFile(`总API调用数: ${this.results.summary.totalApiCalls}`);
    logToFile(`API调用实例数: ${this.results.apiCalls.length}`);
    logToFile(`使用canIUse的实例数: ${this.results.summary.apisWithCanIUse}`);
    logToFile(`正确使用canIUse的实例数: ${this.results.summary.apisWithCorrectCanIUse}`);
    logToFile(`使用try-catch的实例数: ${this.results.summary.apisWithTryCatch}`);
    
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
   * 提取方法名（从完整签名中）
   */
  private extractMethodName(methodSignature: string): string {
    // 从 "@demo/demo.ts: Index.checkIn()" 中提取 "checkIn"
    const match = methodSignature.match(/\.([^.()]+)\([^)]*\)$/);
    if (match) {
      return match[1];
    }
    
    // 如果匹配失败，尝试简单的分割
    const parts = methodSignature.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/\([^)]*\)$/, '');
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
    logToFile(`\n 分析结果已保存到: ${OUTPUT_FILE}`);
  }
}

// 执行分析
const analyzer = new UniversalAPIAnalyzer();
const configPath = './resources/arkanalyzer_config.json';
const result = analyzer.analyze(configPath);
analyzer.saveToFile();
