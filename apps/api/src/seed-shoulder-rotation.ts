import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedShoulderRotation() {
  console.log('--- Seeding Shoulder Internal Rotation (90° Abduction) Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Shoulder Internal Rotation (90° Abduction)';
    const category = 'Upper Body';
    const subcategory = 'Shoulder Mobility';
    const cameraAngle = 'SIDE';
    const videoPath = '';
    const imagePath = '';
    const description = 'Strict glenohumeral internal rotation assessment in 90 degrees abduction. Stand sideways to the camera, raise arm with elbow bent at 90 degrees, and rotate forearm downward toward the floor while strictly maintaining elbow lock and upright torso.';

    // 1. Check if exercise already exists
    let exerciseId: number;
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
          name: 'Setup Position',
          isSetupPhase: true,
          entryCue: 'Raise arm to shoulder height with elbow bent at 90 degrees and hand pointing up.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'FOREARM_SAGITTAL_ROTATION', operator: '<=', value: 20, isBlocking: true },
            { id: 'ec-setup-2', metric: 'ELBOW_ANGLE', operator: '>=', value: 75, isBlocking: true },
            { id: 'ec-setup-3', metric: 'ELBOW_ANGLE', operator: '<=', value: 105, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'ELBOW_ANGLE', operator: '<', value: 75, message: 'Keep elbow bent at 90 degrees', isBlocking: false },
            { id: 'fc-setup-2', metric: 'ELBOW_ANGLE', operator: '>', value: 105, message: 'Keep elbow bent at 90 degrees', isBlocking: false }
          ]
        },
        {
          name: 'Internal Rotation Sweep',
          isSetupPhase: false,
          entryCue: 'Slowly rotate your forearm down toward the floor while keeping elbow locked at 90 degrees.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'FOREARM_SAGITTAL_ROTATION', operator: '>=', value: 160, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'ELBOW_ANGLE', operator: '<', value: 75, message: 'Keep elbow locked at 90 degrees!', isBlocking: true },
            { id: 'fc-p2-2', metric: 'ELBOW_ANGLE', operator: '>', value: 105, message: 'Do not extend your elbow, keep 90 degrees!', isBlocking: true },
            { id: 'fc-p2-3', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Do not lean forward to cheat range!', isBlocking: false }
          ]
        },
        {
          name: 'Return & Reset',
          isSetupPhase: false,
          entryCue: 'Rotate arm back up to the starting upright position.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'FOREARM_SAGITTAL_ROTATION', operator: '<=', value: 25, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'ELBOW_ANGLE', operator: '<', value: 75, message: 'Keep elbow at 90 degrees', isBlocking: false },
            { id: 'fc-p3-2', metric: 'ELBOW_ANGLE', operator: '>', value: 105, message: 'Keep elbow at 90 degrees', isBlocking: false }
          ]
        }
      ]
    };

    // 3. Upsert exercise_pose_rules (DYNAMIC_PROFILE)
    const existingRule = await query(
      'SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2 AND creator_type = $3',
      [exerciseId, 'DYNAMIC_PROFILE', 'system']
    );

    if (existingRule.rows.length > 0) {
      console.log('Updating DYNAMIC_PROFILE rule...');
      await query(
        'UPDATE exercise_pose_rules SET threshold_value = $1, exercise_name = $2 WHERE id = $3',
        [JSON.stringify(dynamicProfile), exerciseName, existingRule.rows[0].id]
      );
    } else {
      console.log('Inserting DYNAMIC_PROFILE rule...');
      await query(
        `INSERT INTO exercise_pose_rules (exercise_id, rule_name, rule_type, threshold_value, exercise_name, creator_type) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [exerciseId, 'DYNAMIC_PROFILE', 'custom', JSON.stringify(dynamicProfile), exerciseName, 'system']
      );
    }

    // 4. Seed Voice Cues
    console.log('Seeding voice cues...');
    await query('DELETE FROM voice_cues WHERE exercise_id = $1', [exerciseId]);

    const cues = [
      { raw: 'Keep elbow locked at 90 degrees!', spoken: 'Keep elbow locked at 90 degrees!', display: 'Lock elbow at 90°', type: 'error' },
      { raw: 'Do not extend your elbow, keep 90 degrees!', spoken: 'Do not extend your elbow, keep 90 degrees!', display: 'Keep 90° bend', type: 'error' },
      { raw: 'Do not lean forward to cheat range!', spoken: 'Do not lean forward, keep torso upright', display: 'Keep torso upright', type: 'warning' },
      { raw: 'Keep elbow bent at 90 degrees', spoken: 'Keep elbow bent at 90 degrees', display: 'Bend elbow 90°', type: 'info' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Shoulder Internal Rotation (90° Abduction) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await client.end();
  }
}

seedShoulderRotation();
