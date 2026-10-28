const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Currency = sequelize.define('Currency', {
  id: { type: DataTypes.STRING(3), primaryKey: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  symbol: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
  rateToRub: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
  lastUpdated: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'currencies',
  timestamps: false
});

module.exports = Currency;