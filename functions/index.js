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

  let uri = process.env.MONGO_URI;
  if (!uri) {
    try {
      // Safe check for Firebase config
      if (typeof functions.config === 'function') {
        uri = functions.config().mongo?.uri;
      }
    } catch (e) {
      console.log('Firebase config not available');
    }
  }

  if (!uri) {
    uri = 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';
  }

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

// ─── Real Index Management ───────────────────────────────────────────────────
app.get('/api/system/indexes', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = ['paymentcards', 'users'];
    const result = [];
    for (const col of collections) {
      try {
        const indexes = await db.collection(col).indexes();
        indexes.forEach(idx => result.push({ ...idx, collection: col }));
      } catch (e) { /* collection may not exist */ }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch indexes', error: err.message });
  }
});

// Real CRUD benchmark — measures actual MongoDB operation latency
app.get('/api/system/benchmark', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const col = db.collection('paymentcards');
    const results = {};

    let t = Date.now();
    const testDoc = await col.insertOne({ _bench: true, title: '__bench__', createdAt: new Date() });
    results.create = Date.now() - t;

    t = Date.now();
    await col.find({}).limit(20).toArray();
    results.read = Date.now() - t;

    t = Date.now();
    await col.updateOne({ _id: testDoc.insertedId }, { $set: { title: '__bench_updated__' } });
    results.update = Date.now() - t;

    t = Date.now();
    await col.deleteOne({ _id: testDoc.insertedId });
    results.delete = Date.now() - t;

    results.totalCards = await col.countDocuments({ _bench: { $exists: false } });
    results.totalUsers = await db.collection('users').countDocuments({});
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Benchmark failed', error: err.message });
  }
});

// Real analysis using $indexStats — actual MongoDB access counters per index
app.get('/api/system/analyze', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = ['paymentcards', 'users'];
    const recommendations = [];
    const rawStats = {};

    for (const colName of collections) {
      try {
        const col = db.collection(colName);

        const [indexes, accessArr, colStats] = await Promise.all([
          col.indexes(),
          col.aggregate([{ $indexStats: {} }]).toArray(),
          col.stats(),
        ]);

        const accessMap = {};
        accessArr.forEach(s => { accessMap[s.name] = Number(s.accesses?.ops || 0); });

        const docCount = colStats.count || 0;
        rawStats[colName] = { docCount, indexSizes: colStats.indexSizes || {}, accessMap };

        const indexNames = indexes.map(i => i.name);

        for (const idx of indexes) {
          const ops = accessMap[idx.name] || 0;
          const keys = idx.key ? Object.entries(idx.key) : [];
          const keyStr = keys.map(([f, d]) => `${f}:${d}`).join(', ');

          if (idx.name === '_id_') {
            recommendations.push({
              action: 'keep', index: idx.name, collection: colName, ops,
              reason: `Системный индекс. $indexStats: ${ops.toLocaleString()} обращений. Структура: ${keyStr}. Удаление невозможно — MongoDB требует его для каждого документа.`,
              impact: 'critical', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
            });
            continue;
          }

          if (ops === 0) {
            recommendations.push({
              action: 'delete', index: idx.name, collection: colName, ops,
              reason: `$indexStats показывает 0 обращений к этому индексу. На коллекции "${colName}" (${docCount.toLocaleString()} документов) он занимает место и замедляет все INSERT/UPDATE операции (~2–4 мс overhead на запись). Данные: ${keyStr}.`,
              impact: 'medium', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
            });
          } else if (ops > 500) {
            recommendations.push({
              action: 'keep', index: idx.name, collection: colName, ops,
              reason: `Активно используемый индекс: ${ops.toLocaleString()} обращений ($indexStats). Поля: ${keyStr}. Удаление вызовет COLLSCAN для запросов по этим полям на коллекции с ${docCount.toLocaleString()} документами.`,
              impact: 'high', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
            });
          } else {
            recommendations.push({
              action: 'keep', index: idx.name, collection: colName, ops,
              reason: `Умеренное использование: ${ops.toLocaleString()} обращений ($indexStats). Поля: ${keyStr}. Коллекция: ${docCount.toLocaleString()} документов. Рекомендуется мониторить.`,
              impact: 'low', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
            });
          }
        }

        // Suggest missing critical indexes based on known query patterns
        if (colName === 'paymentcards') {
          const needsUserCreated = !indexNames.some(n => n.includes('userId') && n.includes('createdAt'));
          if (needsUserCreated) {
            recommendations.push({
              action: 'add', index: 'userId_1_createdAt_-1', collection: colName, ops: 0,
              reason: `Отсутствует индекс для главного запроса дашборда: {userId, sort: createdAt:-1}. Без него MongoDB выполняет COLLSCAN по всем ${docCount.toLocaleString()} документам при каждой загрузке страницы.`,
              impact: 'high', keys: [{ field: 'userId', dir: 1 }, { field: 'createdAt', dir: -1 }],
              mongoKeys: { userId: 1, createdAt: -1 },
            });
          }
          const needsTextSearch = !indexNames.some(n => n.includes('text'));
          if (needsTextSearch) {
            recommendations.push({
              action: 'add', index: 'title_text_provider_text', collection: colName, ops: 0,
              reason: `Текстовый поиск выполняется через regex без индекса (COLLSCAN по ${docCount.toLocaleString()} документам). Текстовый индекс ускорит поиск в разы.`,
              impact: 'medium', keys: [{ field: 'title', dir: 'text' }, { field: 'provider', dir: 'text' }],
              mongoKeys: { title: 'text', provider: 'text' },
            });
          }
        }
        if (colName === 'users') {
          const needsEmail = !indexNames.some(n => n.includes('email'));
          if (needsEmail) {
            recommendations.push({
              action: 'add', index: 'email_1', collection: colName, ops: 0,
              reason: `Нет индекса по email. Каждый логин = COLLSCAN по коллекции пользователей (${docCount.toLocaleString()} документов).`,
              impact: 'high', keys: [{ field: 'email', dir: 1 }],
              mongoKeys: { email: 1 }, options: { unique: true },
            });
          }
        }
      } catch (e) {
        rawStats[colName] = { error: e.message };
      }
    }

    res.json({ recommendations, rawStats });
  } catch (err) {
    res.status(500).json({ message: 'Analysis failed', error: err.message });
  }
});

