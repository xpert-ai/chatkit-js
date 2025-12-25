import { create } from 'zustand';
import type { UseChatKitReturn } from '@xpert-ai/chatkit-react';
import type { EChartsOption } from 'echarts';

export interface ExcelData {
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
}

interface AppState {
  // Excel data
  excelData: ExcelData | null;
  setExcelData: (data: ExcelData | null) => void;

  // ECharts option
  echartsOption: EChartsOption | null;
  setEchartsOption: (option: EChartsOption | null) => void;

  // Render status
  renderError: string | null;
  setRenderError: (error: string | null) => void;

  // ChatKit instance
  chatkit: UseChatKitReturn | null;
  setChatkit: (chatkit: UseChatKitReturn | null) => void;

  // Loading state
  isGenerating: boolean;
  setIsGenerating: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  excelData: null,
  setExcelData: (data) => set({ excelData: data }),

  echartsOption: null,
  setEchartsOption: (option) => set({ echartsOption: option }),

  renderError: null,
  setRenderError: (error) => set({ renderError: error }),

  chatkit: null,
  setChatkit: (chatkit) => set({ chatkit }),

  isGenerating: false,
  setIsGenerating: (loading) => set({ isGenerating: loading }),
}));
