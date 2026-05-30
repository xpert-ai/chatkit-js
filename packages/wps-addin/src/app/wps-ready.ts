import { readOptionalWpsApplication } from '../wps-api';

export type WpsReadyState = {
  host?: string;
  build?: string;
  version?: string;
  isWpsHost: boolean;
};

export async function waitForWpsReady(): Promise<WpsReadyState> {
  const application = readOptionalWpsApplication();
  if (!application) {
    return {
      isWpsHost: false,
    };
  }

  return {
    host: application.Name,
    build: application.Build,
    version: application.Version,
    isWpsHost: true,
  };
}
