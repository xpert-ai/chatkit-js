import type {
  XpertRemoteViewHostEventMessage,
  XpertViewActionRequest,
  XpertViewFileAccessPurpose,
  XpertViewParameterOptionsQuery,
  XpertViewQuery,
  XpertViewScalar,
} from '@xpert-ai/xpert-sdk';

export const REMOTE_COMPONENT_CHANNEL = 'xpertai.remote_component';
export const REMOTE_COMPONENT_PROTOCOL_VERSION = 1;

export interface RemoteComponentMessage {
  channel: typeof REMOTE_COMPONENT_CHANNEL;
  protocolVersion: typeof REMOTE_COMPONENT_PROTOCOL_VERSION;
  instanceId?: string | null;
  type: string;
  requestId?: string;
  query?: unknown;
  parameterKey?: unknown;
  search?: unknown;
  parameters?: unknown;
  actionKey?: unknown;
  targetId?: unknown;
  input?: unknown;
  file?: unknown;
  fileKey?: unknown;
  purpose?: unknown;
  commandKey?: unknown;
  payload?: unknown;
  height?: unknown;
  viewportBound?: unknown;
  level?: unknown;
  message?: unknown;
}

export type RemoteFilePayload = {
  name?: string;
  type?: string;
  size?: number;
  buffer: ArrayBuffer;
};

export function parseRemoteComponentMessage(
  value: unknown,
): RemoteComponentMessage | null {
  if (!isObject(value)) return null;
  if (Reflect.get(value, 'channel') !== REMOTE_COMPONENT_CHANNEL) return null;
  if (
    Reflect.get(value, 'protocolVersion') !== REMOTE_COMPONENT_PROTOCOL_VERSION
  ) {
    return null;
  }
  const type = Reflect.get(value, 'type');
  if (typeof type !== 'string' || !type.trim()) return null;

  return {
    channel: REMOTE_COMPONENT_CHANNEL,
    protocolVersion: REMOTE_COMPONENT_PROTOCOL_VERSION,
    type,
    instanceId: readNullableString(value, 'instanceId'),
    requestId: readString(value, 'requestId'),
    query: Reflect.get(value, 'query'),
    parameterKey: Reflect.get(value, 'parameterKey'),
    search: Reflect.get(value, 'search'),
    parameters: Reflect.get(value, 'parameters'),
    actionKey: Reflect.get(value, 'actionKey'),
    targetId: Reflect.get(value, 'targetId'),
    input: Reflect.get(value, 'input'),
    file: Reflect.get(value, 'file'),
    fileKey: Reflect.get(value, 'fileKey'),
    purpose: Reflect.get(value, 'purpose'),
    commandKey: Reflect.get(value, 'commandKey'),
    payload: Reflect.get(value, 'payload'),
    height: Reflect.get(value, 'height'),
    viewportBound: Reflect.get(value, 'viewportBound'),
    level: Reflect.get(value, 'level'),
    message: Reflect.get(value, 'message'),
  };
}

export function parseViewQuery(value: unknown): XpertViewQuery {
  if (!isObject(value)) return {};

  const page = readPositiveInteger(value, 'page');
  const pageSize = readPositiveInteger(value, 'pageSize');
  const cursor = readString(value, 'cursor');
  const search = readString(value, 'search');
  const sortBy = readString(value, 'sortBy');
  const sortDirectionValue = Reflect.get(value, 'sortDirection');
  const selectionId = readString(value, 'selectionId');
  const filtersValue = Reflect.get(value, 'filters');
  const parametersValue = Reflect.get(value, 'parameters');

  return {
    ...(page ? { page } : {}),
    ...(pageSize ? { pageSize } : {}),
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(sortBy ? { sortBy } : {}),
    ...(sortDirectionValue === 'asc' || sortDirectionValue === 'desc'
      ? { sortDirection: sortDirectionValue }
      : {}),
    ...(selectionId ? { selectionId } : {}),
    ...(Array.isArray(filtersValue)
      ? {
          filters: filtersValue.flatMap((item) => {
            if (!isObject(item)) return [];
            const key = readString(item, 'key');
            const value = readScalarOrArray(Reflect.get(item, 'value'));
            if (!key || value === undefined) return [];
            const operator = readFilterOperator(Reflect.get(item, 'operator'));
            return [{ key, value, ...(operator ? { operator } : {}) }];
          }),
        }
      : {}),
    ...(isObject(parametersValue)
      ? { parameters: copyScalarParameters(parametersValue) }
      : {}),
  };
}

