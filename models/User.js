import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  // Optional display name and email (username may itself be an email)
  name: { type: String },
  email: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "secretary", "responsible", "viewer"], default: "viewer" },
  // For password reset flow
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date }
  ,
  // optional link to a Member document for responsible accounts
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }
});

userSchema.methods.isValidPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model("User", userSchema);
