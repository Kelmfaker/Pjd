import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { connectToDatabase } from '../lib/mongoose.js';
dotenv.config();
import Member from '../models/Member.js';
import { updateMember, deleteMember } from '../controllers/membersController.js';

function makeRes() {
  const res = {};
  res._status = 200;
  res.status = function (code) { this._status = code; return this; };
  res.json = function (payload) { console.log('RES', this._status, payload); this._payload = payload; return payload; };
  return res;
}

async function ensureDir(d) {
  try { await fs.mkdir(d, { recursive: true }); } catch (e) { /* ignore */ }
}

async function exists(p) {
  try { await fs.access(p); return true; } catch (e) { return false; }
}

async function run() {
  await connectToDatabase();
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await ensureDir(uploadsDir);

  const t = Date.now();
  const oldName = `old-smoke-${t}.jpg`;
  const newName = `new-smoke-${t}.jpg`;
  const oldPath = path.join(uploadsDir, oldName);
  const newPath = path.join(uploadsDir, newName);

  // create placeholder old file
  await fs.writeFile(oldPath, 'old');
  console.log('Created old file:', oldPath);

  // create member with old photoUrl
  const member = await Member.create({ fullName: 'Smoke Upload Test', joinedAt: new Date(), memberType: 'active', photoUrl: `/static/uploads/${oldName}` });
  console.log('Created member:', member._id.toString());

  // call controller updateMember to set new photoUrl (this should trigger safeUnlink on old photo)
  const reqUpdate = { params: { id: member._id.toString() }, body: { photoUrl: `/static/uploads/${newName}` }, headers: {}, ip: '127.0.0.1' };
  const resUpdate = makeRes();
  await updateMember(reqUpdate, resUpdate);

  const oldStill = await exists(oldPath);
  console.log('Old file still exists after update?', oldStill);

  // create the new file so deleteMember will remove it
  await fs.writeFile(newPath, 'new');
  console.log('Created new file for delete test:', newPath);

  // call deleteMember to remove member and delete its photo
  const reqDelete = { params: { id: member._id.toString() }, headers: {}, ip: '127.0.0.1' };
  const resDelete = makeRes();
  await deleteMember(reqDelete, resDelete);

  const newStill = await exists(newPath);
  console.log('New file still exists after delete?', newStill);

  // cleanup: ensure member removed
  const found = await Member.findById(member._id);
  console.log('Member still in DB?', !!found);

  process.exit(0);
}

run().catch(e => { console.error(e && (e.stack || e)); process.exit(1); });
