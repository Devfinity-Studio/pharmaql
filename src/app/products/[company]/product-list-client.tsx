"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Search by Name
          </label>
          <input
            type="text"
            placeholder="e.g. Paracetamol..."
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Search by Ingredients
          </label>
          <input
            type="text"
            placeholder="e.g. Ibuprofen..."
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            value={ingredientFilter}
            onChange={(e) => setIngredientFilter(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">
            Company
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
            value={initialCompany}
            onChange={(e) => {
              const newCompany = e.target.value;
              if (newCompany) {
                router.push(`/products/${encodeURIComponent(newCompany)}`);
              }
            }}
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Ingredients
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Division
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                Scheme
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No products found matching your search.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {p.ingredients || (
                      <span className="italic text-gray-400">
                        Not specified
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {p.division || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">
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
