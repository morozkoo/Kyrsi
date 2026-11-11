const mongoose = require('mongoose');

async function connectMongo() {
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI не задан: маршруты /mongo/currencies недоступны');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Не удалось подключиться к MongoDB:', error.message);
  }
}

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'MongoDB недоступна. Проверьте MONGO_URI и подключение.' });
  }
  next();
}

module.exports = { connectMongo, requireMongo };
