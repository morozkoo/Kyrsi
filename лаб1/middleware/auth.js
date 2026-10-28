const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Требуется токен Authorization: Bearer <token>' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET не задан в переменных окружения' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
};

exports.requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }

    next();
  } catch (error) {
    next(error);
  }
};