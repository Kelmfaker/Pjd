import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  presenceStatus: { type: String, enum: ['present', 'absent'], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comment: { type: String },
  recordedAt: { type: Date, default: Date.now },
  method: { type: String, enum: ['manual', 'qr'], default: 'manual' }
}, { timestamps: true });

attendanceSchema.index({ memberId: 1, activityId: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);

