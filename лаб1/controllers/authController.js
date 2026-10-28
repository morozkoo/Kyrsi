const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в переменных окружения');
  }

  return process.env.JWT_SECRET;
}

exports.register = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;

    if (!email || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Укажите корректный email и непустой пароль' });
    }

    if (await User.findOne({ where: { email } })) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });

    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    const user = email ? await User.findOne({ where: { email } }) : null;

    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), { expiresIn: '1h' });
    res.json({ token, expiresIn: '1h' });
  } catch (error) {
    next(error);
  }
};

exports.profile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'email', 'role', 'createdAt'] });

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};