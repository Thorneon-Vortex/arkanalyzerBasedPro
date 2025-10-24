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
                    // 尝试多种方式获取位置信息
                    const exprStr = expr.toString();
                    const stmtStr = stmt.toString();
                    
                    // 调试信息：打印表达式和语句的字符串表示（可选）
                    // console.log(`[DEBUG] API: ${methodName}`);
                    // console.log(`[DEBUG] Expr: ${exprStr}`);
                    // console.log(`[DEBUG] Stmt: ${stmtStr}`);
                    
                    // 方法1: 从表达式字符串中提取行号
                    let lineMatch = exprStr.match(/:(\d+):/);
                    if (!lineMatch) {
                      lineMatch = stmtStr.match(/:(\d+):/);
                    }
                    if (lineMatch) {
                      lineNumber = parseInt(lineMatch[1]);
                      console.log(`[DEBUG] Found line number from string: ${lineNumber}`);
                    }
                    
                    // 方法2: 尝试从ArkAnalyzer的位置信息获取
                    if (!lineNumber && (expr as any).getLocation) {
                      try {
                        const location = (expr as any).getLocation();
                        if (location && location.getLineNumber) {
                          lineNumber = location.getLineNumber();
                        }
                      } catch (e) { /* ignore */ }
                    }
                    
                    // 方法3: 从语句中获取位置信息
                    if (!lineNumber && (stmt as any).getLocation) {
                      try {
                        const location = (stmt as any).getLocation();
                        if (location && location.getLineNumber) {
                          lineNumber = location.getLineNumber();
                        }
                      } catch (e) { /* ignore */ }
                    }
                    
                    // 从方法签名中提取文件名
                    const methodSigStr = methodSignature.toString();
                    const fileMatch = methodSigStr.match(/@([^:]+):/);
                    if (fileMatch) {
                      fileName = fileMatch[1];
                    }
                    
                    // 如果还是没有行号，尝试从字符串中解析更多格式
                    if (!lineNumber) {
                      // 尝试匹配 @filename:line:column 格式
                      const locationMatch = methodSigStr.match(/@[^:]+:(\d+):/);
                      if (locationMatch) {
                        lineNumber = parseInt(locationMatch[1]);
                      }
                    }
                    
                    // 如果ArkAnalyzer无法提供行号，尝试从源代码中查找
                    if (!lineNumber && fileName) {
                      const extractedMethodName = this.extractMethodName(methodSignature.toString());
                      lineNumber = this.findApiLineNumber(fileName, methodName, extractedMethodName);
                      // 成功从源代码中找到行号
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
   * 从源文件中查找API调用的行号
   */
  private findApiLineNumber(fileName: string, apiName: string, methodName: string): number | undefined {
    try {
      // 构建文件路径
      const configPath = path.join(__dirname, '../resources/arkanalyzer_config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const projectDir = path.resolve(__dirname, '..', config.targetProjectDirectory);
      const filePath = path.join(projectDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return undefined;
      }
      
      const sourceCode = fs.readFileSync(filePath, 'utf8');
      const lines = sourceCode.split('\n');
      
      // 查找包含API调用的行
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 检查这一行是否包含API调用
        if (line.includes(apiName) && line.includes('(')) {
          // 进一步验证这是一个方法调用而不是注释或字符串
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('*')) {
            // 检查是否在正确的方法内（简单的启发式方法）
            // 向上查找方法定义
            for (let j = i; j >= 0; j--) {
              const prevLine = lines[j].trim();
              if (prevLine.includes(methodName) && prevLine.includes('(')) {
                return i + 1; // 行号从1开始
              }
              // 如果遇到另一个方法定义，停止查找
              if (j < i && (prevLine.includes('async ') || prevLine.includes('function ') || 
                  (prevLine.includes('(') && prevLine.includes(')') && prevLine.includes('{')))) {
                break;
              }
            }
            // 如果没找到明确的方法边界，返回当前行
            return i + 1;
          }
        }
      }
      
      return undefined;
    } catch (error) {
      // 无法从源代码中获取行号
      return undefined;
    }
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
