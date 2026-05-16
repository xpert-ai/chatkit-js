import type { ComponentType } from 'react';

import type {
  TMessageComponentStep,
  TMessageContentComponent,
} from '@xpert-ai/chatkit-types';

import type { LocalizedText } from '../../../i18n/localized-text';
import { isContextCompressionComponent } from './context-compression-message';
import { knowledgeRetrieverComponentRenderer } from './knowledge-retriever-component-renderer';
import { webSearchComponentRenderer } from './web-search-component-renderer';

export type ComponentMessagePartialStepData = Partial<
  Omit<TMessageComponentStep, 'message' | 'title'>
> & {
  category?: string;
  message?: LocalizedText;
  title?: LocalizedText;
};

export type ComponentMessageDetailsRendererProps = {
  content: TMessageContentComponent;
  data: ComponentMessagePartialStepData;
};

export type ComponentMessageDetailsRenderer =
  ComponentType<ComponentMessageDetailsRendererProps>;

export type ComponentMessageRendererPresentation =
  | 'standalone'
  | 'grouped-step';

export type ComponentMessageRenderer = {
  id: string;
  presentation: ComponentMessageRendererPresentation;
  match: (
    content: TMessageContentComponent,
    data: ComponentMessagePartialStepData,
  ) => boolean;
  getTitle?: (
    content: TMessageContentComponent,
    data: ComponentMessagePartialStepData,
    language: string,
  ) => string | null;
  renderDetails?: ComponentMessageDetailsRenderer;
  hasDetails?: (
    content: TMessageContentComponent,
    data: ComponentMessagePartialStepData,
  ) => boolean;
};

const COMPONENT_MESSAGE_RENDERERS: ComponentMessageRenderer[] = [
  {
    id: 'context-compression',
    presentation: 'standalone',
    match: (content) => isContextCompressionComponent(content),
    hasDetails: () => false,
  },
  knowledgeRetrieverComponentRenderer,
  webSearchComponentRenderer,
];

export function getComponentMessageRenderer(
  content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
): ComponentMessageRenderer | null {
  return (
    COMPONENT_MESSAGE_RENDERERS.find((renderer) =>
      renderer.match(content, data),
    ) ?? null
  );
}

export function getComponentMessagePresentation(
  content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
): ComponentMessageRendererPresentation | null {
  return getComponentMessageRenderer(content, data)?.presentation ?? null;
}

export function hasComponentMessageRendererDetails(
  renderer: ComponentMessageRenderer | null,
  content: TMessageContentComponent,
  data: ComponentMessagePartialStepData,
): boolean {
  if (!renderer?.renderDetails) return false;
  return renderer.hasDetails?.(content, data) ?? true;
}
