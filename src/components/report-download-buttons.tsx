"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ReportDownloadButtons({ mrId }: { mrId: string }) {
  const searchParams = useSearchParams();
  const company = searchParams.get("company") || "All";
  const defaultFrom = searchParams.get("from") || "";
  const defaultTo = searchParams.get("to") || "";

  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "excel">("csv");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const openModal = (fmt: "csv" | "excel") => {
    setFormat(fmt);
    setFrom(defaultFrom);
    setTo(defaultTo);
    setIsOpen(true);
  };

  const handleDownload = () => {
    const params = new URLSearchParams();
    params.set("mrId", mrId);
    params.set("company", company);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("format", format);
    window.location.href = `/api/reports/download?${params.toString()}`;
    setIsOpen(false);
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => openModal("csv")}
          className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 h-[42px]"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          CSV
        </button>
        <button
          onClick={() => openModal("excel")}
          className="bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 h-[42px]"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          Excel
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Download {format === "csv" ? "CSV" : "Excel"} Report
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Select the date range for your report. Leave blank to download all
              available data.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-white text-gray-700 border border-gray-300 font-bold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 bg-emerald-600 text-white border border-emerald-700 font-bold py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
