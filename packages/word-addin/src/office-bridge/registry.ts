import type { OfficeHostAdapter, OfficeToolRegistry } from './types';

export class DefaultOfficeToolRegistry<TToolName extends string>
  implements OfficeToolRegistry<TToolName>
{
  readonly #adapters: Array<OfficeHostAdapter<TToolName>>;

  constructor(adapters: Array<OfficeHostAdapter<TToolName>>) {
    this.#adapters = adapters;
  }

  supports(toolName: string): toolName is TToolName {
    return this.#adapters.some((adapter) => adapter.supports(toolName));
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const adapter = this.#adapters.find((candidate) => candidate.supports(toolName));
    if (!adapter) {
      throw new Error(`Unknown Office tool: ${toolName}`);
    }

    return adapter.execute(toolName as TToolName, params);
  }
}

export function createOfficeToolRegistry<TToolName extends string>(
  adapters: Array<OfficeHostAdapter<TToolName>>,
): OfficeToolRegistry<TToolName> {
  return new DefaultOfficeToolRegistry(adapters);
}
