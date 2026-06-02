import type { TMessageComponentWidgetData } from '@xpert-ai/chatkit-types';
import { useEffect, useMemo, useState } from 'react';
import {
  A2UIRenderer,
  SurfaceRenderer,
  Types,
  useA2UI,
} from '@xpert-ai/a2ui-react';

type RowData = Record<string, unknown>;

export type WidgetMessageProps = {
  messageId: string;
  data: TMessageComponentWidgetData;
};

export function WidgetMessage({ messageId, data }: WidgetMessageProps) {
  const widgets = Array.isArray(data.widgets) ? data.widgets : [];
  if (widgets.length === 0) return null;

  const baseSurfaceId = `widget-${messageId}`;

  return (
    <div className="space-y-3">
      {widgets.map((widget, index) => {
        const config = widget?.config;
        const messages = Array.isArray(widget?.messages)
          ? widget.messages
          : [];
        const surfaceId =
          widgets.length > 1 ? `${baseSurfaceId}-${index}` : baseSurfaceId;

        if (messages.length > 0) {
          return (
            <FlatWidgetSurface
              key={widget?.name ?? surfaceId}
              messages={messages}
              surfaceId={surfaceId}
            />
          );
        }

        if (!hasLegacySurface(config)) {
          return null;
        }

        return (
          <SurfaceRenderer
            key={widget?.name ?? surfaceId}
            surfaceId={surfaceId}
            surface={config as Types.Surface}
          />
        );
      })}
    </div>
  );
}

function FlatWidgetSurface({
  messages,
  surfaceId,
}: {
  messages: Types.ServerToClientMessage[];
  surfaceId: string;
}) {
  const { processMessages } = useA2UI();
  const [renderError, setRenderError] = useState(false);
  const normalizedMessages = useMemo(
    () => normalizeFlatWidgetMessages(messages, surfaceId),
    [messages, surfaceId],
  );

  useEffect(() => {
    if (normalizedMessages.length === 0) return;

    setRenderError(false);
    try {
      processMessages(normalizedMessages);
    } catch (error) {
      console.warn('[chatkit-ui] Failed to render widget surface', {
        surfaceId,
        error,
      });
      setRenderError(true);
      return;
    }

    return () => {
      processMessages([{ deleteSurface: { surfaceId } }]);
    };
  }, [normalizedMessages, processMessages, surfaceId]);

  if (renderError) {
    return <WidgetRenderErrorFallback />;
  }

  return <A2UIRenderer surfaceId={surfaceId} />;
}

function WidgetRenderErrorFallback() {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
    >
      Widget failed to render.
    </div>
  );
}

/**
 * Normalizes one widget's flat A2UI messages before handing them to the shared
 * processor. This keeps each chat message on an isolated surface and smooths
 * over known model-generated near-A2UI shapes from older responses.
 */
function normalizeFlatWidgetMessages(
  messages: Types.ServerToClientMessage[],
  surfaceId: string,
): Types.ServerToClientMessage[] {
  const generatedTemplateDataPaths = collectTemplateDataPaths(messages);
  const indexedRowsByPath = collectIndexedRowsByPath(
    messages,
    generatedTemplateDataPaths,
  );

  return messages.map((message) => ({
    ...message,
    ...(message.beginRendering
      ? {
          beginRendering: {
            ...message.beginRendering,
            surfaceId,
          },
        }
      : {}),
    ...(message.surfaceUpdate
      ? {
          surfaceUpdate: {
            ...message.surfaceUpdate,
            surfaceId,
            components: normalizeComponentInstances(
              message.surfaceUpdate.components,
            ),
          },
        }
      : {}),
    ...(message.dataModelUpdate
      ? {
          dataModelUpdate: normalizeDataModelUpdate(
            message.dataModelUpdate,
            surfaceId,
            indexedRowsByPath,
          ),
        }
      : {}),
    ...(message.deleteSurface
      ? {
          deleteSurface: {
            ...message.deleteSurface,
            surfaceId,
          },
        }
      : {}),
  }));
}

