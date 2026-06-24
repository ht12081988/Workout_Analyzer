const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Admin%40123@localhost:5432/Workout_Analyzer',
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT rep_id, frame_number, frame_type, timestamp FROM workout_landmark_frames ORDER BY timestamp DESC LIMIT 14;');
  console.log(res.rows);
  await client.end();
}

run();
