#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGODB_URI or MONGO_URI is not set in .env. Aborting.');
  process.exit(1);
}

const username = process.env.SEED_ADMIN_USERNAME || 'admin';
const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('Admin user already exists:', existing.username);
    await mongoose.disconnect();
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const user = new User({ username, passwordHash, role: 'admin' });
  await user.save();
  console.log('Created admin user:', username);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error creating admin:', err);
  process.exit(1);
});
