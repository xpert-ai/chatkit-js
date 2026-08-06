import type { Readable, Writable } from 'node:stream';

import {
  NativeMessageDecoder,
  encodeNativeMessage,
} from './native-protocol.js';
import type { BrowserRunner } from './runner.js';
import type { HostPageAutomationClientToolCall } from './types.js';

export const BROWSER_RUNNER_NATIVE_HOST = 'ai.xpert.chatkit.browser_runner';

type NativeRunnerCommand = {
  requestId: string;
  command: 'status' | 'start' | 'stop' | 'execute';
  startUrl?: string;
  call?: HostPageAutomationClientToolCall;
};

function parseCommand(value: unknown): NativeRunnerCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid browser runner command.');
  }
  const requestId = Reflect.get(value, 'requestId');
  const command = Reflect.get(value, 'command');
  if (typeof requestId !== 'string' || !requestId) {
    throw new Error('Browser runner requestId is required.');
  }
  if (!['status', 'start', 'stop', 'execute'].includes(String(command))) {
    throw new Error('Unsupported browser runner command.');
  }
  return {
    requestId,
    command: command as NativeRunnerCommand['command'],
    startUrl:
      typeof Reflect.get(value, 'startUrl') === 'string'
        ? String(Reflect.get(value, 'startUrl'))
        : undefined,
    call: Reflect.get(value, 'call') as
      | HostPageAutomationClientToolCall
      | undefined,
  };
}

export async function handleNativeRunnerCommand(
  runner: BrowserRunner,
  value: unknown,
) {
  const command = parseCommand(value);
  switch (command.command) {
    case 'status':
      return {
        requestId: command.requestId,
        ok: true,
        status: runner.status(),
      };
    case 'start':
      return {
        requestId: command.requestId,
        ok: true,
        status: await runner.start(
          command.startUrl ? { startUrl: command.startUrl } : {},
        ),
      };
    case 'stop':
      await runner.stop();
      return {
        requestId: command.requestId,
        ok: true,
        status: runner.status(),
      };
    case 'execute':
      if (!command.call) {
        throw new Error('Browser runner execute requires a tool call.');
      }
      return {
        requestId: command.requestId,
        ok: true,
        status: runner.status(),
        result: await runner.execute(command.call),
      };
  }
}

export function runNativeMessagingHost(
  runner: BrowserRunner,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
) {
  const decoder = new NativeMessageDecoder();
  let queue = Promise.resolve();

  input.on('data', (chunk: Buffer) => {
    let messages: unknown[];
    try {
      messages = decoder.push(chunk);
    } catch (error) {
      output.write(
        encodeNativeMessage({
          requestId: '',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return;
    }

    for (const message of messages) {
      queue = queue.then(async () => {
        const requestId =
          message && typeof message === 'object'
            ? Reflect.get(message, 'requestId')
            : '';
        try {
          output.write(
            encodeNativeMessage(
              await handleNativeRunnerCommand(runner, message),
            ),
          );
        } catch (error) {
          output.write(
            encodeNativeMessage({
              requestId: typeof requestId === 'string' ? requestId : '',
              ok: false,
              status: runner.status(),
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    }
  });
  input.on('end', () => {
    void queue.finally(() => runner.stop());
  });
}
