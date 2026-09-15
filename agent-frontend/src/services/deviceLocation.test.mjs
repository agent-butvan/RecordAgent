import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCurrentCoordinates, DeviceLocationError } from './deviceLocation.ts';

test('设备定位返回适合配置保存的经纬度和精度', async () => {
  const geolocation = {
    getCurrentPosition(success) {
      success({ coords: { latitude: 31.86412349, longitude: 117.29098761, accuracy: 42.4 } });
    },
  };

  const result = await detectCurrentCoordinates(geolocation);

  assert.deepEqual(result, { latitude: 31.864123, longitude: 117.290988, accuracy: 42 });
});

test('用户拒绝定位时返回可恢复的中文提示', async () => {
  const geolocation = {
    getCurrentPosition(_success, error) {
      error({ code: 1 });
    },
  };

  await assert.rejects(detectCurrentCoordinates(geolocation), (error) => {
    assert.ok(error instanceof DeviceLocationError);
    assert.equal(error.reason, 'permission-denied');
    assert.match(error.message, /允许 Butvan Agent 使用位置/);
    return true;
  });
});
