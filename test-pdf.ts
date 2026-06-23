import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function generatePdfReport(title: string, filename: string, data: any[]) {
	const doc = new jsPDF("landscape");

	doc.setFontSize(18);
	doc.text(title, 14, 22);
	doc.setFontSize(11);
	doc.setTextColor(100);
	doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

	if (data.length === 0) {
		doc.text("No data available for the selected filters.", 14, 40);
		// don't save to file system here, just want to see if it throws
		return;
	}

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

	console.log("PDF generation success");
}

try {
	generatePdfReport("Test", "test.pdf", [{ Name: "Test", Total: 12 }]);
} catch (e) {
	console.error("FAILED", e);
}
