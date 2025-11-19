import mongoose from 'mongoose';

const attendanceReportSchema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  total: { type: Number, default: 0 },
  presentCount: { type: Number, default: 0 },
  attendanceRate: { type: Number, default: 0 },
  rows: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    fullName: { type: String },
    membershipId: { type: Number },
    memberType: { type: String },
    presenceStatus: { type: String },
    recordedAt: { type: Date },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String }
  }]
}, { timestamps: true });

export default mongoose.model('AttendanceReport', attendanceReportSchema);
