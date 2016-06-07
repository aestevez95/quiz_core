'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
      return queryInterface.addColumn( 'Quizzes', 
                                        'ranking', 
                                        { type: Sequelize.INTEGER,
                                          defaultValue: 0
                                        }
                                      );
  },

  down: function (queryInterface, Sequelize) {
      return queryInterface.removeColumn('Quizzes','ranking');
  }
};
