import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const outDir = path.resolve('./tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Header names that the importer recognizes (include Arabic & English)
const headers = [
  'الاسم', 'fullName',
  'CIN', 'الرقم الوطني',
  'membershipId', 'رقم العضوية',
  'phone', 'الهاتف',
  'email', 'البريد الإلكتروني',
  'address', 'العنوان',
  'dateOfBirth', 'تاريخ الميلاد',
  'تاريخ الانضمام', 'joinedAt',
  'gender', 'الجنس',
  'memberType', 'نوع العضوية',
  'role', 'المهمة', 'educationLevel', 'المستوى الدراسي',
  'occupation', 'المهنة',
  'status', 'الحالة',
  'pdfUrl', 'رابط_PDF',
  'bio', 'سيرة'
];

const row = {};
headers.forEach(h => row[h] = '');
const ws = XLSX.utils.json_to_sheet([row]);
const wb = { SheetNames: ['Template'], Sheets: { 'Template': ws } };
const outPath = path.join(outDir, 'members-template.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Wrote template to', outPath);