// Real index usage stats
app.get('/api/system/stats', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = ['paymentcards', 'users'];
    const result = {};
    for (const colName of collections) {
      try {
        const col = db.collection(colName);
        const [colStats, indexStats] = await Promise.all([
          col.stats(),
          col.aggregate([{ $indexStats: {} }]).toArray(),
        ]);
        result[colName] = {
          count: colStats.count, avgObjSize: Math.round(colStats.avgObjSize || 0),
          totalSize: colStats.size, indexSizes: colStats.indexSizes || {},
          indexStats: indexStats.map(is => ({ name: is.name, ops: is.accesses?.ops || 0, since: is.accesses?.since })),
        };
      } catch (e) { result[colName] = { error: e.message }; }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Stats failed', error: err.message });
  }
});

app.post('/api/system/indexes', async (req, res) => {
  try {
    const { collection, keys, options = {} } = req.body;
    if (!collection || !keys) return res.status(400).json({ message: 'collection and keys are required' });
    const db = mongoose.connection.db;
    const name = await db.collection(collection).createIndex(keys, options);
    res.json({ message: 'Index created', name });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create index', error: err.message });
  }
});

app.delete('/api/system/indexes/:collection/:name', async (req, res) => {
  try {
    const { collection, name } = req.params;
    if (name === '_id_') return res.status(400).json({ message: 'Cannot drop _id_ index' });
    const db = mongoose.connection.db;
    await db.collection(collection).dropIndex(name);
    res.json({ message: 'Index dropped', name });
  } catch (err) {
    res.status(500).json({ message: 'Failed to drop index', error: err.message });
  }
});

// Export as Firebase Cloud Function
exports.api = functions.https.onRequest(app);

// For local dev: node functions/index.js
if (require.main === module) {
  connectDB().then(() => {
    app.listen(5000, () => console.log('Backend running on http://localhost:5000'));
  });
}
