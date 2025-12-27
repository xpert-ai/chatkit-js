import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useChatKit, ChatKit } from '@xpert-ai/chatkit-react';
import { ChatKitOptions, ClientToolMessageInput, SupportedLocale } from '@xpert-ai/chatkit-types';
import * as echarts from 'echarts';
import { useAppStore } from './store/useAppStore';
import { ExcelUploader } from './components/ExcelUploader';
import { ExcelTable } from './components/ExcelTable';
import { EChartsRenderer } from './components/EChartsRenderer';
import { getLanguage, setLanguage } from './i18n';
import { useAppTranslation } from './i18n/useAppTranslation';

// Client tool name for rendering echarts
const RENDER_ECHARTS_TOOL = 'render_echarts';

export default function App() {
  const { t } = useAppTranslation();
  const [locale, setLocale] = useState<SupportedLocale>(() => getLanguage());
  const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ?? '';
  const assistantId = (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';

  const {
    excelData,
    setEchartsOption,
    setRenderError,
    setChatkit,
    setIsGenerating,
  } = useAppStore();

  const chatkitOptions = useMemo<Partial<ChatKitOptions>>(() => ({
    locale: locale as SupportedLocale,
    theme: {
      colorScheme: 'light',
      radius: 'round',
      density: 'normal',
      typography: {
        baseSize: 15,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      color: {
        accent: {
          primary: '#3b82f6',
          level: 1,
        },
      },
    },
    composer: {
      placeholder: t('chatkit.composer.placeholder'),
      attachments: {
        enabled: false,
      },
    },
    startScreen: {
      greeting: t('chatkit.startScreen.greeting'),
      prompts: [
        {
          icon: 'circle-question',
          label: t('chatkit.startScreen.promptHowWorksLabel'),
          prompt: t('chatkit.startScreen.promptHowWorksText'),
        },
        {
          icon: 'lightbulb',
          label: t('chatkit.startScreen.promptChartTypesLabel'),
          prompt: t('chatkit.startScreen.promptChartTypesText'),
        },
      ],
    },
    header: {
      enabled: true,
      title: {
        enabled: true,
        text: t('chatkit.header.title'),
      },
    },
  }), [locale, t]);

  const chatkit = useChatKit({
    ...chatkitOptions,
    api: {
      getClientSecret: async () => {
        const createSessionUrl = backendOrigin
          ? `${backendOrigin.replace(/\/$/, '')}/api/create-session`
          : '/api/create-session';

        const response = await fetch(createSessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(assistantId ? { assistantId } : {}),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.client_secret) {
          throw new Error('Missing client_secret in response');
        }

        return data.client_secret;
      },
    },
    onClientTool: async ({ name, params, id, tool_call_id }): Promise<ClientToolMessageInput> => {
      console.log(`[ECharts Demo] Client tool invoked:`, { name, params, id, tool_call_id });

      // Match tool name more flexibly (case-insensitive, partial match)
      const isEchartsRender = name.toLowerCase().includes('echarts') ||
                               name.toLowerCase().includes('chart') ||
                               name === RENDER_ECHARTS_TOOL;

        if (isEchartsRender) {
          setIsGenerating(false);

        try {
          console.log('[ECharts Demo] Parsing params:', typeof params, params);

          // Parse the echarts option from params
          let option: echarts.EChartsOption;

          if (typeof params === 'string') {
            console.log('[ECharts Demo] Parsing string params');
            option = JSON.parse(params);
          } else if (params && typeof params === 'object') {
            // params might be { option: "..." } or the option itself
            const paramsObj = params as Record<string, unknown>;
            const optionStr = paramsObj.option;

            if (typeof optionStr === 'string') {
              console.log('[ECharts Demo] Parsing option string from params.option');
              option = JSON.parse(optionStr);
            } else if (optionStr && typeof optionStr === 'object') {
              console.log('[ECharts Demo] Using params.option as object');
              option = optionStr as echarts.EChartsOption;
            } else if (paramsObj.series || paramsObj.xAxis || paramsObj.yAxis) {
              // params itself looks like an echarts option
              console.log('[ECharts Demo] Using params directly as echarts option');
              option = paramsObj as echarts.EChartsOption;
            } else {
              console.log('[ECharts Demo] Unknown params structure:', Object.keys(paramsObj));
              throw new Error(`Invalid params structure. Keys: ${Object.keys(paramsObj).join(', ')}`);
            }
          } else {
            throw new Error('Invalid params: expected ECharts option object or JSON string');
          }

          // Validate the option has required fields
          if (!option || typeof option !== 'object') {
            throw new Error('Invalid ECharts option: must be an object');
          }

          console.log('[ECharts Demo] Parsed option:', option);

          // Try to render (this will be validated by ECharts)
          setEchartsOption(option);
          setRenderError(null);

          console.log('[ECharts Demo] Chart rendered successfully');

          return {
            tool_call_id: tool_call_id || id,
            name,
            status: 'success',
            content: t('chatkit.tool.renderSuccess'),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[ECharts Demo] Failed to render ECharts:', errorMessage, error);

          setRenderError(errorMessage);
          setEchartsOption(null);

          // Return error status - this will trigger retry from backend
          return {
            tool_call_id: tool_call_id || id,
            name,
            status: 'error',
            content: t('chatkit.tool.renderFailed', { error: errorMessage }),
          };
        }
      }

      // Default handler for other tools
      return {
        tool_call_id: tool_call_id || id,
        name,
        status: 'success',
        content: t('chatkit.tool.defaultSuccess', { name }),
      };
    },
    onError: (error) => {
      console.error('ChatKit error:', error);
      setIsGenerating(false);
    },
    onReady: () => {
      setChatkit(chatkit);
    },
  });

  useEffect(() => {
    console.log('Excel ECharts ChatKit Example');
    console.log('Backend:', backendOrigin || '(using proxy)');
    console.log('Assistant ID:', assistantId);
  }, [backendOrigin, assistantId]);

  // Handle "Generate Chart" button click
  const handleGenerateChart = () => {
    if (!excelData) {
      alert(t('alerts.uploadFirst'));
      return;
    }

    setIsGenerating(true);
    setRenderError(null);

    // Prepare data summary for the AI
    const dataSummary = {
      fileName: excelData.fileName,
      headers: excelData.headers,
      rowCount: excelData.rows.length,
      sampleRows: excelData.rows.slice(0, 10),
    };

    // Send message to chat with Excel data
    const message = t('chatkit.message.generateChart', {
      fileName: excelData.fileName,
      headers: excelData.headers.join(', '),
      rowCount: excelData.rows.length,
      sampleRows: JSON.stringify(dataSummary.sampleRows, null, 2),
    });

    chatkit.sendUserMessage({ text: message });
  };

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = event.target.value as SupportedLocale;
    setLocale(nextLocale);
    setLanguage(nextLocale);
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel - Excel & Chart */}
      <div className="w-1/2 p-4 border-r border-gray-300 bg-white flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{t('ui.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600" htmlFor="language-select">
              {t('ui.languageLabel')}
            </label>
            <select
              id="language-select"
              value={locale}
              onChange={handleLocaleChange}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
            >
              <option value="en-US">{t('ui.languageEnglish')}</option>
              <option value="zh-CN">{t('ui.languageChinese')}</option>
            </select>
            <ExcelUploader />
          </div>
        </div>

        {/* Excel Table Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-600">{t('ui.dataPreview')}</h2>
            {excelData && (
              <span className="text-xs text-gray-500">
                {t('ui.tableSummary', {
                  columnCount: excelData.headers.length,
                  rowCount: excelData.rows.length,
                })}
              </span>
            )}
          </div>
          <ExcelTable />
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerateChart}
            disabled={!excelData}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              excelData
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {t('ui.generateButton')}
          </button>
        </div>

        {/* Chart Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-sm font-medium text-gray-600 mb-2">{t('ui.chartOutput')}</h2>
          <EChartsRenderer />
        </div>
      </div>

      {/* Right Panel - Chat */}
      <ChatKit control={chatkit.control} className="flex-1" />
    </div>
  );
}
