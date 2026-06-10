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
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Ingestion</h1>
        <p className="text-gray-600 mt-2">
          Upload the Technomax CSV file to update stock, schemes, and MR sales
          data.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sync Mode (Stock)
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    id="sync-incremental"
                    name="syncMode"
                    type="radio"
                    value="incremental"
                    defaultChecked
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="sync-incremental"
                    className="ml-3 block text-sm font-medium text-gray-700"
                  >
                    Incremental Sync (Add to existing stock)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="sync-full"
                    name="syncMode"
                    type="radio"
                    value="full"
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="sync-full"
                    className="ml-3 block text-sm font-medium text-gray-700"
                  >
                    Full Sync (Overwrite existing stock)
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="file"
                className="block text-sm font-medium text-gray-700"
              >
                Technomax CSV File
              </label>
              <input
                type="file"
                name="file"
                id="file"
                accept=".csv"
                required
                className="mt-2 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 border border-gray-300 rounded-md p-2"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Uploading & Processing..." : "Upload CSV"}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`mt-4 p-4 rounded-md ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <strong>
          Expected CSV Format (Headers Optional, but order matters):
        </strong>
        <br />
        ProductName, StockQty, FreeScheme, MR_Email, SaleQty, SaleNotes
      </div>
    </div>
  );
}
