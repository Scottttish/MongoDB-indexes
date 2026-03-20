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

// MongoDB connection with caching for Cloud Functions
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  const uri = process.env.MONGO_URI || functions.config().mongo?.uri || 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';
  await mongoose.connect(uri);
  isConnected = true;
  console.log('MongoDB connected');
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
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
