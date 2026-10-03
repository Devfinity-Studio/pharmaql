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
