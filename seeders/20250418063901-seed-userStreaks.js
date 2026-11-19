'use strict';

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const userId = "82d7fb57-9190-43d2-b501-606222e37228";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const start14 = new Date(yesterday);
    start14.setDate(yesterday.getDate() - 13);

    const streaks = [
      {
        id: "9492d0e8-2d7a-48a9-b68b-5661632136ae",
        userId,
        startDate: '2025-03-01',
        endDate: '2025-03-10',
        streakLength: 10,
        isActive: false,
        createdAt: new Date('2025-03-01'),
        updatedAt: new Date('2025-03-10')
      },
      {
        id: "43d331c6-cb03-485e-8ea9-c693e28162bb",
        userId,
        startDate: '2025-04-20',
        endDate: '2025-04-20',
        streakLength: 1,
        isActive: false,
        createdAt: new Date('2025-04-20'),
        updatedAt: new Date('2025-04-20')
      },
      {
        id: "6a098a01-f800-4ffe-9126-8b3efab05ad9",
        userId,
        startDate: fmt(start14),
        endDate: fmt(yesterday),
        streakLength: 14,
        isActive: true,
        createdAt: start14,
        updatedAt: yesterday
      }
    ];

    await queryInterface.bulkInsert('UserStreaks', streaks, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('UserStreaks', null, {});
  }
};
