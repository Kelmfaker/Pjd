import mongoose from 'mongoose';

// Serverless-friendly Mongoose connection caching.
// This stores the connection promise on the global object so it survives
// across lambda warm invocations and avoids creating many connections.

const cached = global.__mongooseCached || (global.__mongooseCached = { conn: null, promise: null });

export async function connectToDatabase(mongoUri) {
  if (!mongoUri) throw new Error('No MongoDB URI provided');

  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // fail fast when MongoDB is not reachable
      serverSelectionTimeoutMS: 5000,
      // use the default connection pool size; serverless instances are short-lived
    };
    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      cached.conn = mongooseInstance.connection;
      return cached.conn;
    });
  }
  return cached.promise;
}

export function getMongooseConnection() {
  return cached.conn || null;
}
