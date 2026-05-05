import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  ChatKit,
  createChatKit,
  type ChatKitControl,
} from '@xpert-ai/chatkit-angular';
import type { ChatKitPetOptions } from '@xpert-ai/chatkit-types';

type DemoConfig = {
  apiUrl: string;
  frameUrl: string;
  xpertId: string;
  sessionBaseUrl: string;
  clientSecretOverride: string;
};

type QuickPrompt = {
  label: string;
  text: string;
};

type PetPreset =
  | 'default'
  | 'boba'
  | 'bolt'
  | 'atlas'
  | 'launcher'
  | 'off';

type PetPresetOption = {
  id: PetPreset;
  label: string;
};

const DEFAULT_FRAME_URL =
  import.meta.env.VITE_CHATKIT_FRAME_URL ?? 'http://localhost:5173';
const DEFAULT_API_URL =
  import.meta.env.VITE_XPERTAI_API_URL ?? 'http://localhost:3000/api/ai/';
const DEFAULT_XPERT_ID = import.meta.env.VITE_XPERTAI_XPERT_ID ?? '';
const DEFAULT_SESSION_BASE_URL = import.meta.env.VITE_SESSION_BASE_URL ?? '';
const DEFAULT_CLIENT_SECRET_OVERRIDE = import.meta.env.VITE_CLIENT_SECRET ?? '';
const DEMO_PET_ATLAS_PATH = '/pets/boba/spritesheet.webp';

function resolveApiUrl(apiUrl: string, frameUrl: string): string {
  const nextApiUrl = apiUrl.trim();
  if (!nextApiUrl) {
    return nextApiUrl;
  }

  try {
    return new URL(nextApiUrl).toString().replace(/\/$/, '');
  } catch {
    try {
      return new URL(nextApiUrl, frameUrl).toString().replace(/\/$/, '');
    } catch {
      return nextApiUrl;
    }
  }
}

function resolveSessionUrl(sessionBaseUrl: string): string {
  const nextBaseUrl = sessionBaseUrl.trim();
  if (!nextBaseUrl) {
    return '/api/create-session';
  }

  try {
    return new URL('/api/create-session', nextBaseUrl).toString();
  } catch {
    return `${nextBaseUrl.replace(/\/$/, '')}/api/create-session`;
  }
}

