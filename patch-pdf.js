import fs from 'fs';

function patchFile(file) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Add serverTime extraction
    if (!code.includes('const serverDateStr = res.headers.get("date");')) {
        code = code.replace(
            'const data = await res.json();',
            'const serverDateStr = res.headers.get("date") || undefined;\n        const data = await res.json();'
        );
    }
    
    // Pass serverDateStr to the generate functions
    code = code.replaceAll(
        'format === "print" ? "print" : "download",\n          );',
        'format === "print" ? "print" : "download",\n            serverDateStr\n          );'
    );
    
    // Some functions in outstanding use different ending
    code = code.replaceAll(
        'format === "print" ? "print" : "download",\n\t\t\t\t\t);',
        'format === "print" ? "print" : "download",\n\t\t\t\t\t\tserverDateStr\n\t\t\t\t\t);'
    );
    
    fs.writeFileSync(file, code);
}

patchFile('src/components/report-download-buttons.tsx');
patchFile('src/components/outstanding-download-buttons.tsx');
console.log("Patched download buttons!");

const file = 'src/lib/pdf.ts';
let code = fs.readFileSync(file, 'utf8');

const footerFunc = `
function addFooterToAllPages(doc: jsPDF, mrName: string | undefined, serverTimeStr: string | undefined) {
  const pageCount = (doc.internal as any).getNumberOfPages();
  const personName = mrName || "Unknown";
  
  let dateObj = serverTimeStr ? new Date(serverTimeStr) : new Date();
  
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  let hh = dateObj.getHours();
  const min = String(dateObj.getMinutes()).padStart(2, "0");
  const ss = String(dateObj.getSeconds()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  const strHh = String(hh).padStart(2, "0");
  
  const formattedDate = \`\${dd}/\${mm}/\${yyyy} \${strHh}:\${min}:\${ss} \${ampm}\`;
  const footerText = \`\${personName} (\${formattedDate})\`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    // Print at bottom right
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.text(footerText, pageWidth - 14, pageHeight - 5, { align: 'right' });
  }
}
`;

// 1. Add footerFunc after imports
code = code.replace('import autoTable from "jspdf-autotable";', 'import autoTable from "jspdf-autotable";\n' + footerFunc);

// 2. Change all function signatures to include serverTimeStr
code = code.replace(/action: "download" \| "print" = "download",\n\)/g, 'action: "download" | "print" = "download",\n  serverTimeStr?: string\n)');

// 3. Inject addFooterToAllPages before `if (action === "print") {`
// But wait, there are 10 occurrences. We can just replace ALL `if (action === "print") {`
code = code.replaceAll('  if (action === "print") {', '  addFooterToAllPages(doc, mrName, serverTimeStr);\n  if (action === "print") {');

fs.writeFileSync(file, code);
console.log("Patched pdf.ts successfully!");
