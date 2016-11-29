var pgp = require("pg-promise")();
db = pgp("postgres://postgres:whenyougrowup@127.0.0.1:5432/embarcados");
module.exports = db;
