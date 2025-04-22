const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'aarish', // Change this to your PostgreSQL password
  port: 5432,
  database: 'airlinedb',
  authentication_timeout: 10000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;