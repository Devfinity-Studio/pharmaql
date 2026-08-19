"use client";

import { ArrowUpDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export function MRSearchForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "name_asc");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("sort", sort);
    router.push(`/admin/mrs?${params.toString()}`);
  };

  const handleSort = (newSort: string) => {
    setSort(newSort);
    setIsSortOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("sort", newSort);
    router.push(`/admin/mrs?${params.toString()}`);
  };

  const sortOptions = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "company_asc", label: "Company A-Z" },
    { value: "email_asc", label: "Email A-Z" },
  ];

  return (
    <form
      className="flex flex-grow flex-col gap-4 sm:flex-row"
      onSubmit={handleSubmit}
    >
      <input
        className="block w-full flex-grow rounded-xl border border-gray-200 bg-gray-50 p-3 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search MRs by name, email, or company..."
        type="text"
        value={search}
      />

      <div className="relative flex items-center" ref={dropdownRef}>
        <button
          className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setIsSortOpen(!isSortOpen)}
          title="Sort options"
          type="button"
        >
          <ArrowUpDown className="h-5 w-5" />
        </button>
        {isSortOpen && (
          <div className="absolute right-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-blue-50 ${
                  sort === opt.value
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "font-medium text-gray-700"
                }`}
                onClick={() => handleSort(opt.value)}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-gray-800"
        type="submit"
      >
        Search
      </button>

      {search && (
        <button
          className="flex items-center justify-center rounded-xl bg-gray-100 px-6 py-3 font-bold text-gray-700 shadow-sm transition hover:bg-gray-200"
          onClick={() => {
            setSearch("");
            const params = new URLSearchParams(searchParams.toString());
            params.delete("search");
            router.push(`/admin/mrs?${params.toString()}`);
          }}
          type="button"
        >
          Clear
        </button>
      )}
    </form>
  );
}
