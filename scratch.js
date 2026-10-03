import fs from 'fs';

const file = 'src/lib/pdf.ts';
let code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');
lines.forEach((line, i) => {
    if (line.includes('export function generate')) {
        console.log(`Func at ${i + 1}: ${line.trim()}`);
    }
    if (line.includes('doc.autoPrint()')) {
        console.log(`Print at ${i + 1}`);
    }
});
