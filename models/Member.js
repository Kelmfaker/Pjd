import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const memberSchema = new mongoose.Schema({
  membershipId: { type: Number, unique: true, index: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  email: { type: String, lowercase: true, trim: true },
  cin: { type: String, unique: true, sparse: true, index: true, trim: true },
  address: { type: String },
  dateOfBirth: { type: Date },
  bio: { type: String },
  gender: { type: String, enum: ['M', 'F'] },
  educationLevel: { type: String, enum: ['none','primary','secondary','bachelor','master','phd','other'], default: 'other' },
  occupation: { type: String, enum: ['unemployed','student','private','public','self_employed','retired','other'], default: 'other' },
  memberType: { type: String, enum: ['bureau', 'active', 'sympathizer'], required: true },
  role: { type: String }, // role if bureau member (e.g., president, treasurer)
  pdfUrl: { type: String },
  memberOfRegionalBodies: { type: Boolean, default: false },
  memberOfRegionalBodiesDetail: { type: String },
  assignedMission: { type: Boolean, default: false },
  assignedMissionDetail: { type: String },
  previousPartyExperiences: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  joinedAt: { type: Date, alias: 'membershipDate' }
}, { timestamps: true });

// Assign a sequential membershipId on creation
memberSchema.pre('save', async function(next) {
  if (this.isNew && !this.membershipId) {
    try {
      this.membershipId = await getNextSequence('membershipId');
    } catch (err) {
      return next(err);
    }
  }
  next();
});

export default mongoose.model('Member', memberSchema);
