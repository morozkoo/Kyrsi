require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/currency_converter';
const useSsl = Boolean(process.env.DATABASE_URL)
  && !process.env.DATABASE_URL.includes('localhost')
  && !process.env.DATABASE_URL.includes('127.0.0.1');
const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

module.exports = {
  development: { url: databaseUrl, dialect: 'postgres', dialectOptions },
  test: { url: databaseUrl, dialect: 'postgres', dialectOptions },
  production: { url: databaseUrl, dialect: 'postgres', dialectOptions }
};