import * as React from 'react';
import {
  createUniver,
  LocaleType,
  mergeLocales,
  CommandType,
  ThemeService,
  LifecycleService,
  LifecycleStages,
  type FUniver,
} from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import zhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import enUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';
import './spreadsheet.css';
import {
  importSpreadsheetFile,
  exportSpreadsheetFile,
} from './spreadsheet-file.utils';
import {
  hydrateXlsxSnapshot,
  exportXlsxEdits,
  type XlsxEditSession,
} from './spreadsheet-xlsx-preservation';
import type { BinaryEditorHandle, BinaryEditorProps } from '../file-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { xlsxMenu, unsupportedXlsxCommand } from './spreadsheet-capabilities';
import { useTheme } from '../../../providers/Theme';

const SpreadsheetEditor = React.forwardRef<
  BinaryEditorHandle,
  BinaryEditorProps
>(function SpreadsheetEditor({ blob, name, onDirty }, ref) {
  const { t, i18n } = useChatkitTranslation();
  const { isDarkMode } = useTheme();
  const host = React.useRef<HTMLDivElement>(null);
  const api = React.useRef<FUniver | null>(null);
  const session = React.useRef<XlsxEditSession | null>(null);
  const themeService = React.useRef<ThemeService | null>(null);
  const interacted = React.useRef(false);
  const pendingSaves = React.useRef(new WeakMap<Blob, XlsxEditSession>());
  const [error, setError] = React.useState('');
  const [ready, setReady] = React.useState(false);
  const chinese = i18n.language.startsWith('zh');
  React.useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setReady(false);
    setError('');
    interacted.current = false;
    void (async () => {
      const snapshot = await importSpreadsheetFile(blob, name);
      const original = /\.xlsx$/i.test(name)
        ? await hydrateXlsxSnapshot(blob, snapshot)
        : null;
      if (disposed || !host.current) return;
      const { univer, univerAPI } = createUniver({
        locale: chinese ? LocaleType.ZH_CN : LocaleType.EN_US,
        locales: {
          [LocaleType.ZH_CN]: mergeLocales(zhCN),
          [LocaleType.EN_US]: mergeLocales(enUS),
        },
        darkMode: isDarkMode,
        presets: [
          UniverSheetsCorePreset({
            container: host.current,
            header: true,
            toolbar: true,
            ribbonType: 'classic',
            footer: {},
            menu: original ? xlsxMenu : undefined,
          }),
        ],
      });
      api.current = univerAPI;
      themeService.current = univer.__getInjector().get(ThemeService);
      const workbook = univerAPI.createWorkbook(snapshot);
      // Register cleanup before awaiting startup so switching tabs cannot leak an engine.
      // Univer owns another React root; dispose it after this root's commit.
      cleanup = () => queueMicrotask(() => univer.dispose());
      await univer
        .__getInjector()
        .get(LifecycleService)
        .onStage(LifecycleStages.Steady);
      if (disposed) return;
      const guard = univerAPI.addEvent(
        univerAPI.Event.BeforeCommandExecute,
        (event) => {
          if (original && unsupportedXlsxCommand(event.id)) {
            event.cancel = true;
            setError(t('workbench.files.xlsxUnsupported'));
          }
        },
      );
      const listener = univerAPI.addEvent(
        univerAPI.Event.CommandExecuted,
        (event) => {
          const params: unknown = event.params;
          if (
            interacted.current &&
            event.type === CommandType.MUTATION &&
            params &&
            typeof params === 'object' &&
            'unitId' in params &&
            params.unitId === workbook.getId()
          )
            onDirty();
        },
      );
      cleanup = () => {
        guard.dispose();
        listener.dispose();
        queueMicrotask(() => univer.dispose());
      };
      session.current = original
        ? { source: original, baseline: structuredClone(workbook.save()) }
        : null;
      setReady(true);
    })().catch((error: unknown) => {
      if (!disposed)
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
    });
    return () => {
      disposed = true;
      cleanup();
      api.current = null;
      session.current = null;
      themeService.current = null;
    };
  }, [blob, name, onDirty, chinese, t]);

  React.useEffect(() => {
    themeService.current?.setDarkMode(isDarkMode);
  }, [isDarkMode]);
  React.useImperativeHandle(
    ref,
    () => ({
      markSaved: (file) => {
        const saved = pendingSaves.current.get(file);
        if (saved) session.current = saved;
        pendingSaves.current.delete(file);
        setError('');
      },
      exportFile: async () => {
        const workbook = api.current?.getActiveWorkbook();
        if (!workbook) throw new Error(t('workbench.files.loading'));
        await workbook.endEditingAsync(true);
        const beforeCalculation = workbook.save();
        const hasFormulas = beforeCalculation.sheetOrder.some((id) => {
          const cells = beforeCalculation.sheets[id].cellData ?? {};
          return Object.keys(cells).some((row) =>
            Object.keys(cells[Number(row)] ?? {}).some((column) =>
              Boolean(cells[Number(row)][Number(column)]?.f),
            ),
          );
        });
        if (hasFormulas && api.current) {
          const formula = api.current.getFormula();
          const calculated = formula.onCalculationResultApplied(20000);
          formula.executeCalculation();
          await calculated;
        }
        const snapshot = workbook.save();
        const file = session.current
          ? await exportXlsxEdits(session.current, snapshot, name)
          : await exportSpreadsheetFile(snapshot, name);
        if (session.current)
          pendingSaves.current.set(file, {
            source: new Uint8Array(await file.arrayBuffer()),
            baseline: structuredClone(snapshot),
          });
        return file;
      },
    }),
    [name, t],
  );
  return (
    <div
      className="chatkit-spreadsheet relative flex h-full min-h-0 flex-col"
      onPointerDownCapture={() => {
        interacted.current = true;
      }}
      onKeyDownCapture={() => {
        interacted.current = true;
      }}
      onPasteCapture={() => {
        interacted.current = true;
      }}
    >
      {error && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!ready && !error && (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          {t('workbench.files.loading')}
        </p>
      )}
      <div
        ref={host}
        inert={!ready || undefined}
        className="min-h-0 w-full flex-1"
      />
    </div>
  );
});
export default SpreadsheetEditor;
