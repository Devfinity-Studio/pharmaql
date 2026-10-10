import fs from 'fs';

const files = [
    'src/app/admin/notices/NoticeListClient.tsx',
    'src/components/notice-modal.tsx'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/\\`/g, '`');
        content = content.replace(/\\\${/g, '${');
        fs.writeFileSync(file, content);
        console.log(`Fixed ${file}`);
    }
}
