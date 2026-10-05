import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedShoulderFlexionExtension() {
  console.log('--- Seeding Shoulder Flexion & Extension (Side View) Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Shoulder Flexion & Extension (Side View)';
    const category = 'Upper Body';
    const subcategory = 'Shoulder Mobility';
    const cameraAngle = 'SIDE';
    const videoPath = '';
    const imagePath = '';
    const description = 'Active sagittal shoulder mobility assessment. Stand sideways to the camera, raise your straight arm forward and overhead as high as you can, return to your thigh, then reach straight backward into extension without torso compensation.';

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
          entryCue: 'Stand sideways with your arm resting straight at your thigh.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'SHOULDER_FLEXION', operator: '<=', value: 20, isBlocking: true },
            { id: 'ec-setup-2', metric: 'ELBOW_ANGLE', operator: '>=', value: 160, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Stand tall with torso upright', isBlocking: false }
          ]
        },
        {
          name: 'Overhead Flexion Reach',
          isSetupPhase: false,
          entryCue: 'Raise your straight arm forward and overhead as high as you can.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'SHOULDER_FLEXION', operator: '>=', value: 165, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'ELBOW_ANGLE', operator: '<', value: 155, message: 'Keep your arm completely straight!', isBlocking: false },
            { id: 'fc-p2-2', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Do not lean back to fake range!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Thigh',
          isSetupPhase: false,
          entryCue: 'Lower your arm back down to your thigh.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'SHOULDER_FLEXION', operator: '<=', value: 25, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'ELBOW_ANGLE', operator: '<', value: 155, message: 'Keep arm straight', isBlocking: false }
          ]
        },
        {
          name: 'Backward Extension Reach',
          isSetupPhase: false,
          entryCue: 'Reach your straight arm backward behind your body as far as you can.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p4-1', metric: 'SHOULDER_EXTENSION', operator: '>=', value: 45, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p4-1', metric: 'ELBOW_ANGLE', operator: '<', value: 155, message: 'Do not bend your elbow!', isBlocking: false },
            { id: 'fc-p4-2', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Do not lean your torso forward!', isBlocking: false }
          ]
        },
        {
          name: 'Return & Complete',
          isSetupPhase: false,
          entryCue: 'Return arm back to your side. Rep complete!',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p5-1', metric: 'SHOULDER_EXTENSION', operator: '<=', value: 15, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p5-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Keep torso upright', isBlocking: false }
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
      { raw: 'Keep your arm completely straight!', spoken: 'Keep your arm straight!', display: 'Straighten arm', type: 'warning' },
      { raw: 'Do not lean back to fake range!', spoken: 'Do not lean back, keep torso neutral', display: 'Keep torso neutral', type: 'warning' },
      { raw: 'Do not bend your elbow!', spoken: 'Do not bend your elbow', display: 'Lock elbow straight', type: 'warning' },
      { raw: 'Do not lean your torso forward!', spoken: 'Do not lean forward, keep chest tall', display: 'Do not lean forward', type: 'warning' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Shoulder Flexion & Extension (Side View) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await client.end();
  }
}

seedShoulderFlexionExtension();
