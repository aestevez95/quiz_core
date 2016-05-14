var express = require('express');
var router = express.Router();

var quizController = require('../controllers/quiz_controller');
var commentController = require('../controllers/comment_controller');

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index');
});

// Autoload de rutas que usen :quizId
router.param('quizId', quizController.load); // autoload :quizId


// Definición de rutas de /quizzes 
router.get('/quizzes', 				quizController.index); // Servir página con listado de preguntas y atender a peticiones de búsqueda
router.get('/quizzes/:quizId(\\d+)', 		quizController.show);
router.get('/quizzes/:quizId(\\d+)/check', 	quizController.check);
router.get('/quizzes/new', 			quizController.new);
router.post('/quizzes', 			quizController.create); // Crear nuevo quiz (post)
router.get('/quizzes/:quizId(\\d+)/edit', 	quizController.edit);
router.put('/quizzes/:quizId(\\d+)', 		quizController.update); // Actualizar un quiz (put)
router.delete('/quizzes/:quizId(\\d+)', 	quizController.destroy); // Borrar un quiz (delete)


//Definición de ruta de author
router.get('/author', 				  quizController.author);
router.get('/quizzes/:quizId(\\d+)/comments/new', commentController.new);
router.post('/quizzes/:quizId(\\d+)/comments',    commentController.create);

module.exports = router;
