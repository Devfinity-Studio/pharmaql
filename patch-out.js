import fs from 'fs';

let file = 'src/components/outstanding-download-buttons.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = 'from,\n\t\t\t\t\tto,\n\t\t\t\t);';
if (code.includes(target)) {
    code = code.replace(target, 'from,\n\t\t\t\t\tto,\n\t\t\t\t\tformat === "print" ? "print" : "download",\n\t\t\t\t\tserverDateStr\n\t\t\t\t);');
    fs.writeFileSync(file, code);
    console.log("Patched outstanding");
} else {
    // maybe \r\n
    const target2 = 'from,\r\n\t\t\t\t\tto,\r\n\t\t\t\t);';
    if (code.includes(target2)) {
        code = code.replace(target2, 'from,\r\n\t\t\t\t\tto,\r\n\t\t\t\t\tformat === "print" ? "print" : "download",\r\n\t\t\t\t\tserverDateStr\r\n\t\t\t\t);');
        fs.writeFileSync(file, code);
        console.log("Patched outstanding CRLF");
    } else {
        console.log("Could not find target");
    }
}
