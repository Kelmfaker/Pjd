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

  // find or create a member to update
  let member = await Member.findOne();
  if (!member) {
    console.log('No members found — creating a temporary member');
    member = new Member({ fullName: 'Test User ' + Date.now(), memberType: 'active', joinedAt: new Date() });
    await member.save();
    console.log('Created member:', member._id.toString());
  } else {
    console.log('Using existing member:', member._id.toString());
  }

  // Simulate UI payload: Object.fromEntries(new FormData(form)) -> empty fields become empty strings
  const payload = {
    fullName: member.fullName,
    email: member.email || '',
    phone: member.phone || '',
    cin: '', // intentionally empty to reproduce issue
    neighborhood: '',
    membershipDate: member.joinedAt ? new Date(member.joinedAt).toISOString().slice(0,10) : ''
  };

  console.log('Attempting update with payload:', JSON.stringify(payload, null, 2));

  try {
    const updated = await Member.findByIdAndUpdate(member._id, payload, { new: true, runValidators: true });
    console.log('Update succeeded. Result:', updated ? updated.toObject() : 'null');
  } catch (err) {
    console.error('Update failed with error:', err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run().catch(err => { console.error(err); process.exit(1); });