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

const User = mongoose.model('User', userSchema);
const PaymentCard = mongoose.model('PaymentCard', paymentCardSchema);

// Hash password before saving in seed script
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// ─── Data Templates ─────────────────────────────────────────────────────────
const providers = {
    electricity: ['КазМунайГаз Электро', 'АлматыЭнергоСбыт', 'КЕГОК', 'ТОО EnergyPlus', 'Россети', 'Мосэнергосбыт', 'ТНС энерго', 'Петербургская сбытовая компания', 'Ставропольэнергосбыт', 'ЭнергоГарант'],
    gas: ['КазТрансГаз', 'Газпром Бытовые системы', 'Горгаз', 'Межрегионгаз', 'Саратовгаз', 'Мособлгаз', 'Тверьгаз', 'УралГаз', 'СибурГаз', 'АстраГаз'],
    water: ['АлматыВодоканал', 'Водоканал СПб', 'МосВодоканал', 'АО Бийскводоканал', 'ООО Водострой', 'НурВода', 'ТаразСуЖылу', 'АктауВода', 'УстьВода', 'КостанайВода'],
    internet: ['Казахтелеком', 'Beeline KZ', 'Tele2', 'АлТелеком', 'ТТК', 'Дом.ру', 'Ростелеком', 'МТС Интернет', '2ip', 'МГТС'],
    phone: ['Kcell', 'Beeline', 'Altel', 'NEO', 'МТС', 'МегаФон', 'Билайн', 'ТЕЛЕ2', 'Yota', 'Tinkoff Mobile'],
    heating: ['АлматыТеплоЭнерго', 'Теплосеть СПб', 'МОЭК', 'Теплоэнергетик', 'СибТепло', 'УралТеплосеть', 'КазТеплоСервис', 'НурТепло', 'ВолгаТепло', 'ОренТепло'],
    trash: ['ЭкоСервис', 'ТвоёЖКХ', 'ГорЭкоСервис', 'Чистый Город', 'ЭкоТранс', 'Мусоровоз+', 'КазЭкоСистем', 'ЭкоСтандарт', 'ЭкоПлюс', 'ЗелёныйГород'],
    cable: ['Алма-ТВ', 'Отан ТВ', 'Орбита', 'Ростелеком ТВ', 'НТВ+', 'Триколор', 'МТС ТВ', 'Билайн ТВ', 'DIVAN.TV', 'Смотрёшка'],
    security: ['Охрана+', 'SecureHome KZ', 'SafeGuard', 'Страж', 'АрмадаСикьюрити', 'ЩитAndМеч', 'АльфаОхрана', 'ОмегаСикьюрити', 'ПультОхраны', 'ДомОхрана'],
    other: ['УК Комфорт', 'Жильё и Сервис', 'ЖКХ Сервис', 'Управдом', 'КомфортЖК', 'ТСЖ Центральный', 'ТСЖ Южный', 'УК Прогресс', 'ДомСервис', 'КомЖолдас']
};

const categories = Object.keys(providers);
const statuses = ['pending', 'paid', 'overdue', 'cancelled'];
const statusWeights = [0.4, 0.35, 0.15, 0.1];

function weightedRandom(arr, weights) {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += weights[i];
        if (r <= sum) return arr[i];
    }
    return arr[arr.length - 1];
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateCards(userId, count = 600) {
    const cards = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const providerList = providers[category];
        const provider = providerList[Math.floor(Math.random() * providerList.length)];
        const status = weightedRandom(statuses, statusWeights);
        const createdAt = randomDate(oneYearAgo, now);

        const amountRanges = {
            electricity: [800, 8000], gas: [500, 5000], water: [300, 3000], internet: [1500, 6000],
            phone: [500, 4000], heating: [2000, 15000], trash: [200, 800], cable: [800, 3000],
            security: [1500, 8000], other: [500, 5000]
        };
        const [min, max] = amountRanges[category];
        const amount = Math.round((Math.random() * (max - min) + min) * 100) / 100;

        const accountNum = `ACC-${String(Math.floor(Math.random() * 9000000) + 1000000)}`;
        const dueDate = new Date(createdAt.getTime() + (Math.random() * 30 + 5) * 24 * 60 * 60 * 1000);

        const titles = {
            electricity: `Счёт за электроэнергию — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            gas: `Оплата газа — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            water: `Водоснабжение — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            internet: `Интернет-услуги — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            phone: `Мобильная связь — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            heating: `Теплоснабжение — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            trash: `Вывоз мусора — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            cable: `Кабельное/спутниковое ТВ — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            security: `Охрана объекта — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`,
            other: `Коммунальные услуги — ${createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
        };

        cards.push({
            title: titles[category],
            category, provider, amount, currency: 'KZT', status,
            dueDate, accountNumber: accountNum,
            description: `Лицевой счёт: ${accountNum}. Поставщик: ${provider}.`,
            userId, createdAt, updatedAt: createdAt
        });
    }
    return cards;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('🌱 Connecting to MongoDB Atlas...');
    console.log(`🔗 URI: ${MONGO_URI.replace(/:([^@]+)@/, ':****@')}`); // log URI without password

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout
            connectTimeoutMS: 10000
        });
        console.log('✅ Connected!\n');

        // Clear existing data
        await Promise.all([User.deleteMany({}), PaymentCard.deleteMany({})]);
        console.log('🗑️  Cleared existing data\n');

        // Create demo user
        // Note: The User model in the app has a pre-save hook that hashes the password.
        // We pass the plaintext password here and let the hook handle it.
        const user = await User.create({
            nickname: 'Демо Пользователь',
            email: 'demo@utility-app.kz',
            password: 'Demo1234!'
        });
        console.log(`👤 Created user: ${user.email} / Demo1234!\n`);

        // Generate 600 payment cards
        console.log('📦 Generating 600 payment cards...');
        const cards = generateCards(user._id, 600);
        await PaymentCard.insertMany(cards);
        console.log(`✅ Inserted ${cards.length} payment cards!\n`);

        // Create indexes
        console.log('📊 Creating indexes...');
        await PaymentCard.collection.createIndex({ userId: 1, createdAt: -1 });
        await PaymentCard.collection.createIndex({ userId: 1, category: 1 });
        await PaymentCard.collection.createIndex({ userId: 1, status: 1 });
        await PaymentCard.collection.createIndex({ userId: 1, amount: -1 });
        await PaymentCard.collection.createIndex({ title: 'text', provider: 'text', description: 'text' });
        await User.collection.createIndex({ email: 1 }, { unique: true });
        console.log('✅ Indexes created!\n');

        console.log('🎉 Seeding complete!');
        console.log('📧 Login: demo@utility-app.kz');
        console.log('🔑 Password: Demo1234!');
    } catch (err) {
        console.error('\n❌ Seed failed!');
        if (err.name === 'MongooseServerSelectionError') {
            console.error('⚠️  CONNECTION ERROR: Could not connect to MongoDB Atlas.');
            console.error('👉 Please ensure your IP address is WHITELISTED in the MongoDB Atlas dashboard (Network Access).');
        } else {
            console.error('Error details:', err);
        }
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
