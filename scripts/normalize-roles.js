#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import { connectToDatabase } from '../utils/db.js';
import User from '../models/User.js';

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

const normalize = (x) => {
  if (!x) return '';
  let s = String(x).trim().toLowerCase();
  if (s === 'responsable') s = 'responsible';
  return s;
};

async function main(){
  const args = parseArgs();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment. Set it before running this script.');
    process.exit(1);
  }

  await connectToDatabase(uri);

  const users = await User.find({}, 'role username email name').lean();
  const toChange = [];
  for (const u of users) {
    const old = u.role || '';
    const norm = normalize(old);
    if (norm && norm !== String(old).trim().toLowerCase()) {
      toChange.push({ _id: u._id, username: u.username, email: u.email, name: u.name, old: old, norm });
    }
  }

  console.log(`Found ${toChange.length} user(s) with role values that would be normalized.`);
  if (toChange.length > 0) {
    console.table(toChange.slice(0, 200).map(u => ({ _id: String(u._id), username: u.username, email: u.email, old: u.old, norm: u.norm })));
    if (args.apply) {
      console.log('Applying changes...');
      let applied = 0;
      for (const c of toChange) {
        try {
          const res = await User.updateOne({ _id: c._id }, { $set: { role: c.norm } }).exec();
          if (res.modifiedCount === 1 || res.nModified === 1 || res.modifiedCount === undefined) applied++;
        } catch (err) {
          console.error('Failed to update', c._id, err && err.message ? err.message : err);
        }
      }
      console.log(`Applied updates to ${applied}/${toChange.length} users.`);
    } else {
      console.log('Dry-run mode: no changes applied. Re-run with `--apply` to perform updates.');
    }
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
