const currencies = require('../data/currencies');
const { XMLParser } = require('fast-xml-parser');

const cbrUrl = 'https://www.cbr.ru/scripts/XML_daily.asp';

function findCurrency(id) {
  return currencies.find((currency) => currency.id === id.toUpperCase());
}

function validateCurrencyBody(body) {
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return 'Поле name обязательно и должно быть строкой';
  }

  if (typeof body.rateToRub !== 'number' || body.rateToRub <= 0) {
    return 'Поле rateToRub должно быть положительным числом';
  }

  return null;
}

exports.getCurrencies = (req, res) => {
  res.json(currencies);
};

exports.refreshRates = async (req, res, next) => {
  try {
    const response = await fetch(cbrUrl);

    if (!response.ok) {
      throw new Error(`ЦБ РФ вернул статус ${response.status}`);
    }

    const xml = await response.text();
    const parsed = new XMLParser({ isArray: (name) => name === 'Valute' }).parse(xml);
    const rates = parsed.ValCurs?.Valute || [];

    rates.forEach((rate) => {
      const currency = findCurrency(rate.CharCode);
      const value = Number(String(rate.Value).replace(',', '.'));
      const nominal = Number(rate.Nominal);

      if (currency && Number.isFinite(value) && Number.isFinite(nominal) && nominal > 0) {
        currency.rateToRub = value / nominal;
      }
    });

    res.json({ updated: new Date().toISOString(), source: cbrUrl, currencies });
  } catch (error) {
    next(error);
  }
};

exports.getCurrency = (req, res) => {
  const currency = findCurrency(req.params.id);

  if (!currency) {
    return res.status(404).json({ error: 'Валюта не найдена' });
  }

  res.json(currency);
};

exports.createCurrency = (req, res) => {
  const validationError = validateCurrencyBody(req.body);
  const id = typeof req.body?.id === 'string' ? req.body.id.toUpperCase() : '';

  if (validationError || !id) {
    return res.status(400).json({
      error: validationError || 'Поле id обязательно и должно быть строкой'
    });
  }

  if (findCurrency(id)) {
    return res.status(400).json({ error: 'Валюта с таким id уже существует' });
  }

  const currency = {
    id,
    name: req.body.name.trim(),
    symbol: typeof req.body.symbol === 'string' ? req.body.symbol : '',
    rateToRub: req.body.rateToRub
  };

  currencies.push(currency);
  res.status(201).json(currency);
};

exports.updateCurrency = (req, res) => {
  const currency = findCurrency(req.params.id);

  if (!currency) {
    return res.status(404).json({ error: 'Валюта не найдена' });
  }

  const validationError = validateCurrencyBody(req.body);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  currency.name = req.body.name.trim();
  currency.symbol = typeof req.body.symbol === 'string' ? req.body.symbol : '';
  currency.rateToRub = req.body.rateToRub;

  res.json(currency);
};

exports.deleteCurrency = (req, res) => {
  const index = currencies.findIndex(
    (currency) => currency.id === req.params.id.toUpperCase()
  );

  if (index === -1) {
    return res.status(404).json({ error: 'Валюта не найдена' });
  }

  currencies.splice(index, 1);
  res.status(204).send();
};

exports.convertCurrency = (req, res) => {
  const { from, to, amount } = req.body || {};
  const numericAmount = Number(amount);
  const source = typeof from === 'string' ? findCurrency(from) : null;
  const target = typeof to === 'string' ? findCurrency(to) : null;

  if (!source || !target || !Number.isFinite(numericAmount) || numericAmount < 0) {
    return res.status(400).json({
      error: 'Укажите from, to и неотрицательный числовой amount для существующих валют'
    });
  }

  const rate = source.rateToRub / target.rateToRub;

  res.json({
    from: source.id,
    to: target.id,
    amount: numericAmount,
    rate: Number(rate.toFixed(6)),
    result: Number((numericAmount * rate).toFixed(2)),
    source: 'Внутренний учебный набор курсов; готов к замене на API ЦБ РФ'
  });
};