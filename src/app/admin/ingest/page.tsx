"use client";

import { useState } from "react";
import { ingestCSV } from "@/server/actions/ingest";

export default function AdminIngestPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await ingestCSV(formData);
      if (res.success) {
        setMessage({ type: "success", text: res.message || "CSV Uploaded!" });
      } else {
        setMessage({
          type: "error",
          text: res.error || "Failed to upload CSV",
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: "An unexpected error occurred" });
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-bold text-3xl text-gray-900">Data Ingestion</h1>
        <p className="mt-2 text-gray-600">
          Upload the Technomax CSV file to update stock, schemes, and MR sales
          data.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-gray-700 text-sm">
                Sync Mode (Stock)
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    defaultChecked
                    id="sync-incremental"
                    name="syncMode"
                    type="radio"
                    value="incremental"
                  />
                  <label
                    className="ml-3 block font-medium text-gray-700 text-sm"
                    htmlFor="sync-incremental"
                  >
                    Incremental Sync (Add to existing stock)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    id="sync-full"
                    name="syncMode"
                    type="radio"
                    value="full"
                  />
                  <label
                    className="ml-3 block font-medium text-gray-700 text-sm"
                    htmlFor="sync-full"
                  >
                    Full Sync (Overwrite existing stock)
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label
                className="block font-medium text-gray-700 text-sm"
                htmlFor="file"
              >
                Technomax CSV File
              </label>
              <input
                accept=".csv"
                className="mt-2 block w-full rounded-md border border-gray-300 p-2 text-gray-500 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 file:text-sm hover:file:bg-blue-100"
                id="file"
                name="file"
                required
                type="file"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? "Uploading & Processing..." : "Upload CSV"}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`mt-4 rounded-md p-4 ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-blue-800 text-sm">
        <strong>
          Expected CSV Format (Headers Optional, but order matters):
        </strong>
        <br />
        ProductName, StockQty, FreeScheme, MR_Email, SaleQty, SaleNotes
      </div>
    </div>
  );
}
