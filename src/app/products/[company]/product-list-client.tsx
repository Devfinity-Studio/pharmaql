"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Product = {
  id: string;
  name: string;
  ingredients: string | null;
  freeScheme: string | null;
  division: string | null;
};

export function ProductListClient({
  initialCompany,
  allCompanies,
  products,
}: {
  initialCompany: string;
  allCompanies: string[];
  products: Product[];
}) {
  const router = useRouter();
  const [nameFilter, setNameFilter] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState("");

  const filteredProducts = products.filter((p) => {
    const matchesName = p.name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesIngredients = p.ingredients
      ? p.ingredients.toLowerCase().includes(ingredientFilter.toLowerCase())
      : ingredientFilter === ""; // If searching for ingredients, and product has none, it shouldn't match unless filter is empty

    return matchesName && matchesIngredients;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <div>
          <label className="mb-1 block font-bold text-gray-700 text-sm">
            Search by Name
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="e.g. Paracetamol..."
            type="text"
            value={nameFilter}
          />
        </div>
        <div>
          <label className="mb-1 block font-bold text-gray-700 text-sm">
            Search by Ingredients
          </label>
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setIngredientFilter(e.target.value)}
            placeholder="e.g. Ibuprofen..."
            type="text"
            value={ingredientFilter}
          />
        </div>
        <div>
          <label className="mb-1 block font-bold text-gray-700 text-sm">
            Company
          </label>
          <select
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              const newCompany = e.target.value;
              if (newCompany) {
                router.push(`/products/${encodeURIComponent(newCompany)}`);
              }
            }}
            value={initialCompany}
          >
            {allCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
                Ingredients
              </th>
              <th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
                Division
              </th>
              <th className="px-6 py-4 text-left font-bold text-gray-500 text-xs uppercase tracking-wider">
                Scheme
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredProducts.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-center text-gray-500" colSpan={4}>
                  No products found matching your search.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr className="transition hover:bg-gray-50" key={p.id}>
                  <td className="px-6 py-4 font-bold text-gray-900 text-sm">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {p.ingredients || (
                      <span className="text-gray-400 italic">
                        Not specified
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {p.division || "-"}
                  </td>
                  <td className="px-6 py-4 font-semibold text-blue-600 text-sm">
                    {p.freeScheme || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
