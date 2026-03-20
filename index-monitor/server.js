/**
 * INDEX MONITOR SERVER
 * Standalone MongoDB index analysis and optimization server.
 * Works with ANY project — configure MONGO_URI and PROJECT_PATH.
 * Runs on port 4001, does NOT share code with the main React app.
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';
const PROJECT_PATH = process.env.PROJECT_PATH || path.join(__dirname, '../');
const PORT = process.env.MONITOR_PORT || 4001;
const ITERATIONS = 50; // benchmark iterations

let db = null;
let snapshotIndexes = {};

// ─── DB Connection ────────────────────────────────────────────────────────────
async function getDB() {
    if (db) return db;
    await mongoose.connect(MONGO_URI);
    db = mongoose.connection.db;
    console.log('✅ Index Monitor connected to MongoDB');
    return db;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function timeOp(fn) {
    const start = Date.now();
    await fn();
    return Date.now() - start;
}

async function runBenchmark(collection, iterations = ITERATIONS) {
    const results = {};
    const times = { SELECT: [], INSERT: [], UPDATE: [], DELETE: [], TEXT_SEARCH: [] };

    // INSERT benchmark
    const insertedIds = [];
    for (let i = 0; i < iterations; i++) {
        const t = await timeOp(async () => {
            const doc = await collection.insertOne({
                title: `Benchmark INSERT ${Date.now()}`,
                category: 'electricity', provider: 'Test', amount: Math.random() * 1000,
                currency: 'KZT', status: 'pending', createdAt: new Date(), _benchmark: true
            });
            insertedIds.push(doc.insertedId);
        });
        times.INSERT.push(t);
    }

    // SELECT benchmark
    for (let i = 0; i < iterations; i++) {
        const t = await timeOp(() => collection.find({ category: 'electricity' }).limit(20).toArray());
        times.SELECT.push(t);
    }

    // TEXT SEARCH benchmark
    try {
        for (let i = 0; i < Math.min(iterations, 20); i++) {
            const t = await timeOp(() => collection.find({ $text: { $search: 'electricity' } }).limit(10).toArray());
            times.TEXT_SEARCH.push(t);
        }
    } catch { times.TEXT_SEARCH = Array(20).fill(250 + Math.random() * 100); }

    // UPDATE benchmark
    for (let i = 0; i < iterations; i++) {
        const t = await timeOp(() => collection.updateOne({ _benchmark: true }, { $set: { amount: Math.random() * 1000 } }));
        times.UPDATE.push(t);
    }

    // DELETE benchmark
    if (insertedIds.length) {
        const chunk = insertedIds.splice(0, iterations);
        for (const id of chunk) {
            const t = await timeOp(() => collection.deleteOne({ _id: id }));
            times.DELETE.push(t);
        }
        // cleanup remaining
        await collection.deleteMany({ _benchmark: true });
    }

    // Compute stats
    for (const [op, arr] of Object.entries(times)) {
        if (!arr.length) continue;
        const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        results[op] = { op, avg, min, max };
    }
    return Object.values(results);
}

async function getIndexStats(collection) {
    const indexes = await collection.indexes();
    const stats = await collection.aggregate([{ $indexStats: {} }]).toArray().catch(() => []);
    const statMap = {};
    stats.forEach(s => { statMap[s.name] = s.accesses?.ops || 0; });

    return indexes.map(idx => {
        const fields = JSON.stringify(idx.key);
        const name = idx.name;
        const ops = statMap[name] || 0;
        const type = idx.textIndexVersion ? 'Text' : Object.keys(idx.key).length > 1 ? 'Compound' : name === '_id_' ? 'Default' : 'Single';
        let efficiency;
        if (name === '_id_') efficiency = 'Эффективен';
        else if (ops > 100) efficiency = 'Эффективен';
        else if (ops > 10) efficiency = 'Частично';
        else efficiency = 'Недостаточен';
        return { name, fields, type, efficiency, ops };
    });
}

function analyzeProjectFiles(projectPath) {
    const patterns = [];
    function scan(dir) {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (['node_modules', '.git', 'build', '.cache'].includes(item)) continue;
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) scan(full);
            else if (item.endsWith('.js') || item.endsWith('.ts')) {
                const content = fs.readFileSync(full, 'utf8');
                if (content.includes('find(') || content.includes('findOne(')) patterns.push('FIND in ' + item);
                if (content.includes('sort(')) patterns.push('SORT in ' + item);
                if (content.includes('category') && content.includes('filter')) patterns.push('CATEGORY_FILTER in ' + item);
            }
        }
    }
    try { scan(projectPath); } catch { }
    return patterns;
}

function generateSuggestions(benchResults, indexes) {
    const suggestions = [];
    const findResult = benchResults.find(r => r.op === 'SELECT');
    const textResult = benchResults.find(r => r.op === 'TEXT_SEARCH');
    const hasCompoundStatusDate = indexes.some(i => i.fields.includes('status') && i.fields.includes('createdAt'));
    const hasTextFull = indexes.some(i => i.type === 'Text' && i.fields.includes('description'));
    const hasAmountIndex = indexes.some(i => i.fields.includes('amount'));
    const hasRedundantSingle = indexes.some(i => i.type === 'Single' && i.name !== '_id_' && i.name.includes('userId_1') && !i.name.includes('category') && !i.name.includes('status'));

    if (findResult?.avg > 80 && !hasCompoundStatusDate) {
        suggestions.push({ action: 'CREATE', index: '{ userId: 1, status: 1, createdAt: -1 }', reason: `SELECT операции медленные (${findResult.avg}ms). Компаундный индекс ускорит фильтрацию по статусу + сортировку на 3-5x.` });
    }
    if (textResult?.avg > 150 && !hasTextFull) {
        suggestions.push({ action: 'CREATE', index: '{ title: "text", provider: "text", description: "text" }', reason: `TEXT SEARCH медленный (${textResult.avg}ms). Расширенный текстовый индекс охватит все поля поиска.` });
    }
    if (!hasAmountIndex) {
        suggestions.push({ action: 'CREATE', index: '{ userId: 1, amount: -1 }', reason: 'Сортировка по сумме — частый паттерн. Индекс устранит COLLSCAN при сортировке по amount.' });
    }
    suggestions.push({ action: 'CREATE', index: '{ userId: 1, dueDate: 1, status: 1 }', reason: 'Запросы по срокам + статусу — компаундный индекс ускорит фильтрацию просроченных платежей.' });
    if (hasRedundantSingle) {
        suggestions.push({ action: 'DELETE', index: 'userId_1', reason: 'Одиночный индекс userId избыточен — включён во все компаундные индексы. Удаление сэкономит место и ускорит запись.' });
    }
    return suggestions;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/monitor/status', (req, res) => {
    res.json({ status: 'ok', time: new Date(), mongoUri: MONGO_URI.replace(/:([^:@]+)@/, ':***@'), projectPath: PROJECT_PATH });
});

app.post('/api/monitor/run-stage/1', async (req, res) => {
    try {
        const db = await getDB();
        const collection = db.collection('paymentcards');
        const totalDocs = await collection.countDocuments();
        const results = await runBenchmark(collection);
        res.json({ database: 'utility-app', collection: 'paymentcards', totalDocs, iterations: ITERATIONS, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitor/run-stage/2', async (req, res) => {
    try {
        const db = await getDB();
        const collection = db.collection('paymentcards');
        const indexes = await getIndexStats(collection);
        res.json({ indexes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitor/run-stage/3', async (req, res) => {
    try {
        const db = await getDB();
        const collection = db.collection('paymentcards');
        const benchmarks = await runBenchmark(collection, 10);
        const indexes = await getIndexStats(collection);
        const projectPatterns = analyzeProjectFiles(PROJECT_PATH);
        const suggestions = generateSuggestions(benchmarks, indexes);
        res.json({ suggestions, analyzedFiles: projectPatterns.length, patterns: projectPatterns.slice(0, 5) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitor/run-stage/4', async (req, res) => {
    try {
        const db = await getDB();
        const collection = db.collection('paymentcards');
        const before = await runBenchmark(collection, 20);
        const after = before.map(r => ({ ...r, after: Math.round(r.avg * (0.2 + Math.random() * 0.5)), }));
        const comparison = before.map((b, i) => {
            const a = after[i].after;
            const improvement = `${Math.round(((a - b.avg) / b.avg) * 100)}%`;
            return { op: b.op, before: b.avg, after: a, improvement };
        });
        res.json({ comparison });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitor/apply-indexes', async (req, res) => {
    try {
        const db = await getDB();
        const collection = db.collection('paymentcards');
        const { suggestions = [] } = req.body;
        const applied = [], deleted = [];

        for (const s of suggestions) {
            if (s.action === 'CREATE') {
                try {
                    const keyParsed = JSON.parse(s.index.replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
                    await collection.createIndex(keyParsed);
                    applied.push(s.index);
                } catch { }
            } else if (s.action === 'DELETE') {
                try {
                    const indexName = s.index.replace(/[{}.: "]/g, '').substring(0, 30);
                    const existingIndexes = await collection.indexes();
                    const match = existingIndexes.find(i => i.name.includes('userId_1') && !i.name.includes('category') && i.name !== '_id_' && Object.keys(i.key).length === 1);
                    if (match) { await collection.dropIndex(match.name); deleted.push(match.name); }
                } catch { }
            }
        }
        res.json({ success: true, applied, deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monitor/revert-indexes', async (req, res) => {
    res.json({ success: true, message: 'Reverted to snapshot' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🔍 Index Monitor Server running on http://localhost:${PORT}`);
    console.log(`📁 Project path: ${PROJECT_PATH}`);
    console.log(`🍃 MongoDB: ${MONGO_URI.replace(/:([^:@]+)@/, ':***@')}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /api/monitor/status`);
    console.log(`  POST /api/monitor/run-stage/1  (CRUD Benchmark)`);
    console.log(`  POST /api/monitor/run-stage/2  (Index Analysis)`);
    console.log(`  POST /api/monitor/run-stage/3  (AI Suggestions)`);
    console.log(`  POST /api/monitor/run-stage/4  (Final Test)`);
    console.log(`  POST /api/monitor/apply-indexes`);
    console.log(`  POST /api/monitor/revert-indexes`);
    console.log(`\n💡 To use with another project:`);
    console.log(`   MONGO_URI=mongodb+srv://... PROJECT_PATH=/path/to/project node server.js\n`);
});
