"use client";

import { useSearchParams } from "next/navigation";

export function ReportDownloadButtons({ mrId }: { mrId: string }) {
  const searchParams = useSearchParams();
  const company = searchParams.get("company") || "All";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const buildUrl = (format: "csv" | "excel") => {
    const params = new URLSearchParams();
    params.set("mrId", mrId);
    params.set("company", company);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("format", format);
    return `/api/reports/download?${params.toString()}`;
  };

  return (
    <div className="flex gap-2">
      <a
        href={buildUrl("csv")}
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
      </a>
      <a
        href={buildUrl("excel")}
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
      </a>
    </div>
  );
}
