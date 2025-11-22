#!/usr/bin/env node
import dotenv from 'dotenv';
import { connectToDatabase } from '../utils/db.js';
import Member from '../models/Member.js';
import fs from 'fs';
import path from 'path';
import { logAudit } from '../utils/audit.js';

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }
  await connectToDatabase(mongoUri);

  const args = process.argv.slice(2);
  const apply = args.includes('--apply') || args.includes('-a');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

  console.log('Dedupe: scanning members', `apply=${apply}`, limit ? `limit=${limit}` : 'no limit');

  const members = await Member.find().lean();
  console.log('Loaded', members.length, 'members');

  // build key->ids map for email, phone, normalized fullName
  const keyMap = new Map();
  function addKey(key, id) {
    if (!key) return;
    const arr = keyMap.get(key) || [];
    arr.push(id);
    keyMap.set(key, arr);
  }

  function normName(name) {
    if (!name) return '';
    return String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function normPhone(p) {
    if (!p) return '';
    return String(p).replace(/[\s\-()]+/g, '').trim();
  }

  for (const m of members) {
  if (m.email) addKey('email:' + String(m.email).toLowerCase().trim(), m._id.toString());
  const pnorm = normPhone(m.phone);
  if (pnorm) addKey('phone:' + pnorm, m._id.toString());
  if (m.fullName) addKey('name:' + normName(m.fullName), m._id.toString());
    if (m.membershipId) addKey('mid:' + String(m.membershipId), m._id.toString());
    if (m.cin) addKey('cin:' + String(m.cin).toUpperCase().trim(), m._id.toString());
  }

  // build graph adjacency based on keys that have >1 ids
  const adj = new Map();
  function ensureNode(id) { if (!adj.has(id)) adj.set(id, new Set()); }
  for (const [k, ids] of keyMap.entries()) {
    if (ids.length <= 1) continue;
    for (let i = 0; i < ids.length; i++) {
      ensureNode(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        ensureNode(ids[j]);
        adj.get(ids[i]).add(ids[j]);
        adj.get(ids[j]).add(ids[i]);
      }
    }
  }

  // find connected components
  const seen = new Set();
  const clusters = [];
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const stack = [id];
    const comp = [];
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      comp.push(cur);
      for (const neigh of adj.get(cur) || []) if (!seen.has(neigh)) stack.push(neigh);
    }
    if (comp.length > 1) clusters.push(comp);
  }

  console.log('Found', clusters.length, 'duplicate clusters');

  const report = [];
  let processed = 0;

  for (const comp of clusters) {
    if (limit && processed >= limit) break;
    // fetch member docs for this cluster
    const docs = members.filter(m => comp.includes(m._id.toString()));
    // choose keeper: prefer membershipId present, otherwise earliest createdAt
    docs.sort((a,b) => {
      if ((a.membershipId?1:0) !== (b.membershipId?1:0)) return (b.membershipId?1:0) - (a.membershipId?1:0);
      // Prefer membershipDate when available (alias), fall back to joinedAt
      return new Date(a.createdAt || a.membershipDate || a.joinedAt || 0) - new Date(b.createdAt || b.membershipDate || b.joinedAt || 0);
    });
    const keeper = docs[0];
    const others = docs.slice(1);

    const merged = { ...keeper };
    const mergedFields = [];
    const concatFields = ['bio','previousPartyExperiences'];

    for (const o of others) {
      for (const key of Object.keys(o)) {
        if (['_id','__v','createdAt','updatedAt'].includes(key)) continue;
        const val = o[key];
        if ((merged[key] === undefined || merged[key] === null || merged[key] === '') && (val !== undefined && val !== null && val !== '')) {
          merged[key] = val;
          mergedFields.push({ field: key, from: o._id.toString() });
        } else if (concatFields.includes(key) && val) {
          // append note if not duplicate
          const existing = merged[key] || '';
          if (!existing.includes(String(val))) merged[key] = (existing ? existing + '\n' : '') + val;
        }
      }
    }

    report.push({ keeper: keeper._id.toString(), group: comp.slice(), mergedFields, others: others.map(o=>o._id.toString()) });

    if (apply) {
      // perform DB operations: update keeper, delete others
      const keeperDoc = await Member.findById(keeper._id);
      if (!keeperDoc) continue;
      for (const f of mergedFields) keeperDoc[f.field] = merged[f.field];
      await keeperDoc.save();
      // audit update
      await logAudit({ user: { id: 'script' } }, 'update', 'Member', keeperDoc._id, null, keeperDoc.toObject());
      const otherIds = others.map(o=>o._id);
      const delRes = await Member.deleteMany({ _id: { $in: otherIds } });
      await logAudit({ user: { id: 'script' } }, 'delete', 'MemberBulk', null, { deleted: otherIds.map(String) }, null);
      report[report.length-1].deletedCount = delRes.deletedCount;
    }

    processed++;
  }

  const outDir = path.resolve('./tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `duplicates-report${apply?'-applied':''}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ clusters: report, apply }, null, 2), 'utf8');
  console.log('Wrote report to', outPath);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
