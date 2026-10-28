const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('1', 10);

    await queryInterface.sequelize.query(`
      INSERT INTO users (email, "passwordHash", role, "createdAt", "updatedAt")
      VALUES
        ('test@gmail.com', :passwordHash, 'user', NOW(), NOW()),
        ('admin@gmail.com', :passwordHash, 'admin', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
      SET "passwordHash" = EXCLUDED."passwordHash",
          role = EXCLUDED.role,
          "updatedAt" = NOW()
    `, { replacements: { passwordHash } });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: ['test@gmail.com', 'admin@gmail.com']
    });
  }
};