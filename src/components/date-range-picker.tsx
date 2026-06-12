"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);

  const applyFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");

    if (to) params.set("to", to);
    else params.delete("to");

    router.push(`?${params.toString()}`);
  };

  const clearFilter = () => {
    setFrom("");
    setTo("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
          From Date
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none font-medium"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
          To Date
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none font-medium"
        />
      </div>
      <button
        onClick={applyFilter}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition h-[42px]"
      >
        Apply
      </button>
      {(currentFrom || currentTo) && (
        <button
          onClick={clearFilter}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-6 rounded-xl shadow-sm transition h-[42px]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
