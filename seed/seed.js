const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = 'mongodb+srv://scott:314159265359@indexess.bq2wcic.mongodb.net/utility-app?appName=Indexess';

// ─── Schemas ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    nickname: String, email: { type: String, unique: true }, password: String, createdAt: { type: Date, default: Date.now }
});

const paymentCardSchema = new mongoose.Schema({
    title: String, category: String, provider: String, amount: Number, currency: { type: String, default: 'USD' },
    status: String, dueDate: Date, accountNumber: String, description: String,
    userId: mongoose.Schema.Types.ObjectId, createdAt: { type: Date, default: Date.now }
});

// IMPORTANT: Add hooks BEFORE compiling the model
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const User = mongoose.model('User', userSchema);
const PaymentCard = mongoose.model('PaymentCard', paymentCardSchema);

// ─── Data Helpers ─────────────────────────────────────────────────────────
const providers = {
    electricity: ['КазМунайГаз Электро', 'АлматыЭнергоСбыт', 'КЕГОК', 'ТОО EnergyPlus'],
    gas: ['КазТрансГаз', 'Газпром Бытовые системы', 'Горгаз'],
    water: ['АлматыВодоканал', 'Водоканал СПб', 'МосВодоканал'],
    internet: ['Казахтелеком', 'Beeline KZ', 'Tele2'],
    phone: ['Kcell', 'Beeline', 'Altel'],
    heating: ['АлматыТеплоЭнерго', 'Теплосеть СПб'],
    trash: ['ЭкоСервис'],
    cable: ['Алма-ТВ'],
    security: ['Охрана+'],
    other: ['УК Комфорт']
};

const categories = Object.keys(providers);
const statuses = ['pending', 'paid', 'overdue', 'cancelled'];

function generateCards(userId, count = 100) {
    const cards = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const providerList = providers[category];
        const provider = providerList[Math.floor(Math.random() * providerList.length)];
        cards.push({
            title: `Счёт — ${category}`,
            category, provider, amount: Math.floor(Math.random() * 5000) + 1000, currency: 'KZT',
            status: statuses[Math.floor(Math.random() * statuses.length)],
            dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
            accountNumber: `ACC-${Math.floor(Math.random() * 100000)}`,
            description: `Автоматически созданный счет для ${category}`,
            userId, createdAt: now
        });
    }
    return cards;
}

async function seed() {
    console.log('🌱 Seed starting...');
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ DB Connected');

        await User.deleteMany({});
        await PaymentCard.deleteMany({});
        console.log('🗑️ DB Cleared');

        const user = await User.create({
            nickname: 'Пользователь',
            email: 'demo@utility-app.kz',
            password: 'Demo1234!'
        });
        console.log('👤 Demo User Created');

        const cards = generateCards(user._id, 100);
        await PaymentCard.insertMany(cards);
        console.log(`✅ ${cards.length} Cards Created`);

        console.log('🎉 DONE!');
        console.log('Login: demo@utility-app.kz / Demo1234!');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
