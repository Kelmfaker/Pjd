import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const outDir = path.resolve('./tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const rows = [
  { "الاسم": "أحمد بن علي", "الهاتف": "0600000001", "البريد الإلكتروني": "ahmed@example.com", "المهمة": "الملف المالي", "نوع العضوية": "bureau", "الحالة": "active", "تاريخ العضوية": "2020-05-10" },
  { "الاسم": "فاطمة الزهراء", "الهاتف": "0600000002", "البريد الإلكتروني": "fatima@example.com", "المهمة": "التنسيق", "نوع العضوية": "active", "الحالة": "active", "تاريخ العضوية": "2021-03-15" },
  { "الاسم": "يوسف محمد", "الهاتف": "0600000003", "البريد الإلكتروني": "youssef@example.com", "المهمة": "other", "المهمة (نص)": "الاعلام المحلي", "نوع العضوية": "sympathizer", "الحالة": "inactive", "تاريخ العضوية": "2019-11-20" }
];

const ws = XLSX.utils.json_to_sheet(rows);
const wb = { SheetNames: ['Members'], Sheets: { 'Members': ws } };
const outPath = path.join(outDir, 'members-sample.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Wrote sample excel to', outPath);
