import { useAppStore } from '../store/useAppStore';

export function ExcelTable() {
  const { excelData } = useAppStore();

  if (!excelData) {
    return (
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
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>Upload an Excel file to preview data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto excel-table-container border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 bg-gray-200">
              #
            </th>
            {excelData.headers.map((header, index) => (
              <th
                key={index}
                className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {excelData.rows.slice(0, 100).map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-gray-400 border-r border-gray-200 bg-gray-50">
                {rowIndex + 1}
              </td>
              {excelData.headers.map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                >
                  {row[colIndex] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {excelData.rows.length > 100 && (
        <div className="text-center py-2 text-sm text-gray-500 bg-gray-50 border-t">
          Showing first 100 rows of {excelData.rows.length} total
        </div>
      )}
    </div>
  );
}
