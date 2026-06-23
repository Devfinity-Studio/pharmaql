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
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <label className="mb-1 block font-bold text-gray-500 text-xs uppercase tracking-wider">
          From Date
        </label>
        <input
          className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
          onChange={(e) => setFrom(e.target.value)}
          type="date"
          value={from}
        />
      </div>
      <div>
        <label className="mb-1 block font-bold text-gray-500 text-xs uppercase tracking-wider">
          To Date
        </label>
        <input
          className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
          onChange={(e) => setTo(e.target.value)}
          type="date"
          value={to}
        />
      </div>
      <button
        className="h-[42px] rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-blue-700"
        onClick={applyFilter}
      >
        Apply
      </button>
      {(currentFrom || currentTo) && (
        <button
          className="h-[42px] rounded-xl bg-gray-100 px-6 py-2.5 font-bold text-gray-700 shadow-sm transition hover:bg-gray-200"
          onClick={clearFilter}
        >
          Clear
        </button>
      )}
    </div>
  );
}
