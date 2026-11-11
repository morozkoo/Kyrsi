const mongoose = require('mongoose');

const rateEntrySchema = new mongoose.Schema({
  rateToRub: { type: Number, required: true, min: 0.000001 },
  source: { type: String, enum: ['manual', 'cbr'], default: 'manual' },
  note: { type: String, trim: true, default: '' },
  recordedAt: { type: Date, default: Date.now }
});

const mongoCurrencySchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/, unique: true },
  name: { type: String, required: true, trim: true },
  symbol: { type: String, trim: true, default: '' },
  rateToRub: { type: Number, required: true, min: 0.000001 },
  rateHistory: { type: [rateEntrySchema], default: [] }
}, { timestamps: true, collection: 'currencies' });

module.exports = mongoose.model('MongoCurrency', mongoCurrencySchema);