function resolveFrameAssetUrl(frameUrl: string, assetPath: string): string {
  const nextFrameUrl = frameUrl.trim() || DEFAULT_FRAME_URL;

  try {
    return new URL(assetPath, nextFrameUrl).toString();
  } catch {
    return assetPath;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatKit],
  template: `
    <div class="min-h-screen bg-slate-100 text-slate-900">
      <div class="mx-auto flex h-screen max-w-7xl gap-4 p-4">
        <section
          class="flex w-80 shrink-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div>
            <p
              class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
            >
              Angular Demo
            </p>
            <h1 class="mt-2 text-xl font-semibold">ChatKit 最小验证页</h1>
            <p class="mt-2 text-sm leading-6 text-slate-500">
              这个示例只做一件事：用最少的 Angular 代码挂起
              <code>@xpert-ai/chatkit-angular</code>，验证
              iframe、事件和发消息链路。
            </p>
          </div>

          <div class="mt-6 space-y-3 text-sm">
            <label class="block">
              <span class="mb-1 block font-medium text-slate-700"
                >Frame URL</span
              >
              <input
                #frameUrlInput
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                [value]="config.frameUrl"
              />
            </label>

            <label class="block">
              <span class="mb-1 block font-medium text-slate-700">API URL</span>
              <input
                #apiUrlInput
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                [value]="config.apiUrl"
              />
            </label>

            <label class="block">
              <span class="mb-1 block font-medium text-slate-700"
                >Xpert ID</span
              >
              <textarea
                #xpertIdInput
                class="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 outline-none transition focus:border-slate-400 focus:bg-white"
                >{{ config.xpertId }}</textarea
              >
            </label>

            <label class="block">
              <span class="mb-1 block font-medium text-slate-700"
                >Session API Base URL</span
              >
              <input
                #sessionBaseUrlInput
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                [value]="config.sessionBaseUrl"
                placeholder="留空则走当前 demo 的 /api 代理"
              />
            </label>

            <label class="block">
              <span class="mb-1 block font-medium text-slate-700"
                >Client Secret / API Key</span
              >
              <textarea
                #clientSecretInput
                class="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="可选。留空则调用 /api/create-session"
                >{{ config.clientSecretOverride }}</textarea
              >
            </label>

            <button
              type="button"
              class="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              (click)="
                applyConfig(
                  frameUrlInput.value,
                  apiUrlInput.value,
                  xpertIdInput.value,
                  sessionBaseUrlInput.value,
                  clientSecretInput.value
                )
              "
            >
              应用配置
            </button>
          </div>

          <div
            class="mt-4 rounded-3xl bg-slate-50 p-3 text-xs leading-6 text-slate-600"
          >
            <div>
              <span class="font-semibold text-slate-900">状态：</span
              >{{ status }}
            </div>
            <div>
              <span class="font-semibold text-slate-900">Thread：</span
              >{{ threadId || '新会话' }}
            </div>
            <div>
              <span class="font-semibold text-slate-900">Session URL：</span
              >{{ sessionUrl }}
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <button
              type="button"
              class="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              (click)="focusComposer()"
            >
              聚焦输入框
            </button>
            <button
              type="button"
              class="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              (click)="startNewThread()"
            >
              新建会话
            </button>
          </div>

          <div class="mt-6">
            <h2 class="text-sm font-semibold text-slate-900">Pet</h2>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                *ngFor="let preset of petPresets"
                type="button"
                class="rounded-2xl border px-3 py-2 text-xs font-medium transition"
                [ngClass]="
                  petPreset === preset.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                "
                (click)="setPetPreset(preset.id)"
              >
                {{ preset.label }}
              </button>
            </div>
            <p class="mt-2 text-xs leading-5 text-slate-500">
              {{ petPresetDescription }}
            </p>
          </div>

          <div class="mt-6">
            <h2 class="text-sm font-semibold text-slate-900">快速消息</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                *ngFor="let prompt of quickPrompts"
                type="button"
                class="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                (click)="sendPrompt(prompt.text)"
              >
                {{ prompt.label }}
              </button>
            </div>
          </div>

          <div
            class="mt-6 min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-3"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-900">事件日志</h2>
              <button
                type="button"
                class="text-xs text-slate-500 transition hover:text-slate-900"
                (click)="clearLogs()"
              >
                清空
              </button>
            </div>

            <div class="mt-3 h-full overflow-auto">
              <p
                *ngIf="logs.length === 0"
                class="text-xs leading-6 text-slate-400"
              >
                还没有事件，等 ChatKit ready 或发一条消息试试。
              </p>

              <ul *ngIf="logs.length > 0" class="space-y-2">
                <li
                  *ngFor="let log of logs; trackBy: trackByLog"
                  class="rounded-2xl bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm"
                >
                  {{ log }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          class="min-w-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <xpert-chatkit [control]="chatkit"></xpert-chatkit>
        </section>
      </div>
    </div>
  `,
})
export class AppComponent {
  protected config: DemoConfig = {
    frameUrl: DEFAULT_FRAME_URL,
    apiUrl: DEFAULT_API_URL,
    xpertId: DEFAULT_XPERT_ID,
    sessionBaseUrl: DEFAULT_SESSION_BASE_URL,
    clientSecretOverride: DEFAULT_CLIENT_SECRET_OVERRIDE,
  };

