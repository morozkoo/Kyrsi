const mongoose = require('mongoose');
const MongoCurrency = require('../models/mongoCurrency');

function validId(id, res) {
  if (mongoose.isValidObjectId(id)) return true;
  res.status(400).json({ error: 'Некорректный ObjectId' });
  return false;
}

function currencyInput(body) {
  return {
    code: typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '',
    name: body?.name,
    symbol: body?.symbol === undefined ? '' : body.symbol,
    rateToRub: body?.rateToRub
  };
}

function currencyError(fields) {
  if (!/^[A-Z]{3}$/.test(fields.code)) return 'Код валюты должен состоять из трёх латинских букв';
  if (typeof fields.name !== 'string' || !fields.name.trim()) return 'Укажите название валюты';
  if (fields.symbol !== undefined && typeof fields.symbol !== 'string') return 'Поле symbol должно быть строкой';
  if (typeof fields.rateToRub !== 'number' || !Number.isFinite(fields.rateToRub) || fields.rateToRub <= 0) {
    return 'Курс rateToRub должен быть положительным числом';
  }
  return null;
}

function rateError(entry) {
  if (typeof entry.rateToRub !== 'number' || !Number.isFinite(entry.rateToRub) || entry.rateToRub <= 0) {
    return 'Курс rateToRub должен быть положительным числом';
  }
  if (!['manual', 'cbr'].includes(entry.source)) return 'Источник должен быть manual или cbr';
  if (typeof entry.note !== 'string') return 'Поле note должно быть строкой';
  return null;
}

function rateInput(body) {
  return {
    rateToRub: body?.rateToRub,
    source: body?.source === undefined ? 'manual' : body.source,
    note: body?.note === undefined ? '' : body.note
  };
}

exports.list = async (req, res, next) => {
  try {
    res.json(await MongoCurrency.find().sort({ code: 1 }));
  } catch (error) { next(error); }
};

exports.get = async (req, res, next) => {
  if (!validId(req.params.id, res)) return;
  try {
    const currency = await MongoCurrency.findById(req.params.id);
    if (!currency) return res.status(404).json({ error: 'Валюта не найдена' });
    res.json(currency);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const fields = currencyInput(req.body);
    const error = currencyError(fields);
    if (error) return res.status(400).json({ error });
    const currency = await MongoCurrency.create({
      ...fields,
      rateHistory: [rateInput({ rateToRub: fields.rateToRub })]
    });
    res.status(201).json(currency);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  if (!validId(req.params.id, res)) return;
  try {
    const fields = currencyInput(req.body);
    const error = currencyError(fields);
    if (error) return res.status(400).json({ error });
    const currency = await MongoCurrency.findByIdAndUpdate(req.params.id, {
      $set: fields,
      $push: { rateHistory: rateInput({ rateToRub: fields.rateToRub }) }
    }, { new: true, runValidators: true });
    if (!currency) return res.status(404).json({ error: 'Валюта не найдена' });
    res.json(currency);
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  if (!validId(req.params.id, res)) return;
  try {
    const currency = await MongoCurrency.findByIdAndDelete(req.params.id);
    if (!currency) return res.status(404).json({ error: 'Валюта не найдена' });
    res.json(currency);
  } catch (error) { next(error); }
};

exports.addRate = async (req, res, next) => {
  if (!validId(req.params.id, res)) return;
  try {
    const entry = rateInput(req.body);
    const error = rateError(entry);
    if (error) return res.status(400).json({ error });
    const currency = await MongoCurrency.findByIdAndUpdate(req.params.id, {
      $set: { rateToRub: entry.rateToRub },
      $push: { rateHistory: entry }
    }, { new: true, runValidators: true });
    if (!currency) return res.status(404).json({ error: 'Валюта не найдена' });
    res.json(currency);
  } catch (error) { next(error); }
};

exports.updateRateNote = async (req, res, next) => {
  if (!validId(req.params.id, res) || !validId(req.params.entryId, res)) return;
  if (typeof req.body?.note !== 'string') {
    return res.status(400).json({ error: 'Поле note должно быть строкой' });
  }
  try {
    const currency = await MongoCurrency.findOneAndUpdate(
      { _id: req.params.id, 'rateHistory._id': req.params.entryId },
      { $set: { 'rateHistory.$.note': req.body.note.trim() } },
      { new: true, runValidators: true }
    );
    if (!currency) return res.status(404).json({ error: 'Валюта или запись истории не найдена' });
    res.json(currency);
  } catch (error) { next(error); }
};

exports.handleError = (error, req, res, next) => {
  if (error?.code === 11000) {
    return res.status(409).json({ error: 'Валюта с таким кодом уже существует' });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  next(error);
};
