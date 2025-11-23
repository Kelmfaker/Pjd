import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Member from '../models/Member.js';

dotenv.config();
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGODB_URI or MONGO_URI not set in env');
  process.exit(1);
}

async function run(){
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB');

  // create a member with an explicit empty-string cin
  const data = {
    fullName: 'Smoke Test ' + Date.now(),
    memberType: 'active',
    joinedAt: new Date(),
    cin: ''
  };
  console.log('Creating member with payload:', JSON.stringify(data));
  try {
    const m = new Member(data);
    await m.save();
    console.log('Saved member id:', m._id.toString());
    const reloaded = await Member.findById(m._id).lean();
    console.log('Reloaded document:', JSON.stringify(reloaded, null, 2));
  } catch (err) {
    console.error('Save failed:', err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run().catch(err => { console.error(err); process.exit(1); });