export function parseParameterOptionsQuery(
  message: RemoteComponentMessage,
): XpertViewParameterOptionsQuery {
  const query = isObject(message.query) ? message.query : null;
  const search =
    (query ? readString(query, 'search') : undefined) ??
    (typeof message.search === 'string' ? message.search : undefined);
  const parameters =
    (query && isObject(Reflect.get(query, 'parameters'))
      ? copyScalarParameters(Reflect.get(query, 'parameters') as object)
      : undefined) ??
    (isObject(message.parameters)
      ? copyScalarParameters(message.parameters)
      : undefined);

  return {
    ...(search ? { search } : {}),
    ...(parameters && Object.keys(parameters).length > 0 ? { parameters } : {}),
  };
}

export function parseActionRequest(
  message: RemoteComponentMessage,
): XpertViewActionRequest {
  return {
    ...(typeof message.targetId === 'string' && message.targetId.trim()
      ? { targetId: message.targetId.trim() }
      : {}),
    ...(message.input === null
      ? { input: null }
      : isObject(message.input)
        ? { input: copyObject(message.input) }
        : {}),
    ...(isObject(message.parameters)
      ? { parameters: copyScalarParameters(message.parameters) }
      : {}),
  };
}

export function parseRemoteFile(value: unknown): RemoteFilePayload | null {
  if (!isObject(value)) return null;
  const rawBuffer = Reflect.get(value, 'buffer');
  if (!(rawBuffer instanceof ArrayBuffer)) return null;

  return {
    buffer: rawBuffer,
    ...(readString(value, 'name') ? { name: readString(value, 'name') } : {}),
    ...(readString(value, 'type') ? { type: readString(value, 'type') } : {}),
    ...(typeof Reflect.get(value, 'size') === 'number'
      ? { size: Reflect.get(value, 'size') as number }
      : {}),
  };
}

export function parseFileAccessPurpose(
  value: unknown,
): XpertViewFileAccessPurpose | null {
  return value === 'preview' || value === 'download' ? value : null;
}

export function readRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readObject(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? copyObject(value) : null;
}

export function createRemoteHostEvent(
  event: XpertRemoteViewHostEventMessage,
): XpertRemoteViewHostEventMessage {
  return {
    ...event,
    data: event.data ? copyObject(event.data) : {},
  };
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function copyObject(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function readString(value: object, key: string): string | undefined {
  const field = Reflect.get(value, key);
  return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

function readNullableString(
  value: object,
  key: string,
): string | null | undefined {
  const field = Reflect.get(value, key);
  if (field === null) return null;
  return typeof field === 'string' ? field : undefined;
}

function readPositiveInteger(value: object, key: string): number | undefined {
  const field = Reflect.get(value, key);
  return typeof field === 'number' && Number.isFinite(field) && field > 0
    ? Math.floor(field)
    : undefined;
}

function isScalar(value: unknown): value is XpertViewScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function readScalarOrArray(
  value: unknown,
): XpertViewScalar | XpertViewScalar[] | undefined {
  if (isScalar(value)) return value;
  return Array.isArray(value) && value.every(isScalar) ? value : undefined;
}

function copyScalarParameters(
  value: object,
): Record<string, XpertViewScalar | XpertViewScalar[]> {
  const result: Record<string, XpertViewScalar | XpertViewScalar[]> = {};
  for (const [key, field] of Object.entries(value)) {
    const parsed = readScalarOrArray(field);
    if (key.trim() && parsed !== undefined) result[key] = parsed;
  }
  return result;
}

function readFilterOperator(
  value: unknown,
): NonNullable<XpertViewQuery['filters']>[number]['operator'] {
  switch (value) {
    case 'eq':
    case 'neq':
    case 'contains':
    case 'starts_with':
    case 'ends_with':
    case 'in':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return value;
    default:
      return undefined;
  }
}
