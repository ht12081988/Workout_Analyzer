import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedLeftHipFlexionExtension() {
  console.log('--- Seeding Left Hip Flexion & Extension (Side View) Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Left Hip Flexion & Extension (Side View)';
    const category = 'Hips & Pelvis';
    const subcategory = 'Hip Mobility';
    const cameraAngle = 'SIDE';
    const videoPath = '';
    const imagePath = '';
    const description = 'Strict unilateral left hip sagittal mobility assessment. Stand sideways, keep left knee locked straight and torso upright. Swing left leg forward (hip flexion), return to center, reach left leg backward (hip extension), and return to standing neutral.';

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

    // 2. Define the dynamic profile phases for Left Leg
    const dynamicProfile = {
      phases: [
        {
          name: 'Setup & Standing Neutral',
          isSetupPhase: true,
          entryCue: 'Stand sideways with both legs straight and torso upright.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'LEFT_HIP_FLEXION', operator: '<=', value: 15, isBlocking: true },
            { id: 'ec-setup-2', metric: 'LEFT_HIP_EXTENSION', operator: '<=', value: 15, isBlocking: true },
            { id: 'ec-setup-3', metric: 'LEFT_KNEE_ANGLE', operator: '>=', value: 155, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 15, message: 'Stand tall with torso upright', isBlocking: false }
          ]
        },
        {
          name: 'Left Forward Leg Swing (Flexion)',
          isSetupPhase: false,
          entryCue: 'Swing your left leg forward keeping your knee completely straight.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'LEFT_HIP_FLEXION', operator: '>=', value: 15, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'LEFT_KNEE_ANGLE', operator: '<', value: 150, message: 'Keep your left knee straight, do not bend!', isBlocking: false },
            { id: 'fc-p2-2', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 15, message: 'Do not lean your torso backward!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Center',
          isSetupPhase: false,
          entryCue: 'Return your left leg back to the center.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'LEFT_HIP_FLEXION', operator: '<=', value: 15, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'LEFT_KNEE_ANGLE', operator: '<', value: 150, message: 'Maintain a straight knee', isBlocking: false }
          ]
        },
        {
          name: 'Left Backward Leg Reach (Extension)',
          isSetupPhase: false,
          entryCue: 'Now reach your left leg backward keeping your knee straight.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p4-1', metric: 'LEFT_HIP_EXTENSION', operator: '>=', value: 12, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p4-1', metric: 'LEFT_KNEE_ANGLE', operator: '<', value: 150, message: 'Keep your left knee straight, do not bend!', isBlocking: false },
            { id: 'fc-p4-2', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 15, message: 'Do not lean your torso forward!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Stand',
          isSetupPhase: false,
          entryCue: 'Return to standing lockout. Rep complete!',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p5-1', metric: 'LEFT_HIP_EXTENSION', operator: '<=', value: 10, isBlocking: true },
            { id: 'ec-p5-2', metric: 'LEFT_HIP_FLEXION', operator: '<=', value: 15, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p5-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 15, message: 'Stand tall with torso upright', isBlocking: false }
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
      { raw: 'Keep your left knee straight, do not bend!', spoken: 'Keep your left knee straight, do not bend', display: 'Straight knee', type: 'warning' },
      { raw: 'Do not lean your torso backward!', spoken: 'Do not lean torso backward, stay upright', display: 'Torso upright', type: 'warning' },
      { raw: 'Do not lean your torso forward!', spoken: 'Do not lean torso forward, stay tall', display: 'Stay tall', type: 'warning' },
      { raw: 'Maintain a straight knee', spoken: 'Maintain a straight knee', display: 'Keep leg straight', type: 'info' },
      { raw: 'Stand tall with torso upright', spoken: 'Stand tall with torso upright', display: 'Stand tall', type: 'info' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Left Hip Flexion & Extension (Side View) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await client.end();
  }
}

seedLeftHipFlexionExtension();
