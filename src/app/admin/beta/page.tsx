'use client';

import { useState } from 'react';
import { getStockMovement } from '@/server/actions/stockreports'; // Make sure this path matches your setup

export default function StockReportForm() {
  const [companyCode, setCompanyCode] = useState("1");
  const [fromDate, setFromDate] = useState("2026-10-01");
  const [toDate, setToDate] = useState("2026-10-11");
  const [results, setResults] = useState<any[] | null>(null);

  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    
    const response = await getStockMovement(companyCode, fromDate, toDate);
    
    if (response.success) {
      setResults(response.data);
    } else {
      alert("Failed to load report. Check console.");
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4">
      <form onSubmit={handleGenerateReport} className="flex flex-col gap-4 max-w-sm">
        <label>
          Company Code:
          <input 
            type="text" 
            value={companyCode} 
            onChange={(e) => setCompanyCode(e.target.value)} 
            className="border p-1 w-full text-black"
          />
        </label>
        
        <label>
          From Date:
          <input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)} 
            className="border p-1 w-full text-black"
          />
        </label>

        <label>
          To Date:
          <input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)} 
            className="border p-1 w-full text-black"
          />
        </label>

        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Generate Report
        </button>

        {results && <p className="font-semibold text-green-600">Loaded {results.length} rows successfully!</p>}
      </form>

      {/* --- RAW DATABASE OUTPUT TABLE --- */}
      {results && results.length > 0 && (
        <div className="w-full overflow-x-auto rounded border-2 border-red-500 bg-white p-4">
          <p className="mb-2 font-bold text-red-600">
            Raw Database Columns & Values (Check the exact capitalization of the headers!):
          </p>
          <table className="min-w-full border-collapse border border-gray-300 text-xs text-black">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(results[0]).map((key) => (
                  <th key={key} className="whitespace-nowrap border border-gray-300 px-2 py-1 font-bold text-left">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row: any, rowIndex: number) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {Object.values(row).map((val: any, colIndex: number) => (
                    <td key={colIndex} className="whitespace-nowrap border border-gray-300 px-2 py-1">
                      {val !== null ? String(val) : "null"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results && results.length === 0 && (
        <p className="text-red-500 font-medium">The procedure returned an empty array (0 rows) for these filters.</p>
      )}
    </div>
  );
}