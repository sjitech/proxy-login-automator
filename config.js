var db_config = {};

db_config.host = process.env.DB_HOST || "localhost";
db_config.user = process.env.DB_USER || "root";
db_config.password = process.env.DB_PASS || "secret";
db_config.database = process.env.DB_NAME || "homestead" ;

module.exports = db_config;