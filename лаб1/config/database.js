require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/currency_converter';
const useSsl = Boolean(process.env.DATABASE_URL)
  && !process.env.DATABASE_URL.includes('localhost')
  && !process.env.DATABASE_URL.includes('127.0.0.1');

const sequelize = new Sequelize(
  databaseUrl,
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: useSsl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {}
  }
);

module.exports = sequelize;