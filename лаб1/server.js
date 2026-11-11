const express = require('express');
const cors = require('cors');
const currencyRoutes = require('./routes/currencyRoutes');
const authRoutes = require('./routes/authRoutes');
const mongoCurrencyRoutes = require('./routes/mongoCurrencyRoutes');
const authController = require('./controllers/authController');
const { authenticateToken } = require('./middleware/auth');
const { convertCurrency } = require('./controllers/currencyController');
const sequelize = require('./config/database');
const { connectMongo } = require('./config/mongo');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
    : '*'
}));

app.get('/', (req, res) => {
  res.json({
    name: 'Currency Converter API',
    endpoints: ['GET /currencies', 'POST /conversions']
  });
});

app.use('/currencies', currencyRoutes);
app.use('/mongo/currencies', mongoCurrencyRoutes);
app.use('/auth', authRoutes);
app.get('/profile', authenticateToken, authController.profile);
app.post('/conversions', convertCurrency);

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }

  console.error(error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

connectMongo();

sequelize.authenticate()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Не удалось подключиться к PostgreSQL:', error.message);
  });

module.exports = app;
