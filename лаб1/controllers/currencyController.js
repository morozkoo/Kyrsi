const { XMLParser } = require('fast-xml-parser');
const Currency = require('../models/currency');

const cbrUrl = 'https://www.cbr.ru/scripts/XML_daily.asp';

function findCurrency(id) {
  return Currency.findByPk(String(id).toUpperCase());
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

exports.getCurrencies = async (req, res, next) => {
  try {
    res.json(await Currency.findAll());
  } catch (error) {
    next(error);
  }
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

    for (const rate of rates) {
      const currency = await findCurrency(rate.CharCode);
      const value = Number(String(rate.Value).replace(',', '.'));
      const nominal = Number(rate.Nominal);

      if (currency && Number.isFinite(value) && Number.isFinite(nominal) && nominal > 0) {
        currency.rateToRub = value / nominal;
        currency.lastUpdated = new Date();
        await currency.save();
      }
    }

    res.json({ updated: new Date().toISOString(), source: cbrUrl, currencies: await Currency.findAll() });
  } catch (error) {
    next(error);
  }
};

exports.getCurrency = async (req, res, next) => {
  try {
    const currency = await findCurrency(req.params.id);

    if (!currency) {
      return res.status(404).json({ error: 'Валюта не найдена' });
    }

    res.json(currency);
  } catch (error) {
    next(error);
  }
};

exports.createCurrency = async (req, res, next) => {
  try {
    const validationError = validateCurrencyBody(req.body);
    const id = typeof req.body?.id === 'string' ? req.body.id.toUpperCase() : '';

    if (validationError || !id) {
      return res.status(400).json({ error: validationError || 'Поле id обязательно и должно быть строкой' });
    }

    if (await findCurrency(id)) {
      return res.status(400).json({ error: 'Валюта с таким id уже существует' });
    }

    const currency = await Currency.create({
      id,
      name: req.body.name.trim(),
      symbol: typeof req.body.symbol === 'string' ? req.body.symbol : '',
      rateToRub: req.body.rateToRub
    });

    res.status(201).json(currency);
  } catch (error) {
    next(error);
  }
};

exports.updateCurrency = async (req, res, next) => {
  try {
    const currency = await findCurrency(req.params.id);

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
    currency.lastUpdated = new Date();
    await currency.save();

    res.json(currency);
  } catch (error) {
    next(error);
  }
};

exports.deleteCurrency = async (req, res, next) => {
  try {
    const deleted = await Currency.destroy({ where: { id: String(req.params.id).toUpperCase() } });

    if (!deleted) {
      return res.status(404).json({ error: 'Валюта не найдена' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

exports.convertCurrency = async (req, res, next) => {
  try {
    const { from, to, amount } = req.body || {};
    const numericAmount = Number(amount);
    const source = typeof from === 'string' ? await findCurrency(from) : null;
    const target = typeof to === 'string' ? await findCurrency(to) : null;

    if (!source || !target || !Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'Укажите from, to и неотрицательный числовой amount для существующих валют' });
    }

    const rate = Number(source.rateToRub) / Number(target.rateToRub);
    res.json({
      from: source.id,
      to: target.id,
      amount: numericAmount,
      rate: Number(rate.toFixed(6)),
      result: Number((numericAmount * rate).toFixed(2)),
      source: 'Внутренний учебный набор курсов; готов к замене на API ЦБ РФ'
    });
  } catch (error) {
    next(error);
  }
};