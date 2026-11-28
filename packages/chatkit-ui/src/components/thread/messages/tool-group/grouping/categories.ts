import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { resolveLocalizedText } from '../../../../../i18n/localized-text';
import { getToolStepData } from '../status/step-status';
import type { StepStatus } from '../types';

export function normalizeToolToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return normalized || null;
}

export function getToolActivityLabel(
  content: TMessageContentComponent,
  language: string,
  _status?: StepStatus,
) {
  const data = getToolStepData(content);
  const title = resolveLocalizedText(data.title, language);
  const message = resolveLocalizedText(data.message, language);
  const tool = resolveLocalizedText(data.tool, language);
  if (title && title !== tool) return title;
  if (message && message !== tool) return message;
  return language.startsWith('zh') ? '工具调用' : 'Tool call';
}
