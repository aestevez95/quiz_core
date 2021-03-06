'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

      return queryInterface.bulkInsert('Quizzes', [ 
         { question: 'Capital de Italia', answer: 'Roma', ranking: 0, votos: 0,
           createdAt: new Date(), updatedAt: new Date() },
         { question: 'Capital de Portugal', answer: 'Lisboa', ranking: 0, votos: 0,
           createdAt: new Date(), updatedAt: new Date() },
         { question: 'Capital de España', answer: 'Madrid', ranking:0, votos: 0,
           createdAt: new Date(), updatedAt: new Date() },
        ]);
  },

  down: function (queryInterface, Sequelize) {
      return queryInterface.bulkDelete('Quizzes', null, {});
  }
};

