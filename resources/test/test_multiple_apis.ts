// 测试多个API调用的示例
import geoLocationManager from '@ohos.geoLocationManager';
import camera from '@ohos.multimedia.camera';

class TestMultipleAPIs {
  async testLocationAPIs() {
    // 正确的canIUse使用
    if (geoLocationManager.canIUse('SystemCapability.Location.Location.Core')) {
      try {
        const location = await geoLocationManager.getCurrentLocation();
        const lastLocation = await geoLocationManager.getLastLocation();
        console.log(`位置: ${location.latitude}, ${location.longitude}`);
      } catch (err) {
        console.error('获取位置失败: ' + JSON.stringify(err));
      }
    }
  }

  async testCameraAPIs() {
    // 错误的canIUse使用 - 参数不匹配
    if (camera.canIUse('SystemCapability.Wrong.Capability')) {
      try {
        const cameraManager = camera.getCameraManager();
        const cameras = await cameraManager.getSupportedCameras();
      } catch (err) {
        console.error('相机操作失败');
      }
    }
  }

  testWithoutCanIUse() {
    // 没有canIUse检查
    try {
      const enabled = geoLocationManager.isLocationEnabled();
      console.log('位置服务状态:', enabled);
    } catch (err) {
      console.error('检查位置服务失败');
    }
  }

  testWithoutTryCatch() {
    // 没有try-catch包裹
    if (geoLocationManager.canIUse('SystemCapability.Location.Location.Core')) {
      const location = geoLocationManager.getCurrentLocation(); // 危险：没有异常处理
    }
  }
}

export default TestMultipleAPIs;
