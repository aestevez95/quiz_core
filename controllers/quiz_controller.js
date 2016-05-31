var models = require('../models');
var Sequelize = require('sequelize');
var cloudinary = require('cloudinary');
var fs = require('fs');


// Opciones para imagenes subidas a Cloudinary
var cloudinary_image_options = { crop: 'limit', width: 200, height: 200, radius: 5, 
                                 border: "3px_solid_blue", tags: ['core', 'quiz-2016'] };


// Autoload el quiz asociado a :quizId
exports.load = function(req, res, next, quizId) {
	models.Quiz.findById(quizId, {attributes: ['id', 'question', 'answer', 'AuthorId'], include: [ 
                                      {model: models.Comment, include: [ 
                                            {model: models.User, as: 'Author', attributes: ['username']} ]}, 
                                      models.Attachment ] })
		.then(function(quiz) {
			if (quiz) {
				req.quiz = quiz;
				next();
			} else {
				next(new Error('No existe quizId=' + quizId));
			}
		})
		.catch(function(error) { 
			next(error); 
		});
};


// Autoload del formato. Pasado como :format?
exports.loadFormat = function(req, res, next, format) {
	req.format = format;
	next();
};


// MW que permite acciones solamente si al usuario logeado es admin o es el autor del quiz.
exports.ownershipRequired = function(req, res, next){

    var isAdmin      = req.session.user.isAdmin;
    var quizAuthorId = req.quiz.AuthorId;
    var loggedUserId = req.session.user.id;

    if (isAdmin || quizAuthorId === loggedUserId) {
        next();
    } else {
      console.log('Operación prohibida: El usuario logeado no es el autor del quiz, ni un administrador.');
      res.send(403);
    }
};


// GET /quizzes 
exports.index = function(req, res, next) {
	var searchText = req.query.search;
	if(!searchText) { // Decidir si buscar texto o simplemente servir listado completo de preguntas
		models.Quiz.findAll({ include: [models.Attachment, {model: models.User, as: 'Author', attributes: ['username']}] })
			.then(function(quizzes) {
				if(req.format === 'json') { 			// Comprobamos si es una petición de formato json
				   var string = '';				// Si es Json
				   for (var i in quizzes) {
				      string = string + JSON.stringify(quizzes[i]);
				   }
				   res.send(string);								
				} else {                                        // Si es http o cualquier otro formato...
				   res.render('quizzes/index.ejs', { quizzes: quizzes, resultado: false}); 	
				}
			})
			.catch(function(error) {
				next(error);
			});
	} else {
		searchText = '%' + searchText + '%'; // Delimitamos con % por delante y por detrás
		searchText = searchText.replace(/\s/g, '%'); // Cambiamos espacios en blanco por %		

		models.Quiz.findAll({where: ["question like ?", searchText], include: [models.Attachment, {model: models.User, as: 'Author', attributes: ['username']}] })
			.then(function(quizzes) {
				if(req.format === 'json') { 			// Comprobamos si es una petición de formato json
				   var string = '';				// Si es Json
				   for (var i in quizzes) {
				      string = string + JSON.stringify(quizzes[i]);
				   }
				   res.send(string);	
				} else {					// Si es http o cualquier otro formato...
				   res.render('quizzes/index.ejs', { quizzes: quizzes, resultado: true});
				}				
			})
			.catch(function(error) {
				next(error);
			});
	}
};


// GET /quizzes/:id
exports.show = function(req, res, next) {
	if(req.format === 'json') { 
	   res.send(JSON.stringify(req.quiz));
	} else {
	   var answer = req.query.answer || '';
	   res.render('quizzes/show', { quiz:   req.quiz,
					answer: answer});
	}
};


// GET /quizzes/:id/check
exports.check = function(req, res) {
	var answer = req.query.answer || "";
	var result = answer === req.quiz.answer ? 'correcta' : 'incorrecta';
	res.render('quizzes/result', { quiz: req.quiz, 
				       result: result, 
				       answer: answer });	
};


// GET /quizzes/new
exports.new = function(req, res, next) {
	var quiz = models.Quiz.build({question: "", answer: ""});
	res.render('quizzes/new', {quiz: quiz});
};


// POST /quizzes/create
exports.create = function(req, res, next) {

        // URL al que volver despues de borrar el quiz.  
        var redir = "/quizzes";


	var authorId = req.session.user && req.session.user.id || 0;
	var quiz = models.Quiz.build({ question: req.body.quiz.question, 
  	                               answer:   req.body.quiz.answer,
				       AuthorId: authorId });

	// guarda en BD los campos pregunta y respuesta de quiz
	quiz.save({fields: ["question", "answer", "AuthorId"]})
  		.then(function(quiz) {
			req.flash('success', 'Quiz creado con éxito.');

			if (!req.file) { 
            		   req.flash('info', 'Es un Quiz sin imagen.');
            		return; 
			}

			// Salvar la imagen en Cloudinary
        		return uploadResourceToCloudinary(req)
        			.then(function(uploadResult) {
            				// Crear nuevo attachment en la BBDD.
            				return createAttachment(req, uploadResult, quiz);
        		});

    		})
    		.then(function() {
        		res.redirect(redir);
    		})
		.catch(Sequelize.ValidationError, function(error) {
			req.flash('error', 'Errores en el formulario:');
			for (var i in error.errors) {
				req.flash('error', error.errors[i].value);
			};
			res.render('quizzes/new', {quiz: quiz});
		})
    		.catch(function(error) {
			req.flash('error', 'Error al crear un Quiz: ' + error.message);			
			next(error);
	});  
};


