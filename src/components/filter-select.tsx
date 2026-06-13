"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function FilterSelect({
  paramName,
  options,
  defaultValue = "",
  placeholder = "All",
}: {
  paramName: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentVal = searchParams.get(paramName) || defaultValue;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set(paramName, val);
    } else {
      params.delete(paramName);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      className="w-full appearance-none bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
      value={currentVal}
      onChange={handleChange}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
