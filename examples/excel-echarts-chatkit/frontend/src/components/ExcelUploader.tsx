import { useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore, ExcelData } from '../store/useAppStore';

export function ExcelUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { excelData, setExcelData, setEchartsOption, setRenderError } = useAppStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header
      const jsonData = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
        header: 1,
        defval: ''
      });

      if (jsonData.length === 0) {
        alert('Excel file is empty');
        return;
      }

      // First row as headers
      const headers = jsonData[0].map(String);
      const rows = jsonData.slice(1);

      const data: ExcelData = {
        headers,
        rows,
        fileName: file.name,
      };

      setExcelData(data);
      // Reset chart when new file is uploaded
      setEchartsOption(null);
      setRenderError(null);
    } catch (error) {
      console.error('Failed to parse Excel file:', error);
      alert('Failed to parse Excel file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
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
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Upload Excel
      </button>
      {excelData && (
        <span className="text-sm text-gray-600">
          {excelData.fileName}
        </span>
      )}
    </div>
  );
}
