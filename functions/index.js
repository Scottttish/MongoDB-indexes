const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const functions = require('firebase-functions');

const authRoutes = require('./routes/auth');
const cardsRoutes = require('./routes/cards');
const basketRoutes = require('./routes/basket');
const profileRoutes = require('./routes/profile');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return; // 1 = connected
  if (mongoose.connection.readyState === 2) { // 2 = connecting
    console.log('MongoDB is already connecting...');
    return;
  }

  const uri = process.env.MONGO_URI || functions.config().mongo?.uri || 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';

  console.log('MongoDB connecting...');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    family: 4
  });
  console.log('✅ MongoDB connected successfully');
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({
      message: 'Database connection failed. Please ensure your IP is whitelisted.',
      error: err.message
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/basket', basketRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Export as Firebase Cloud Function
exports.api = functions.https.onRequest(app);

// For local dev: node functions/index.js
if (require.main === module) {
  connectDB().then(() => {
    app.listen(5000, () => console.log('Backend running on http://localhost:5000'));
  });
}
