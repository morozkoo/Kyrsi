require('dotenv').config();
const mongoose = require('mongoose');
const sequelize = require('../config/database');
const Currency = require('../models/currency');
const MongoCurrency = require('../models/mongoCurrency');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI не задан');

  await sequelize.authenticate();
  await mongoose.connect(process.env.MONGO_URI);

  const currencies = await Currency.findAll();
  let created = 0;
  for (const currency of currencies) {
    if (await MongoCurrency.exists({ code: currency.id })) continue;

    const rateToRub = Number(currency.rateToRub);
    await MongoCurrency.create({
      code: currency.id,
      name: currency.name,
      symbol: currency.symbol,
      rateToRub,
      rateHistory: [{
        rateToRub,
        source: 'manual',
        note: 'Импортировано из PostgreSQL',
        recordedAt: currency.lastUpdated || new Date()
      }]
    });
    created += 1;
  }

  console.log(`MongoDB: добавлено ${created}, уже существовало ${currencies.length - created}`);
}

main()
  .catch((error) => {
    console.error('Ошибка переноса валют:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await sequelize.close();
  });
