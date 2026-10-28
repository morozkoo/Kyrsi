module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('currencies', 'lastUpdated', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('currencies', 'lastUpdated');
  }
};