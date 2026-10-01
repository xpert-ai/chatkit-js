import type {
  TMessageContentComplex,
  TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import type { ComponentMessagePartialStepData } from '../component-message-renderers';

/** Partial step data: during streaming, fields arrive incrementally */
export type PartialStepData = ComponentMessagePartialStepData;

export type StepStatus = NonNullable<PartialStepData['status']>;

export type ToolStepRunState = boolean | undefined;

export type ToolGroupCategory =
  | 'files'
  | 'searches'
  | 'commands'
  | 'lists'
  | 'tasks'
  | 'knowledges'
  | 'tools';

export type ToolComponentRenderUnit =
  | {
      type: 'item';
      item: TMessageContentComplex | string;
      index: number;
    }
  | {
      type: 'tool-group';
      items: TMessageContentComponent[];
      startIndex: number;
    };
