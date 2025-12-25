import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useAppStore } from '../store/useAppStore';

export function EChartsRenderer() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { echartsOption, renderError, isGenerating } = useAppStore();

  // Initialize chart instance when ref is available
  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart if not already done
    if (!chartInstance.current) {
      console.log('[EChartsRenderer] Initializing echarts instance');
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Render chart when option changes
  useEffect(() => {
    if (!echartsOption) {
      console.log('[EChartsRenderer] No option to render');
      return;
    }

    // Ensure chart instance is initialized
    if (!chartInstance.current && chartRef.current) {
      console.log('[EChartsRenderer] Initializing echarts instance (in option effect)');
      chartInstance.current = echarts.init(chartRef.current);
    }

    if (!chartInstance.current) {
      console.log('[EChartsRenderer] Chart instance not available yet');
      return;
    }

    try {
      console.log('[EChartsRenderer] Setting option:', echartsOption);
      chartInstance.current.setOption(echartsOption, true);
      chartInstance.current.resize();
      console.log('[EChartsRenderer] Chart rendered successfully');
    } catch (error) {
      console.error('[EChartsRenderer] Failed to render chart:', error);
    }
  }, [echartsOption]);

  // Resize chart when switching from loading/error state to chart view
  useEffect(() => {
    if (!isGenerating && !renderError && echartsOption && chartInstance.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        chartInstance.current?.resize();
      }, 100);
    }
  }, [isGenerating, renderError, echartsOption]);

  // Determine what to show
  const showLoading = isGenerating;
  const showError = !isGenerating && renderError;
  const showPlaceholder = !isGenerating && !renderError && !echartsOption;
  const showChart = !isGenerating && !renderError && echartsOption;

  return (
    <div className="flex-1 flex flex-col min-h-[300px] relative">
      {/* Always render the chart div, but hide it when not showing chart */}
      <div
        ref={chartRef}
        className={`absolute inset-0 border border-gray-200 rounded-lg ${showChart ? 'block' : 'hidden'}`}
      />

      {/* Loading state */}
      {showLoading && (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-blue-600">Generating chart...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {showError && (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-red-300 rounded-lg bg-red-50">
          <div className="text-center text-red-600 p-4">
            <svg
              className="w-10 h-10 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-medium">Render Error</p>
            <p className="text-sm mt-1">{renderError}</p>
          </div>
        </div>
      )}

      {/* Placeholder */}
      {showPlaceholder && (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <div className="text-center text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
              />
            </svg>
            <p>Chart will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