/**
 * Rewrites templated row data into the primitive-at-path convention expected by
 * A2UI. Without this, flattened preview rows become a Map and List templates
 * render empty cells instead of iterating row objects.
 */
function normalizeDataModelUpdate(
  dataModelUpdate: Types.DataModelUpdate,
  surfaceId: string,
  indexedRowsByPath: Map<string, RowData[]>,
): Types.DataModelUpdate {
  const path = dataModelUpdate.path ?? '/';
  const indexedRows = indexedRowsByPath.get(path);

  if (!indexedRows) {
    return {
      ...dataModelUpdate,
      surfaceId,
    };
  }

  return {
    ...dataModelUpdate,
    surfaceId,
    contents: [
      {
        key: '.',
        valueString: JSON.stringify(indexedRows),
      },
    ],
  };
}

/**
 * Finds List template data paths, including the non-standard `dataPath` field
 * emitted by earlier agents and the standard `dataBinding` field.
 */
function collectTemplateDataPaths(
  messages: Types.ServerToClientMessage[],
): Set<string> {
  const paths = new Set<string>();

  for (const message of messages) {
    for (const component of message.surfaceUpdate?.components ?? []) {
      const componentType = getComponentType(component);
      if (componentType !== 'List') continue;

      const properties = getComponentProperties(component);
      const children = getObjectProperty(properties, 'children');
      const template = getObjectProperty(children, 'template');
      const dataPath =
        getStringProperty(template, 'dataPath') ??
        getStringProperty(template, 'dataBinding');

      if (dataPath) {
        paths.add(dataPath);
      }
    }
  }

  return paths;
}

function collectIndexedRowsByPath(
  messages: Types.ServerToClientMessage[],
  generatedTemplateDataPaths: Set<string>,
): Map<string, RowData[]> {
  const indexedRowsByPath = new Map<string, RowData[]>();

  for (const message of messages) {
    const dataModelUpdate = message.dataModelUpdate;
    const path = dataModelUpdate?.path ?? '/';

    if (!dataModelUpdate || !generatedTemplateDataPaths.has(path)) {
      continue;
    }

    const indexedRows = convertIndexedValueMapsToRows(
      dataModelUpdate.contents,
    );

    if (indexedRows) {
      indexedRowsByPath.set(path, indexedRows);
    }
  }

  return indexedRowsByPath;
}

/**
 * Converts generated flattened row keys into row objects for List templates.
 * Supported inputs include `r0_date` and `row_1_date`; unprefixed keys form
 * the first row so mixed first-row formats still render.
 */
function convertIndexedValueMapsToRows(
  contents: Types.ValueMap[],
): RowData[] | undefined {
  const rows: RowData[] = [];
  let hasIndexedRows = false;

  for (const item of contents) {
    const value = readValueMapValue(item);
    if (value === undefined) {
      continue;
    }

    const match = item.key.match(/^(?:r(\d+)|row_(\d+))_(.+)$/);
    if (!match) {
      rows[0] = {
        ...(rows[0] ?? {}),
        [item.key]: value,
      };
      continue;
    }

    const index = Number(match[1] ?? match[2]);
    const field = match[3];

    if (!Number.isInteger(index)) {
      continue;
    }

    rows[index] = {
      ...(rows[index] ?? {}),
      [field]: value,
    };
    hasIndexedRows = true;
  }

  return hasIndexedRows ? rows.map((row) => row ?? {}) : undefined;
}

function readValueMapValue(valueMap: Types.ValueMap): unknown {
  if (valueMap.valueString !== undefined) return valueMap.valueString;
  if (valueMap.valueNumber !== undefined) return valueMap.valueNumber;
  if (valueMap.valueBoolean !== undefined) return valueMap.valueBoolean;
  if (Array.isArray(valueMap.valueMap)) {
    return valueMap.valueMap.reduce<RowData>((result, item) => {
      const value = readValueMapValue(item);
      if (value !== undefined) {
        result[item.key] = value;
      }
      return result;
    }, {});
  }
  return undefined;
}

