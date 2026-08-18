const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pharmaql' });

async function check() {
  const res = await pool.query("SELECT * FROM \"user\" WHERE email = 'hemang2009uppl@gmail.com'");
  console.log("Users:", res.rows);
  
  const res2 = await pool.query("SELECT * FROM \"medical_representatives\" WHERE email = 'hemang2009uppl@gmail.com'");
  console.log("MRs:", res2.rows);
  
  pool.end();
}
check();
