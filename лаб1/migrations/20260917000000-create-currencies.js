module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('currencies', {
      id: { type: Sequelize.STRING(3), primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      symbol: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      rateToRub: { type: Sequelize.DECIMAL(12, 4), allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('currencies');
  }
};