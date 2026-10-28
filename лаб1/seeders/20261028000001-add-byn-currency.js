module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO currencies (id, name, symbol, "rateToRub")
      VALUES ('BYN', 'Белорусский рубль', 'Br', 27.4514)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          "rateToRub" = EXCLUDED."rateToRub"
    `);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('currencies', { id: 'BYN' });
  }
};