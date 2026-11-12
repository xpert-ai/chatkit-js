import type {
  AssistantComposerInsertPayload,
  RuntimeCapabilitiesResponse,
} from '@xpert-ai/xpert-sdk';
import type { ComposerValuePayload } from '../lib/references';

export function parseComposerInsert(
  value: unknown,
): AssistantComposerInsertPayload {
  if (
    !value ||
    typeof value !== 'object' ||
    !('text' in value) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.length > 32000
  )
    throw new Error('COMPOSER_INVALID_TEXT');
  const result: AssistantComposerInsertPayload = { text: value.text };
  if ('skillNames' in value) {
    if (
      !Array.isArray(value.skillNames) ||
      value.skillNames.length > 12 ||
      !value.skillNames.every(
        (name) =>
          typeof name === 'string' && name.length > 0 && name.length <= 160,
      )
    )
      throw new Error('COMPOSER_INVALID_SKILLS');
    result.skillNames = [...new Set(value.skillNames)];
  }
  if ('workspaceFiles' in value) {
    if (
      !Array.isArray(value.workspaceFiles) ||
      value.workspaceFiles.length > 20
    )
      throw new Error('COMPOSER_INVALID_FILES');
    result.workspaceFiles = value.workspaceFiles.map((file) => {
      if (
        !file ||
        typeof file !== 'object' ||
        typeof file.path !== 'string' ||
        !file.path.startsWith('/workspace/') ||
        file.path
          .split('/')
          .some((part: string) => part === '..' || part === '.') ||
        /[\\\x00-\x1f]/.test(file.path) ||
        typeof file.name !== 'string' ||
        !file.name.trim()
      )
        throw new Error('COMPOSER_INVALID_FILE');
      if (
        (file.mimeType !== undefined && typeof file.mimeType !== 'string') ||
        (file.size !== undefined &&
          (typeof file.size !== 'number' ||
            !Number.isSafeInteger(file.size) ||
            file.size < 0))
      )
        throw new Error('COMPOSER_INVALID_FILE');
      return {
        path: file.path,
        name: file.name,
        ...(file.mimeType ? { mimeType: file.mimeType } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
      };
    });
  }
  return result;
}
export function composerInsertPayload(
  input: AssistantComposerInsertPayload,
  catalog?: RuntimeCapabilitiesResponse,
): ComposerValuePayload {
  const skills = (input.skillNames ?? []).map((name) => {
    // Labels are the skill names returned by this public SDK catalog. Never guess IDs.
    const matches =
      catalog?.skills.filter((skill) => skill.label === name) ?? [];
    if (matches.length !== 1)
      throw new Error(`COMPOSER_SKILL_UNAVAILABLE: ${name}`);
    return matches[0];
  });
  if (new Set(skills.map((skill) => skill.workspaceId)).size > 1)
    throw new Error('COMPOSER_SKILL_SCOPE_MISMATCH');
  return {
    text: input.text,
    appendText: true,
    workspaceFiles: input.workspaceFiles,
    ...(skills.length
      ? {
          insertRuntimeCapabilities: true,
          runtimeCapabilities: {
            mode: 'allowlist',
            inheritUnselected: true,
            skills: {
              workspaceId: skills[0].workspaceId,
              ids: skills.map((skill) => skill.id),
            },
            plugins: { nodeKeys: [] },
          },
        }
      : {}),
  };
}
