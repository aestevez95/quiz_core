var path = require('path');

// Cargar modelo ORM
var Sequelize = require('sequelize');

// Usar BBDD SQLite
var sequelize = new Sequelize("sqlite:///", 
			{ storage: "quiz.sqlite" });

// Importar la definición de la tabla Quiz de quiz.js
var Quiz = sequelize.import(path.join(__dirname,'quiz'));

// sequelize.sync() crea e inicializa tabla de preguntas en DB
sequelize
.sync()
.then(function() { // sync() crea la tabla quiz
  return
    Quiz
    .count()
    .then(function(c) {
      if (c === 0) {       // la tabla se inicializa si está vacía
        return
	  Quiz
	  .create({ question: 'Capital de Italia', answer: 'Roma' })
	  .then(function() {
	    console.log('Base de datos inicializada con datos');
	  });
      }
    });
}).catch(function(error) {
    console.log("Error sincronizando las tablas de la BBDD:", error);
    process.exit(1);
});

exports.Quiz = Quiz; // exportar definición de tabla Quiz












