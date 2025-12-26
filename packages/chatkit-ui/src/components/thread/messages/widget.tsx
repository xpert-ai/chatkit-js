import type { TMessageComponentWidgetData } from '@xpert-ai/chatkit-types';
import { SurfaceRenderer, Types } from '@a2ui/react';

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
        if (!config || typeof config !== 'object') {
          return null;
        }
        const surfaceId =
          widgets.length > 1 ? `${baseSurfaceId}-${index}` : baseSurfaceId;

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
