import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

export async function getNextSequence(name) {
  const updated = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return updated.seq;
}

export default Counter;
