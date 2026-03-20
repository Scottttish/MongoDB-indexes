const mongoose = require('mongoose');

const paymentCardSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    category: {
        type: String,
        enum: ['electricity', 'gas', 'water', 'internet', 'phone', 'heating', 'trash', 'cable', 'security', 'other'],
        required: true
    },
    provider: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
    dueDate: { type: Date },
    accountNumber: { type: String },
    description: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound and single-field indexes for performance
paymentCardSchema.index({ userId: 1, createdAt: -1 });
paymentCardSchema.index({ userId: 1, category: 1 });
paymentCardSchema.index({ userId: 1, status: 1 });
paymentCardSchema.index({ userId: 1, amount: -1 });
paymentCardSchema.index({ title: 'text', provider: 'text', description: 'text' });
paymentCardSchema.index({ dueDate: 1 });

module.exports = mongoose.model('PaymentCard', paymentCardSchema);
