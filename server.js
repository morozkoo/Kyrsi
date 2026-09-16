const express = require('express');
const currencyRoutes = require('./routes/currencyRoutes');
const { convertCurrency } = require('./controllers/currencyController');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: 'Currency Converter API',
    endpoints: ['GET /currencies', 'POST /conversions']
  });
});

app.use('/currencies', currencyRoutes);
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;