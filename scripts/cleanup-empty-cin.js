import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Member from '../models/Member.js';

dotenv.config();
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error('Error: MONGODB_URI or MONGO_URI environment variable is not set. Aborting.');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB');

  try {
    const res = await Member.updateMany({ cin: '' }, { $unset: { cin: '' } });
    console.log('Update result:', JSON.stringify(res, null, 2));
    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Failed to run cleanup:', err && err.message ? err.message : err);
    process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => { console.error(err); process.exit(3); });
