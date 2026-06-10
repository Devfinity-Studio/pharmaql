import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { user, mrManufacturers, products } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { assignManufacturer, unassignManufacturer } from "@/server/actions/mrs";

export default async function AdminMRsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Get all MRs
  const allMRs = await db.select().from(user).where(eq(user.role, "MR"));
  
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
        <h1 className="text-3xl font-extrabold text-gray-900">MR Data Access Management</h1>
        <p className="text-gray-500 mt-2 font-medium">Assign specific Manufacturers to Medical Representatives. MRs will only be able to view reports for products belonging to their assigned Manufacturers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {allMRs.map((mr) => {
          const assignments = allAssignments.filter(a => a.mrId === mr.id);
          const unassignedManufacturers = allManufacturers.filter(m => !assignments.some(a => a.manufacturer === m.manufacturer));

          return (
            <div key={mr.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{mr.name}</h3>
                <p className="text-sm text-gray-500">{mr.email}</p>
              </div>

              <div className="flex-grow space-y-4">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Assigned Data</h4>
                {assignments.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">No manufacturers assigned.</div>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map(a => (
                      <li key={a.id} className="flex items-center justify-between bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100">
                        <span className="text-sm font-semibold text-blue-900">{a.manufacturer}</span>
                        <form action={async () => {
                          "use server";
                          await unassignManufacturer(a.id);
                        }}>
                          <button type="submit" className="text-xs font-bold text-red-500 hover:text-red-700 p-1">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <form action={async (formData) => {
                  "use server";
                  const mfg = formData.get("manufacturer") as string;
                  if (mfg) await assignManufacturer(mr.id, mfg);
                }} className="flex gap-2">
                  <select 
                    name="manufacturer" 
                    className="flex-grow bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none font-medium"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>Select Manufacturer</option>
                    {unassignedManufacturers.map(m => (
                      <option key={m.manufacturer} value={m.manufacturer}>{m.manufacturer}</option>
                    ))}
                  </select>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition">
                    Assign
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        {allMRs.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            No Medical Representatives found. They will appear here once auto-created via CSV upload or manual sign up.
          </div>
        )}
      </div>
    </div>
  );
}
