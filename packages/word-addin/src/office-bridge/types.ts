import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';
import type { WordToolName } from './tools';

export type OfficeToolCall = {
  name: string;
  params?: Record<string, unknown>;
  id?: string;
  tool_call_id?: string;
};

export type OfficeToolResult =
  | {
      ok: true;
      result: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export type OfficeHostAdapter<TToolName extends string = string> = {
  readonly host: string;
  supports(toolName: string): toolName is TToolName;
  execute(toolName: TToolName, params: Record<string, unknown>): Promise<unknown>;
};

export type OfficeToolRegistry<TToolName extends string = string> = {
  supports(toolName: string): toolName is TToolName;
  execute(toolName: string, params: Record<string, unknown>): Promise<unknown>;
};

export type OfficeBridgeClientToolHandler = (
  call: OfficeToolCall,
) => Promise<ClientToolMessageInput> | ClientToolMessageInput;

export type CreateOfficeBridgeClientToolHandlerOptions<
  TToolName extends string = WordToolName,
> = {
  adapter?: OfficeHostAdapter<TToolName>;
  registry?: OfficeToolRegistry<TToolName>;
};

export type WordInsertLocation = 'Start' | 'End' | 'Replace';

export type WordBodyInsertLocation = Exclude<WordInsertLocation, 'Replace'>;

export type WordTableValues = string[][];
