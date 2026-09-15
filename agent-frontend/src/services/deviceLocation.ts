export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** 请求一次前台设备定位；只有用户点击按钮后才会触发系统权限提示。 */
export function detectCurrentCoordinates(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): Promise<DeviceCoordinates> {
  if (!geolocation) return Promise.reject(new Error('当前系统不支持自动定位，请手工填写经纬度。'));

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: roundCoordinate(coords.latitude),
        longitude: roundCoordinate(coords.longitude),
        accuracy: Math.round(coords.accuracy),
      }),
      (error) => reject(new Error(locationErrorMessage(error.code))),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function locationErrorMessage(code: number): string {
  if (code === 1) return '定位权限未开启，请在系统设置中允许 ButvanAgent 使用位置。';
  if (code === 2) return '暂时无法取得当前位置，请检查系统定位服务或手工填写。';
  if (code === 3) return '定位请求超时，请重试或手工填写经纬度。';
  return '自动定位失败，请重试或手工填写经纬度。';
}