/**
 * Normalizes component instances and lifts embedded template components into
 * the flat component list required by the A2UI processor.
 */
function normalizeComponentInstances(
  components: Types.ComponentInstance[],
): Types.ComponentInstance[] {
  return components.flatMap((component) => {
    const componentType = getComponentType(component);
    const properties = getComponentProperties(component);

    if (!componentType || !properties) {
      return [component];
    }

    const normalizedProperties = normalizeComponentProperties(
      componentType,
      properties,
    );
    const normalizedComponent = {
      ...component,
      component: {
        [componentType]: normalizedProperties,
      } as Types.ComponentProperties,
    };
    const templateComponent = getGeneratedTemplateComponent(properties);

    if (!templateComponent) {
      return [normalizedComponent];
    }

    return [
      normalizedComponent,
      ...normalizeComponentInstances([templateComponent]),
    ];
  });
}

/**
 * Converts tolerated legacy/generated component property shapes into standard
 * A2UI properties. The main case is List template shorthand
 * `{ dataPath, itemTemplate }` -> `{ componentId, dataBinding }`.
 */
function normalizeComponentProperties(
  componentType: string,
  properties: RowData,
): RowData {
  const normalized = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      normalizePropertyValue(key, value),
    ]),
  );

  if (componentType !== 'List') {
    return normalized;
  }

  const children = getObjectProperty(normalized, 'children');
  const template = getObjectProperty(children, 'template');
  const dataPath = getStringProperty(template, 'dataPath');
  const itemTemplate = getObjectProperty(template, 'itemTemplate');
  const componentId =
    getStringProperty(template, 'componentId') ??
    getStringProperty(itemTemplate, 'id');

  if (!dataPath || !componentId) {
    return normalized;
  }

  const direction = getStringProperty(children, 'direction');
  if (direction && !normalized.direction) {
    normalized.direction = direction;
  }
  normalized.children = {
    template: {
      componentId,
      dataBinding: dataPath,
    },
  };

  return normalized;
}

function normalizePropertyValue(key: string, value: unknown): unknown {
  if (key === 'text' && typeof value === 'string') {
    return { literalString: value };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePropertyValue(key, item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      childKey === 'path' && typeof childValue === 'string'
        ? normalizeGeneratedIndexedPath(childValue)
        : normalizePropertyValue(childKey, childValue),
    ]),
  );
}

function normalizeGeneratedIndexedPath(path: string): string {
  const match = path.match(/^\/[^/]+\/r\{index\}_(.+)$/);
  return match?.[1] ?? path;
}

function getGeneratedTemplateComponent(
  properties: RowData,
): Types.ComponentInstance | undefined {
  const children = getObjectProperty(properties, 'children');
  const template = getObjectProperty(children, 'template');
  const itemTemplate = getObjectProperty(template, 'itemTemplate');
  const id = getStringProperty(itemTemplate, 'id');
  const component = getObjectProperty(itemTemplate, 'component');

  if (!id || !component) {
    return undefined;
  }

  return {
    id,
    component: component as Types.ComponentProperties,
  };
}

function getComponentType(
  component: Types.ComponentInstance,
): string | undefined {
  const entries = Object.keys(component.component ?? {});
  return entries.length === 1 ? entries[0] : undefined;
}

function getComponentProperties(
  component: Types.ComponentInstance,
): RowData | undefined {
  const componentType = getComponentType(component);
  if (!componentType) {
    return undefined;
  }

  return getObjectProperty(component.component, componentType);
}

function getObjectProperty(
  value: unknown,
  key: string,
): RowData | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const property = value[key];
  return isPlainObject(property) ? property : undefined;
}

function getStringProperty(
  value: unknown,
  key: string,
): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === 'string' ? property : undefined;
}

function isPlainObject(value: unknown): value is RowData {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasLegacySurface(
  surface: Types.Surface | undefined,
): surface is Types.Surface {
  return !!surface?.componentTree;
}
