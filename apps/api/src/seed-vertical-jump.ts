import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedVerticalJump() {
  console.log('--- Seeding Countermovement Vertical Jump Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Countermovement Vertical Jump';
    const category = 'Lower Body';
    const subcategory = 'Athletic Performance';
    const cameraAngle = 'FRONT';
    const videoPath = '';
    const imagePath = '';
    const description = 'Athletic vertical power test. Stand tall, execute an explosive countermovement dip, propel upward with maximal force reaching peak height, and absorb impact softly with proper knee alignment.';

    // 1. Check if exercise already exists
    let exerciseId: string;
    const existingEx = await query('SELECT id FROM exercises WHERE name = $1 AND (is_deleted = false OR is_deleted IS NULL)', [exerciseName]);

    if (existingEx.rows.length > 0) {
      exerciseId = existingEx.rows[0].id;
      console.log(`Updating existing exercise ID ${exerciseId}: ${exerciseName}`);
      await query(
        `UPDATE exercises SET 
          description = $1, 
          category = $2, 
          subcategory = $3, 
          camera_angle = $4, 
          image_path = $5, 
          video_path = $6, 
          status = true 
        WHERE id = $7`,
        [description, category, subcategory, cameraAngle, imagePath, videoPath, exerciseId]
      );
    } else {
      console.log(`Inserting new exercise: ${exerciseName}`);
      const insertEx = await query(
        `INSERT INTO exercises (name, description, category, subcategory, camera_angle, image_path, video_path, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
        [exerciseName, description, category, subcategory, cameraAngle, imagePath, videoPath]
      );
      exerciseId = insertEx.rows[0].id;
    }

    // 2. Define the dynamic profile phases
    const dynamicProfile = {
      phases: [
        {
          name: 'Setup & Standing Neutral',
          isSetupPhase: true,
          entryCue: 'Stand tall with feet shoulder-width apart and look straight ahead.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'KNEE_ANGLE', operator: '>=', value: 160, isBlocking: true },
            { id: 'ec-setup-2', metric: 'HIP_HINGE_ANGLE', operator: '>=', value: 165, isBlocking: true }
          ],
          formChecks: []
        },
        {
          name: 'Countermovement Dip',
          isSetupPhase: false,
          entryCue: 'Dip through your hips and knees to load for takeoff.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-dip-1', metric: 'KNEE_ANGLE', operator: '<=', value: 125, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-dip-1', metric: 'KNEE_VALGUS_RATIO', operator: '<', value: 0.80, message: 'Push knees outward, do not let them cave in.', isBlocking: false }
          ]
        },
        {
          name: 'Explosive Apex',
          isSetupPhase: false,
          entryCue: 'Explode upward with maximal power!',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-jump-1', metric: 'VERTICAL_JUMP_HEIGHT', operator: '>=', value: 20, isBlocking: true }
          ],
          formChecks: []
        },
        {
          name: 'Soft Landing & Cushion',
          isSetupPhase: false,
          entryCue: 'Land softly on the balls of your feet and cushion through your knees.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-land-1', metric: 'KNEE_ANGLE', operator: '>=', value: 155, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-land-1', metric: 'KNEE_VALGUS_RATIO', operator: '<', value: 0.82, message: 'Keep knees tracking over toes on landing.', isBlocking: false }
          ]
        }
      ]
    };

    // 3. Upsert dynamic profile into exercise_pose_rules
    const existingRule = await query('SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2', [exerciseId, 'DYNAMIC_PROFILE']);

    if (existingRule.rows.length > 0) {
      console.log(`Updating DYNAMIC_PROFILE rule for exercise ID ${exerciseId}`);
      await query(
        `UPDATE exercise_pose_rules SET 
          threshold_value = $1, 
          rule_type = 'PHASE_SEQUENCE',
          exercise_name = $2
        WHERE id = $3`,
        [JSON.stringify(dynamicProfile), exerciseName, existingRule.rows[0].id]
      );
    } else {
      console.log(`Inserting DYNAMIC_PROFILE rule for exercise ID ${exerciseId}`);
      await query(
        `INSERT INTO exercise_pose_rules (exercise_id, exercise_name, rule_name, rule_type, threshold_value, creator_type) 
         VALUES ($1, $2, $3, $4, $5, 'system')`,
        [exerciseId, exerciseName, 'DYNAMIC_PROFILE', 'PHASE_SEQUENCE', JSON.stringify(dynamicProfile)]
      );
    }

    console.log('✅ Successfully seeded Countermovement Vertical Jump exercise!');
  } catch (err) {
    console.error('Error seeding vertical jump exercise:', err);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seedVerticalJump();
}

export { seedVerticalJump };