// GET /quizzes/:id/edit
exports.edit = function(req, res, next) {
  var quiz = req.quiz;  // req.quiz: autoload de instancia de quiz
  res.render('quizzes/edit', {quiz: quiz});
};


// PUT /quizzes/:id
exports.update = function(req, res, next) {
  
  // URL al que volver despues de borrar el quiz.  
  var redir = "/quizzes";


  req.quiz.question = req.body.quiz.question;
  req.quiz.answer   = req.body.quiz.answer;

  req.quiz.save({fields: ["question", "answer"]})
    .then(function(quiz) {

      req.flash('success', 'Quiz editado con éxito.');

      // Sin imagen: Eliminar attachment e imagen viejos.
      if (!req.file) { 
          req.flash('info', 'Tenemos un Quiz sin imagen.');
          if (quiz.Attachment) {
              cloudinary.api.delete_resources(quiz.Attachment.public_id);
              return quiz.Attachment.destroy();
          }
          return; 
        }  

        // Salvar la imagen nueva en Cloudinary
        return uploadResourceToCloudinary(req)
        .then(function(uploadResult) {
            // Actualizar el attachment en la BBDD.
            return updateAttachment(req, uploadResult, quiz);
        });
    
    })            
    .then(function() {
        res.redirect(redir); // Redirección HTTP a lista de preguntas.
    })
    .catch(Sequelize.ValidationError, function(error) {

      req.flash('error', 'Errores en el formulario:');
      for (var i in error.errors) {
          req.flash('error', error.errors[i].value);
      };

      res.render('quizzes/edit', {quiz: req.quiz});
    })
    .catch(function(error) {
      req.flash('error', 'Error al editar el Quiz: ' + error.message);
      next(error);
    });
};


// DELETE /quizzes/:id
exports.destroy = function(req, res, next) {
  
  // URL al que volver despues de borrar el quiz.  
  var redir = "/quizzes";

  // Borrar la imagen de Cloudinary (Ignoro resultado)
  if (req.quiz.Attachment) {
      cloudinary.api.delete_resources(req.quiz.Attachment.public_id);
  }

  req.quiz.destroy()
    .then( function() {
	  req.flash('success', 'Quiz borrado con éxito.');
      	  res.redirect(redir);
    })
    .catch(function(error){
	  req.flash('error', 'Error al editar el Quiz: ' + error.message);
      	  next(error);
    });
};


// GET /creditos
exports.author = function (req, res, next) {
	res.render('author');
}


// FUNCIONES AUXILIARES

/**
 * Crea una promesa para crear un attachment en la tabla Attachments.
 */
function createAttachment(req, uploadResult, quiz) {
    if (!uploadResult) {
        return Promise.resolve();
    }

    return models.Attachment.create({ public_id: uploadResult.public_id,
                                      url: uploadResult.url,
                                      filename: req.file.originalname,
                                      mime: req.file.mimetype,
                                      QuizId: quiz.id })
    .then(function(attachment) {
        req.flash('success', 'Imagen nueva guardada con éxito.');
    })
    .catch(function(error) { // Ignoro errores de validacion en imagenes
        req.flash('error', 'No se ha podido salvar la nueva imagen: '+error.message);
        cloudinary.api.delete_resources(uploadResult.public_id);
    });
}


/**
 * Crea una promesa para actualizar un attachment en la tabla Attachments.
 */
function updateAttachment(req, uploadResult, quiz) {
    if (!uploadResult) {
        return Promise.resolve();
    }

    // Recordar public_id de la imagen antigua.
    var old_public_id = quiz.Attachment ? quiz.Attachment.public_id : null;

    return quiz.getAttachment()
    .then(function(attachment) {
        if (!attachment) {
            attachment = models.Attachment.build({ QuizId: quiz.id });
        }
        attachment.public_id = uploadResult.public_id;
        attachment.url = uploadResult.url;
        attachment.filename = req.file.originalname;
        attachment.mime = req.file.mimetype;
        return attachment.save();
    })
    .then(function(attachment) {
        req.flash('success', 'Imagen nueva guardada con éxito.');
        if (old_public_id) {
            cloudinary.api.delete_resources(old_public_id);
        }
    })
    .catch(function(error) { // Ignoro errores de validacion en imagenes
        req.flash('error', 'No se ha podido salvar la nueva imagen: '+error.message);
        cloudinary.api.delete_resources(uploadResult.public_id);
    });
}


/**
 * Crea una promesa para subir una imagen nueva a Cloudinary. 
 * Tambien borra la imagen original.
 * 
 * Si puede subir la imagen la promesa se satisface y devuelve el public_id y 
 * la url del recurso subido. 
 * Si no puede subir la imagen, la promesa tambien se cumple pero devuelve null.
 *
 * @return Devuelve una Promesa. 
 */
function uploadResourceToCloudinary(req) {
    return new Promise(function(resolve,reject) {
        var path = req.file.path;
        cloudinary.uploader.upload(path, function(result) {
                fs.unlink(path); // borrar la imagen subida a ./uploads
                if (! result.error) {
                    resolve({ public_id: result.public_id, url: result.secure_url });
                } else {
                    req.flash('error', 'No se ha podido salvar la nueva imagen: '+result.error.message);
                    resolve(null);
                }
            },
            cloudinary_image_options
        );
    })
}

