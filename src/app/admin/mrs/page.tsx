import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { user, mrManufacturers, products } from "@/server/db/schema";
import { eq, sql, ilike, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  assignManufacturer,
  unassignManufacturer,
  toggleMRBlockStatus,
  updateMRPermissions,
} from "@/server/actions/mrs";
import Link from "next/link";

export default async function AdminMRsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const awaitedParams = await searchParams;
  const searchQuery = awaitedParams.search || "";

  // Get MRs with search filter
  let allMRs;
  if (searchQuery) {
    allMRs = await db
      .select()
      .from(user)
      .where(
        or(
          ilike(user.name, `%${searchQuery}%`),
          ilike(user.email, `%${searchQuery}%`),
        ),
      );
  } else {
    allMRs = await db.select().from(user).where(eq(user.role, "MR"));
  }

  // Filter out non-MRs if search hit an admin
  allMRs = allMRs.filter((u) => u.role === "MR");

  // Get all unique manufacturers currently in products table
  const allManufacturers = await db
    .selectDistinct({ manufacturer: products.manufacturer })
    .from(products)
    .where(sql`${products.manufacturer} IS NOT NULL`);

  // Get all assignments
  const allAssignments = await db.select().from(mrManufacturers);

  return (
    <div className="space-y-8 mt-4">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          MR Data Access Management
        </h1>
        <p className="text-gray-500 mt-2 font-medium">
          Assign specific Manufacturers to Medical Representatives and view
          their data.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
        <form method="GET" className="flex flex-grow gap-4">
          <input
            type="text"
            name="search"
            placeholder="Search MRs by name or email..."
            defaultValue={searchQuery}
            className="flex-grow bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 outline-none font-medium"
          />
          <button
            type="submit"
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-2 px-6 rounded-xl shadow-sm transition"
          >
            Search
          </button>
          {searchQuery && (
            <Link
              href="/admin/mrs"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl shadow-sm transition"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {allMRs.map((mr) => {
          const assignments = allAssignments.filter((a) => a.mrId === mr.id);
          const unassignedManufacturers = allManufacturers.filter(
            (m) => !assignments.some((a) => a.manufacturer === m.manufacturer),
          );

          return (
            <div
              key={mr.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full relative"
            >
              <div className="mb-4 flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{mr.name}</h3>
                  <p className="text-sm text-gray-500">{mr.email}</p>
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await toggleMRBlockStatus(mr.id, !mr.isBlocked);
                    }}
                  >
                    <button
                      type="submit"
                      className={`font-bold py-1 px-3 rounded-lg text-xs whitespace-nowrap transition ${
                        mr.isBlocked
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {mr.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/mrs/${mr.id}`}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-1 px-3 rounded-lg text-xs whitespace-nowrap transition"
                  >
                    View Data &rarr;
                  </Link>
                </div>
              </div>

              <div className="flex-grow space-y-4">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Assigned Data
                </h4>
                {assignments.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">
                    No manufacturers assigned.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100"
                      >
                        <span className="text-sm font-semibold text-blue-900">
                          {a.manufacturer}
                        </span>
                        <form
                          action={async () => {
                            "use server";
                            await unassignManufacturer(a.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-xs font-bold text-red-500 hover:text-red-700 p-1"
                          >
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 space-y-4">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  Permissions
                </h4>
                <form
                  action={async (formData) => {
                    "use server";
                    await updateMRPermissions(mr.id, {
                      canViewFreeScheme:
                        formData.get("canViewFreeScheme") === "on",
                      canViewStock: formData.get("canViewStock") === "on",
                      canViewSales: formData.get("canViewSales") === "on",
                    });
                  }}
                  className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="canViewFreeScheme"
                      defaultChecked={mr.canViewFreeScheme ?? true}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Free Scheme
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="canViewStock"
                      defaultChecked={mr.canViewStock ?? true}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Stock Reports
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="canViewSales"
                      defaultChecked={mr.canViewSales ?? true}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Sales Reports
                  </label>
                  <button
                    type="submit"
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline mt-2"
                  >
                    Save Permissions
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <form
                  action={async (formData) => {
                    "use server";
                    const mfg = formData.get("manufacturer") as string;
                    if (mfg) await assignManufacturer(mr.id, mfg);
                  }}
                  className="flex gap-2"
                >
                  <select
                    name="manufacturer"
                    className="flex-grow bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none font-medium"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Select Manufacturer
                    </option>
                    {unassignedManufacturers.map((m) => (
                      <option key={m.manufacturer} value={m.manufacturer}>
                        {m.manufacturer}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition"
                  >
                    Assign
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        {allMRs.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            {searchQuery
              ? "No MRs found matching your search."
              : "No Medical Representatives found."}
          </div>
        )}
      </div>
    </div>
  );
}
