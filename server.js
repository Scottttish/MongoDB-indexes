const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./functions/routes/auth');
const cardsRoutes = require('./functions/routes/cards');
const basketRoutes = require('./functions/routes/basket');
const profileRoutes = require('./functions/routes/profile');

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        // Do not crash the process, but allow health check to report failure
    });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/basket', basketRoutes);
app.use('/api/profile', profileRoutes);

// ─── Real Index Management & Analysis ────────────────────────────────────────
app.get('/api/system/indexes', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = ['paymentcards', 'users'];
        const result = [];
        for (const col of collections) {
            try {
                const indexes = await db.collection(col).indexes();
                indexes.forEach(idx => result.push({ ...idx, collection: col }));
            } catch (e) { /* ignore */ }
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch indexes', error: err.message });
    }
});

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

app.get('/api/system/analyze', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = ['paymentcards', 'users'];
        const recommendations = [];
        for (const colName of collections) {
            try {
                const col = db.collection(colName);
                const [indexes, accessArr, stats] = await Promise.all([
                    col.indexes(),
                    col.aggregate([{ $indexStats: {} }]).toArray(),
                    col.stats()
                ]);
                const accessMap = {};
                accessArr.forEach(s => { accessMap[s.name] = Number(s.accesses?.ops || 0); });
                const docCount = stats.count || 0;
                for (const idx of indexes) {
                    const ops = accessMap[idx.name] || 0;
                    const keys = idx.key ? Object.entries(idx.key) : [];
                    const keyStr = keys.map(([f, d]) => `${f}:${d}`).join(', ');
                    if (idx.name === '_id_') {
                        recommendations.push({
                            action: 'keep', index: idx.name, collection: colName, ops,
                            reason: `Системный индекс. $indexStats: ${ops.toLocaleString()} обращений. Структура: ${keyStr}.`,
                            impact: 'critical', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
                        });
                        continue;
                    }
                    if (ops === 0) {
                        recommendations.push({
                            action: 'delete', index: idx.name, collection: colName, ops,
                            reason: `$indexStats показывает 0 обращений. На коллекции "${colName}" (${docCount.toLocaleString()} документов) он замедляет запись. Данные: ${keyStr}.`,
                            impact: 'medium', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
                        });
                    } else {
                        recommendations.push({
                            action: 'keep', index: idx.name, collection: colName, ops,
                            reason: `Используемый индекс: ${ops.toLocaleString()} обращений. Поля: ${keyStr}.`,
                            impact: ops > 500 ? 'high' : 'low', keys: keys.map(([f, d]) => ({ field: f, dir: d })),
                        });
                    }
                }
                if (colName === 'paymentcards' && !indexes.some(n => n.name.includes('userId'))) {
                    recommendations.push({
                        action: 'add', index: 'userId_1_createdAt_-1', collection: colName, ops: 0,
                        reason: `Отсутствует индекс для дашборда. Без него MongoDB выполняет COLLSCAN по всем ${docCount.toLocaleString()} документам.`,
                        impact: 'high', keys: [{ field: 'userId', dir: 1 }, { field: 'createdAt', dir: -1 }],
                        mongoKeys: { userId: 1, createdAt: -1 }
                    });
                }
            } catch (e) { }
        }
        res.json({ recommendations });
    } catch (err) {
        res.status(500).json({ message: 'Analysis failed', error: err.message });
    }
});

app.post('/api/system/indexes', async (req, res) => {
    try {
        const { collection, keys, options = {} } = req.body;
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
        const db = mongoose.connection.db;
        await db.collection(collection).dropIndex(name);
        res.json({ message: 'Index dropped', name });
    } catch (err) {
        res.status(500).json({ message: 'Failed to drop index', error: err.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
});
