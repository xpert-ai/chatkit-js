export type OfficeReadyState = {
  host?: Office.HostType;
  platform?: Office.PlatformType;
  isOfficeHost: boolean;
};

export async function waitForOfficeReady(): Promise<OfficeReadyState> {
  if (!globalThis.Office?.onReady) {
    return {
      isOfficeHost: false,
    };
  }

  const info = await Office.onReady();
  return {
    host: info.host,
    platform: info.platform,
    isOfficeHost: true,
  };
}
