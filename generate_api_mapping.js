const XLSX = require('xlsx');
const fs = require('fs');

// 读取Excel文件
const workbook = XLSX.readFile('./modified_pandas_final.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 转换为JSON格式
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('生成完整的API映射表...');

// 创建函数名到系统功能的映射
const apiMapping = {};

// 遍历所有数据行（跳过表头）
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row && row[2] && row[5]) {  // 方法名（第3列，索引2）和SysCap（第6列，索引5）
    const methodName = row[2];
    const sysCap = row[5];
    
    // 只收集有效的API（排除一些明显不是API调用的）
    if (methodName && sysCap && 
        !methodName.includes(' ') && // 排除包含空格的
        !methodName.startsWith('(') && // 排除以括号开头的
        methodName.length > 1) { // 排除单字符的
      apiMapping[methodName] = sysCap;
    }
  }
}

console.log(`总共找到 ${Object.keys(apiMapping).length} 个API映射`);

// 生成TypeScript映射文件
const tsContent = `// 自动生成的API到SystemCapability映射表
// 基于 modified_pandas_final.xlsx

export const API_TO_SYSCAP: { [key: string]: string } = {
${Object.entries(apiMapping).map(([api, sysCap]) => `  "${api}": "${sysCap}",`).join('\n')}
};

// 常用的API分类
export const LOCATION_APIS = [
  'getCurrentLocation',
  'getLastLocation',
  'isLocationEnabled',
  'requestEnableLocation',
  'getAddressesFromLocation',
  'getAddressesFromLocationName',
  'isGeoServiceAvailable',
  'getCachedGnssLocationsSize',
  'flushCachedGnssLocations',
  'sendCommand',
  'getCountryCode',
  'enableLocationMock',
  'disableLocationMock',
  'setMockedLocations',
  'enableReverseGeocodingMock',
  'disableReverseGeocodingMock',
  'setReverseGeocodingMockInfo',
  'isLocationPrivacyConfirmed',
  'setLocationPrivacyConfirmStatus',
  'getLocatingRequiredData',
  'addGnssGeofence',
  'removeGnssGeofence',
  'getGeofenceSupportedCoordTypes',
  'getLocationIconStatus',
  'getCurrentWifiBssidForLocating',
  'getDistanceBetweenLocations',
  'isPoiServiceSupported',
  'getPoiInfo',
  'addBeaconFence',
  'removeBeaconFence',
  'isBeaconFenceSupported',
  'isWlanBssidMatched'
];

export const WEB_APIS = [
  'geolocation',
  'geolocationAccess',
  'onGeolocationHide',
  'onGeolocationShow',
  'allowGeolocation',
  'deleteGeolocation',
  'deleteAllGeolocation',
  'getAccessibleGeolocation',
  'getStoredGeolocation'
];

export const CAMERA_APIS = [
  'takePicture',
  'startRecording',
  'stopRecording',
  'setFlashMode',
  'setFocusMode'
];

// 获取API对应的SystemCapability
export function getSystemCapability(apiName: string): string | undefined {
  return API_TO_SYSCAP[apiName];
}

// 检查API是否需要特定的SystemCapability
export function needsSystemCapability(apiName: string, sysCap: string): boolean {
  const requiredSysCap = API_TO_SYSCAP[apiName];
  return requiredSysCap === sysCap;
}
`;

// 写入文件
fs.writeFileSync('./src/ApiMapping.ts', tsContent);

console.log('✅ API映射文件已生成: src/ApiMapping.ts');

// 显示一些统计信息
const sysCapCounts = {};
Object.values(apiMapping).forEach(sysCap => {
  sysCapCounts[sysCap] = (sysCapCounts[sysCap] || 0) + 1;
});

console.log('\n📊 SystemCapability统计（前10个）:');
Object.entries(sysCapCounts)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .forEach(([sysCap, count]) => {
    console.log(`  ${sysCap}: ${count} 个API`);
  });

console.log('\n🎯 常见的位置相关API:');
const locationApis = Object.entries(apiMapping)
  .filter(([api, sysCap]) => 
    sysCap.includes('Location') || 
    api.toLowerCase().includes('location') ||
    api.toLowerCase().includes('geo')
  )
  .slice(0, 10);

locationApis.forEach(([api, sysCap]) => {
  console.log(`  ${api} -> ${sysCap}`);
});
