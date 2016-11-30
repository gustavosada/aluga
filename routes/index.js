var express = require('express');
var db = require('../initDB');
var router = express.Router();

router.get('/', function(req, res) {
  res.send('../home.html');
});

router.get('/register', function(req, res) {
  var username = req.query.username;
  var password = req.query.password;
  db.none('INSERT INTO users(username, password) VALUES($1, $2)', [username, password])
    .then(function() {
      res.send({status: true});
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({status: false});
    })
});

router.get('/login', function(req, res) {
  var username = req.query.username;
  var password = req.query.password;
  db.one('SELECT id FROM users WHERE username=$1 AND password=$2', [username, password])
    .then(function(data) {
      res.send({id: data.id, username: username});
    })
    .catch(function(err) {
      console.log(err);
      res.send({});
    })
});

router.get('/createGroup', function(req, res) {
  var users = req.query.users;

  db.one('INSERT INTO groups DEFAULT VALUES RETURNING id')
    .then(function(data) {
      groupId = data.id;
      while(users.length > 0) {
        db.none('INSERT INTO groups_users VALUES($1, (SELECT id FROM users WHERE username=$2))', [groupId, users.pop()])
        .catch(function(err) {
          console.log(err.message);
        })
      }
      res.send({status: true});
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({status: false});
    });
});

router.get('/createAd', function(req, res) {
  var title = req.query.title;
  var description = req.query.description;
  var address = req.query.address;
  var price = req.query.price;
  var userId = req.query.userId;

  console.log(JSON.stringify(req.query));

  db.none('INSERT INTO estate_ads(title, description, address, price, user_id) VALUES($1, $2, $3, $4, $5)', [title, description, address, price, userId])
  .then(function() {
    res.send({status: true});
  })
  .catch(function(err) {
    console.log(err.message);
    res.send({status: false});
  })
});

router.get('/rent', function(req, res) { //bug: cria grupo mesmo se nao existir o imovel, n tem problema
  var estateId = req.query.estateId;
  var userId = req.query.userId;

  db.any('SELECT group_id FROM groups_users WHERE user_id = $1', userId)
    .then(function(data) {
      if(data.length > 0) {
        var groupId = data.group_id;
        db.none('INSERT INTO estates_groups VALUES($1, $2)', [estateId, groupId])
          .then(function() {
            res.send({status: true});
          })
          .catch(function(err) {
            console.log(err.message);
            res.send({status: false});
          })
      }
      else {
        db.one('INSERT INTO groups DEFAULT VALUES RETURNING id')
          .then(function(data) {
            var groupId = data.id;
            db.none('INSERT INTO groups_users VALUES($1, $2)', [groupId, userId])
              .then(function() {
                db.none('INSERT INTO estates_groups VALUES($1, $2)', [estateId, groupId])
                  .then(function() {
                    res.send({status: true});
                  })
                  .catch(function(err) {
                    console.log(err.message);
                    res.send({status: false});
                  })
              })
              .catch(function(err) {
                console.log(err.message);
                res.send({status: false});
              })
          })
          .catch(function(err) {
            console.log(err.message);
            res.send({status: false});
          })
      }
    })
    .catch(function(err) {
      console.log(err);
      res.send({status: false});
    })

});

router.get('/getGroup', function(req, res) {
  //devolve preco total e outros usuarios
  var user = req.query.userId;
  db.one('SELECT group_id FROM groups_users WHERE user_id = $1', user)
    .then(function(data) {
      var groupId = data.group_id;
      if(groupId) {
        db.any('SELECT username FROM users WHERE id IN (SELECT user_id FROM groups_users WHERE group_id = $1)', groupId)
          .then(function(data) {
            var users = [];
            for(row in data) {
              users.push(data[row].username);
            }
            db.one('SELECT price FROM estate_ads WHERE id = (SELECT estate_ad_id FROM estates_groups WHERE group_id = $1)', groupId)
              .then(function(data) {
                var price = data.price;
                res.send({users: users, price: price});
              })
              .catch(function(err) {
                console.log(err.message);
                res.send({users: users});
              });
          })
          .catch(function(err) {
            console.log(err.message);
            res.send({});
          })
      }
      else {
        res.send({});
      }
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({});
    });
});

router.get('/quitGroup', function(req, res) {
  //sai do grupo e deleta a entrada caso seja o unico usuario do grupo
  var userId = req.query.userId;
  db.one('DELETE FROM groups_users WHERE user_id = $1 RETURNING group_id', userId)
    .then(function(data) {
      var groupId = data.group_id;
      db.any('SELECT * FROM groups_users WHERE group_id = $1', groupId)
        .then(function(data) {
          console.log(JSON.stringify(data));
          if(data.length == 0) {
            db.none('DELETE FROM estates_groups WHERE group_id = $1', groupId)
              .then(function() {
                db.none('DELETE FROM groups WHERE id = $1', groupId)
                  .then(function() {
                    console.log('AGORA FOI');
                    res.send({status: true});
                  })
                  .catch(function(err) {
                    console.log(err.message);
                    res.send({status: false});
                  });
              })
              .catch(function(err) {
                console.log(err.message);
                res.send({status: false});
              });
          }
          else {
            console.log('KCT');
            res.send({status: true});
          }
        })
        .catch(function(err) {
          console.log(err.message);
          res.send({status: false});
        });
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({status: false});
    });
});

router.get('/getAds', function(req, res) { //ajeitar para retornar nome do dono e nao id
  //recebe todos os imoveis
  db.any('SELECT * FROM estate_ads')
    .then(function(data) {
      res.send(JSON.stringify(data));
    })
    .catch(function(err) {
      res.send({});
    });
});

router.get('/getRentEstate', function(req, res) {
  //mostra info do imovel alugado
  var userId = req.query.userId;
  db.any('SELECT * FROM estate_ads WHERE id = (SELECT estate_id FROM estates_groups WHERE group_id = (SELECT group_id FROM groups_users WHERE user_id = $1))', userId)
    .then(function(data) {
      res.send(JSON.stringify(data));
    })
    .catch(function(err) {
      res.send({});
    });
});

router.get('/getMyAds', function(req, res) {
  //mostra ads dos imoveis que a pessoa botou pra alugar, mostra se ta alugado ou nao e da opcao de excluir
  var userId = req.query.userId;
  db.any('SELECT * FROM estate_ads WHERE user_id = $1', userId)
    .then(function(data) {
      res.send(JSON.stringify(data));
    })
    .catch(function(err) {
      res.send({});
    });
});

router.get('/removeAd', function(req, res) {
  //remove uma ad do usuario
  //se excluir tira a relacao de alugel com o grupo
  var estateId = req.query.estateId;
  db.none('DELETE FROM estates_groups WHERE estate_ad_id = $1', estateId)
    .then(function(data) {
      db.none('DELETE FROM estate_ads WHERE id = $1', estateId)
        .then(function(data) {
          res.send({status: true});
        })
        .catch(function(err) {
          console.log(err.message);
          res.send({status: false});
        });
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({status: false});
    });
});

router.get('/getUsers', function(req, res) {
  db.any('SELECT username FROM users')
    .then(function(data) {
      var users = [];
      for(row in data) {
        users.push(data[row].username);
      }
      res.send(users);
    })
    .catch(function(err) {
      console.log(err.message);
      res.send({});
    });
});

module.exports = router;
