// lib/mongoose.js
import mongoose from 'mongoose';

let cached = global._mongoose; // eslint-disable-line no-underscore-dangle

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('Missing MONGODB_URI');

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      // tune timeouts for serverless
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      // other options as needed
    };
    cached.promise = mongoose.connect(MONGO_URI, opts).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}