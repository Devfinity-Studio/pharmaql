import fs from 'fs';

const file = 'src/lib/pdf.ts';
let code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');

const printIndices = [];
lines.forEach((line, i) => {
    if (line.includes('if (action === "print") {') || line.includes('doc.autoPrint()')) {
        printIndices.push(i);
    }
});

printIndices.forEach(idx => {
    console.log(`\n--- Around line ${idx + 1} ---`);
    for(let i = idx - 2; i <= idx + 2; i++) {
        if (lines[i]) console.log(`${i+1}: ${lines[i].trimRight()}`);
    }
});
