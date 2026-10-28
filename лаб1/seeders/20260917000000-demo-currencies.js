module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('currencies', [
      { id: 'RUB', name: 'Российский рубль', symbol: '₽', rateToRub: 1 },
      { id: 'USD', name: 'Доллар США', symbol: '$', rateToRub: 92.5 },
      { id: 'EUR', name: 'Евро', symbol: '€', rateToRub: 100.2 },
      { id: 'CNY', name: 'Китайский юань', symbol: '¥', rateToRub: 12.8 },
      { id: 'BYN', name: 'Белорусский рубль', symbol: 'Br', rateToRub: 27.4514 }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('currencies', null, {});
  }
};