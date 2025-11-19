#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGODB_URI or MONGO_URI is not set in .env. Aborting.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri, { autoIndex: false });
  console.log('Connected to MongoDB');

  const users = await User.find().lean();
  if (!users || users.length === 0) {
    console.log('No users found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let updated = 0;
  for (const u of users) {
    if (u.role && u.role !== String(u.role).toLowerCase()) {
      const newRole = String(u.role).toLowerCase();
      await User.updateOne({ _id: u._id }, { $set: { role: newRole } });
      console.log(`Updated user ${u.username || u._id}: role '${u.role}' -> '${newRole}'`);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} user(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