  protected readonly quickPrompts: QuickPrompt[] = [
    { label: '自我介绍', text: '请先自我介绍一下，并说明你能做什么。' },
    { label: '总结能力', text: '请用 3 条简短要点总结你的能力。' },
    { label: '测试流式', text: '请给我一个分步骤回答，方便我测试流式输出。' },
  ];
  protected readonly petPresets: PetPresetOption[] = [
    { id: 'default', label: 'pet: true' },
    { id: 'boba', label: 'Boba' },
    { id: 'bolt', label: 'Bolt' },
    { id: 'atlas', label: 'Spritesheet URL' },
    { id: 'launcher', label: 'Pet launcher' },
    { id: 'off', label: 'Off' },
  ];

  protected readonly chatkit: ChatKitControl = createChatKit(
    this.buildOptions(),
  );
  protected petPreset: PetPreset = 'off';
  protected logs: string[] = [];
  protected status = this.config.xpertId
    ? '等待 ChatKit iframe 就绪'
    : '请先提供 xpertId 或 API key';
  protected threadId: string | null = null;
  protected sessionUrl = resolveSessionUrl(this.config.sessionBaseUrl);

  protected applyConfig(
    frameUrl: string,
    apiUrl: string,
    xpertId: string,
    sessionBaseUrl: string,
    clientSecretOverride: string,
  ): void {
    const nextFrameUrl = frameUrl.trim();
    this.config = {
      frameUrl: nextFrameUrl,
      apiUrl: resolveApiUrl(apiUrl, nextFrameUrl),
      xpertId: xpertId.trim(),
      sessionBaseUrl: sessionBaseUrl.trim(),
      clientSecretOverride: clientSecretOverride.trim(),
    };
    this.sessionUrl = resolveSessionUrl(this.config.sessionBaseUrl);

    this.chatkit.setOptions(this.buildOptions());
    this.status = this.config.xpertId
      ? '配置已更新，等待重新连接'
      : '缺少 xpertId 或 API key';
    this.pushLog(`Applied config: ${this.config.apiUrl}`);
  }

  protected clearLogs(): void {
    this.logs = [];
  }

  protected get petPresetDescription(): string {
    switch (this.petPreset) {
      case 'default':
        return '启用 pet: true，使用默认文件型 Boba。';
      case 'boba':
      case 'bolt':
        return '使用 chatkit-ui public/pets 内置的文件型 pet。';
      case 'atlas':
        return '直接配置本地托管的 spritesheet URL。';
      case 'launcher':
        return '初始只显示 pet，点击 pet 后打开 ChatKit 面板。';
      case 'off':
        return '关闭 pet，保持默认 ChatKit 行为。';
    }
  }

  protected setPetPreset(preset: PetPreset): void {
    this.petPreset = preset;
    this.chatkit.setOptions(this.buildOptions());
    this.pushLog(`Pet preset changed: ${preset}`);
  }

  protected focusComposer(): void {
    if (!this.hasRequiredConfig()) {
      return;
    }

    void this.chatkit.focusComposer();
  }

  protected sendPrompt(text: string): void {
    if (!this.hasRequiredConfig()) {
      return;
    }

    void this.chatkit.sendUserMessage({
      text,
      newThread: this.threadId === null,
    });
  }

  protected startNewThread(): void {
    if (!this.hasRequiredConfig()) {
      return;
    }

    this.threadId = null;
    this.status = '已切换到新会话';
    this.pushLog('Switched to a new thread');
    void this.chatkit.setThreadId(null);
  }

  protected trackByLog(index: number): number {
    return index;
  }

