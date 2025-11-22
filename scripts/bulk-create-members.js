#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import { connectToDatabase } from '../utils/db.js';
import Member from '../models/Member.js';
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k,v] = a.split('=');
      out[k.replace(/^--/,'')] = v === undefined ? true : v;
    } else if (a.includes('=')) {
      const [k,v] = a.split('=');
      out[k.replace(/^--/,'')] = v;
    }
  }
  return out;
}

async function main(){
  const args = parseArgs();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment. Set it or export it before running this script.');
    process.exit(1);
  }
  await connectToDatabase(uri);

  if (args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }
    let raw = fs.readFileSync(filePath, 'utf8');
    let items;
    try { items = JSON.parse(raw); } catch (err) { console.error('Failed to parse JSON file:', err.message); process.exit(1); }
    if (!Array.isArray(items)) {
      console.error('JSON file must contain an array of member objects');
      process.exit(1);
    }
    console.log(`Importing ${items.length} members via Mongoose (pre-save hooks will run)`);
    let created = 0, failed = 0;
    for (const it of items) {
      try {
        // ensure minimal required fields
        if (!it.fullName) it.fullName = it.name || ('Imported ' + Date.now());
        if (!it.memberType) it.memberType = 'active';
        const m = new Member(it);
        await m.save();
        created++;
      } catch (err) {
        failed++;
        console.error('Failed to save', it.fullName || it.email || '(no name)', err && err.message ? err.message : err);
      }
    }
    console.log('Done. created=', created, 'failed=', failed);
    process.exit(0);
  }

  const count = parseInt(args.count || args.c || '10', 10);
  console.log('Creating', count, 'synthetic members');
  let created = 0;
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Date.now() / 1000) % 100000 + i;
    const payload = {
      fullName: `Bulk Test ${seed}`,
      phone: `06${Math.floor(100000 + Math.random() * 899999)}`,
      email: `bulk${seed}@example.com`,
      memberType: 'active',
      status: 'active',
    };
    // Do NOT auto-set `membershipDate` here — membership date must be provided explicitly.
    try {
      const m = new Member(payload);
      await m.save();
      console.log('Created', m._id.toString(), 'membershipId=', m.membershipId);
      created++;
    } catch (err) {
      console.error('Create failed for', payload.fullName, err && err.message ? err.message : err);
    }
  }
  console.log('Finished. created=', created);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
