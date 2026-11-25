import { HTTPError } from '@xpert-ai/xpert-sdk';
import type { TFunction } from 'i18next';
import { z } from 'zod';

const uploadErrorResponse = z.object({
  code: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

export function attachmentErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof HTTPError) {
    try {
      const result = uploadErrorResponse.safeParse(JSON.parse(error.text));
      if (result.success) {
        const { code, message } = result.data;
        const text = Array.isArray(message) ? message.join('；') : message;
        if (
          code === 'application_storage_limit' ||
          text === 'APP_PLATFORM_FAILURE:application_storage_limit'
        ) {
          return t('chat.attachmentError.storageFull');
        }
        if (text?.trim()) return text;
      }
    } catch {
      // Proxies may return an HTML page; never render that response as an error.
    }
    return t('chat.attachmentError.http', { status: error.status });
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : t('chat.attachmentError.uploadFailed');
}