  private buildOptions() {
    const resolvedApiUrl = resolveApiUrl(
      this.config.apiUrl,
      this.config.frameUrl,
    );
    const resolvedSessionUrl = resolveSessionUrl(this.config.sessionBaseUrl);

    return {
      frameUrl: this.config.frameUrl,
      api: {
        apiUrl: resolvedApiUrl,
        xpertId: this.config.xpertId,
        getClientSecret: async () => {
          if (this.config.clientSecretOverride) {
            this.status = '使用手动填写的 client secret / api key';
            this.pushLog('Using client secret override');
            return this.config.clientSecretOverride;
          }

          this.status = '正在请求 client secret';
          this.pushLog(`Requesting client secret from ${resolvedSessionUrl}`);
          const response = await fetch(resolvedSessionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              xpertId: this.config.xpertId,
              assistantId: this.config.xpertId,
              assistant: { id: this.config.xpertId },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            let errorMessage = `HTTP ${response.status}`;
            if (errorText) {
              try {
                const errorData = JSON.parse(errorText) as { error?: string };
                errorMessage = errorData.error || errorMessage;
              } catch {
                errorMessage = `${errorMessage}: ${errorText.slice(0, 160)}`;
              }
            }
            this.status = errorMessage;
            this.pushLog(`Session request failed: ${errorMessage}`);
            throw new Error(errorMessage);
          }

          const data = await response.json();
          if (!data.client_secret) {
            this.status = 'Session response missing client_secret';
            this.pushLog('Session response missing client_secret');
            throw new Error('Missing client_secret in response');
          }

          this.status = '已获取 client secret';
          this.pushLog('Client secret received');
          return data.client_secret;
        },
      },
      theme: {
        colorScheme: 'light' as const,
        radius: 'round' as const,
        density: 'normal' as const,
      },
      composer: {
        placeholder: '输入一条消息，验证 chatkit-angular 是否正常工作',
      },
      displayMode: this.petPreset === 'launcher' ? ('pet' as const) : ('chat' as const),
      pet: this.buildPetOptions(),
      startScreen: {
        greeting: 'ChatKit Angular demo 已准备就绪。',
        prompts: this.quickPrompts.map((prompt) => ({
          label: prompt.label,
          prompt: prompt.text,
          icon: 'sparkle' as const,
        })),
      },
      onError: ({ error }: { error: Error }) => {
        this.status = error.message;
        this.pushLog(`Error: ${error.message}`);
      },
      onReady: () => {
        this.status = 'ChatKit 已就绪';
        this.pushLog('ChatKit ready');
      },
      onResponseStart: () => {
        this.status = '助手正在回复';
        this.pushLog('Response started');
      },
      onResponseEnd: () => {
        this.status = '助手回复完成';
        this.pushLog('Response ended');
      },
      onThreadChange: ({ threadId }: { threadId: string | null }) => {
        this.threadId = threadId;
        this.status = threadId ? `当前线程：${threadId}` : '当前是新会话';
        this.pushLog(`Thread changed: ${threadId ?? 'new-thread'}`);
      },
    };
  }

  private buildSpritesheetPet(src: string): ChatKitPetOptions {
    return {
      character: { type: 'sprite-atlas', src },
      position: {
        pin: 'bottom-right',
        draggable: true,
        scale: 0.25,
        persist: true,
      },
    };
  }

  private buildPetOptions(): boolean | ChatKitPetOptions | undefined {
    switch (this.petPreset) {
      case 'default':
        return true;
      case 'boba':
        return this.buildSpritesheetPet(
          resolveFrameAssetUrl(this.config.frameUrl, '/pets/boba/spritesheet.webp'),
        );
      case 'bolt':
        return this.buildSpritesheetPet(
          resolveFrameAssetUrl(this.config.frameUrl, '/pets/bolt/spritesheet.webp'),
        );
      case 'atlas':
        return this.buildSpritesheetPet(
          resolveFrameAssetUrl(this.config.frameUrl, DEMO_PET_ATLAS_PATH),
        );
      case 'launcher':
        return true;
      case 'off':
        return undefined;
    }
  }

  private hasRequiredConfig(): boolean {
    const ready = Boolean(
      this.config.apiUrl && this.config.frameUrl && this.config.xpertId,
    );
    if (!ready) {
      this.status = '缺少 frameUrl、apiUrl 或 xpertId';
      this.pushLog('Missing required config');
    }
    return ready;
  }

  private pushLog(message: string): void {
    this.logs = [
      `${new Date().toLocaleTimeString()} ${message}`,
      ...this.logs,
    ].slice(0, 12);
  }
}
