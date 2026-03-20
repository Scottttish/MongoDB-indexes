const mongoose = require('mongoose');

const basketSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentCard', required: true },
    addedAt: { type: Date, default: Date.now }
});

basketSchema.index({ userId: 1 });
basketSchema.index({ userId: 1, cardId: 1 }, { unique: true });

module.exports = mongoose.model('Basket', basketSchema);
