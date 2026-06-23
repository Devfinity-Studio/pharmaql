import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function generatePdfReport(
  title: string,
  filename: string,
  data: any[],
  mrName?: string,
) {
  const doc = new jsPDF("landscape");

  // Add Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);

  const formattedDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (mrName) {
    doc.text(`MR: ${mrName}  |  Generated on: ${formattedDate}`, 14, 30);
  } else {
    doc.text(`Generated on: ${formattedDate}`, 14, 30);
  }

  if (data.length === 0) {
    doc.text("No data available for the selected filters.", 14, 40);
    doc.save(filename);
    return;
  }

  // Extract columns dynamically from the first object
  const columns = Object.keys(data[0]);
  const rows = data.map((row) => columns.map((col) => row[col]));

  autoTable(doc, {
    startY: 35,
    head: [columns],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [4, 120, 87] }, // Emerald 700
    styles: { fontSize: 10, cellPadding: 4 },
  });

  doc.save(filename);
}
