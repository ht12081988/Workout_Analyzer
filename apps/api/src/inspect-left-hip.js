const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer' });

async function run() {
  await client.connect();
  const res = await client.query("SELECT id, name FROM exercises WHERE name ILIKE '%Left Hip%' OR name ILIKE '%Standing Hip%'");
  for (const ex of res.rows) {
    console.log(`\n========================================`);
    console.log(`Exercise: ${ex.name} (ID: ${ex.id})`);
    console.log(`========================================`);
    const rules = await client.query("SELECT * FROM exercise_pose_rules WHERE exercise_id = $1", [ex.id]);
    for (const r of rules.rows) {
      console.log(`Rule ID: ${r.id}, Name: ${r.rule_name}, Creator: ${r.creator_type}`);
      const val = typeof r.threshold_value === 'string' ? JSON.parse(r.threshold_value) : r.threshold_value;
      console.log(JSON.stringify(val, null, 2));
    }
  }
  await client.end();
}

run();
