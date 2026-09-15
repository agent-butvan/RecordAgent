export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type DeviceLocationFailureReason = 'unsupported' | 'permission-denied' | 'unavailable' | 'timeout' | 'unknown';

export class DeviceLocationError extends Error {
  readonly reason: DeviceLocationFailureReason;

  constructor(
    reason: DeviceLocationFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'DeviceLocationError';
    this.reason = reason;
  }
}

/** 请求一次前台设备定位；只有用户点击按钮后才会触发系统权限提示。 */
export function detectCurrentCoordinates(
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
): Promise<DeviceCoordinates> {
  if (!geolocation) {
    return Promise.reject(new DeviceLocationError('unsupported', '当前系统不支持自动定位，请手工填写经纬度。'));
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: roundCoordinate(coords.latitude),
        longitude: roundCoordinate(coords.longitude),
        accuracy: Math.round(coords.accuracy),
      }),
      (error) => reject(locationError(error.code)),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function locationError(code: number): DeviceLocationError {
  if (code === 1) {
    return new DeviceLocationError('permission-denied', '定位权限未开启，请允许 Butvan Agent 使用位置。');
  }
  if (code === 2) {
    return new DeviceLocationError('unavailable', '暂时无法取得当前位置，请检查系统定位服务或手工填写。');
  }
  if (code === 3) {
    return new DeviceLocationError('timeout', '定位请求超时，请重试或手工填写经纬度。');
  }
  return new DeviceLocationError('unknown', '自动定位失败，请重试或手工填写经纬度。');
}
