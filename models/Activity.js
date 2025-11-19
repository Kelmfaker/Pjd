import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  kind: { type: String, enum: ['meeting', 'course', 'campaign', 'other'], default: 'other' },
  description: { type: String },
  location: { type: String },
  date: { type: Date, required: true },
  endDate: { type: Date },
  responsible: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  status: { type: String, enum: ['scheduled', 'done', 'postponed'], default: 'scheduled' },
  qrToken: { type: String },
}, { timestamps: true });

activitySchema.index({ date: 1 });

export default mongoose.model('Activity', activitySchema);
