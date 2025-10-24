// 错误示例：假设设备一定能获取到高精度位置
import geoLocationManager from '@ohos.geoLocationManager';

class Index {
  async checkIn() {
    try {
      // 直接请求高精度位置，在室内或无GPS模块的设备上可能长时间无返回或失败
      const location = await geoLocationManager.getCurrentLocation();
      console.log(`打卡成功，位置: ${location.latitude}, ${location.longitude}`);
    } catch (err) {
      console.error('获取位置失败: ' + JSON.stringify(err));
    }
  }

  build() {
    console.log('上班打卡');
  }
}

export default Index;
