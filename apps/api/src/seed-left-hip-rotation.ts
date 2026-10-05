import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedLeftHipRotation() {
  console.log('--- Seeding Left Hip Internal & External Rotation Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Left Hip Internal & External Rotation (Front View)';
    const category = 'Hips & Pelvis';
    const subcategory = 'Hip Mobility';
    const cameraAngle = 'FRONT';
    const videoPath = '';
    const imagePath = '';
    const description = 'Strict unilateral left hip mobility assessment in 90 degrees flexion. Face the camera, lift your left leg to 90 degrees with knee bent, rotate left shin inward across body (external rotation), return to center, rotate left shin outward (internal rotation), and return to standing while keeping pelvis level and torso upright.';

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

    // 2. Define the dynamic profile phases with strict LEFT metrics
    const dynamicProfile = {
      phases: [
        {
          name: 'Setup & 90° Left Leg Lift',
          isSetupPhase: true,
          entryCue: 'Lift your left leg to 90 degrees with knee bent and shin pointing down.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'LEFT_HIP_FLEXION', operator: '>=', value: 60, isBlocking: true },
            { id: 'ec-setup-2', metric: 'LEFT_HIP_EXTERNAL_ROTATION', operator: '<=', value: 10, isBlocking: true },
            { id: 'ec-setup-3', metric: 'LEFT_HIP_INTERNAL_ROTATION', operator: '<=', value: 10, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'PELVIC_DROP_ANGLE', operator: '>', value: 8, message: 'Keep hips level, do not hike pelvis', isBlocking: false },
            { id: 'fc-setup-2', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Stand tall with torso upright', isBlocking: false }
          ]
        },
        {
          name: 'Left External Rotation (Inward Sweep)',
          isSetupPhase: false,
          entryCue: 'Rotate your left shin inward across your body as far as you can.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'LEFT_HIP_EXTERNAL_ROTATION', operator: '>=', value: 6, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'LEFT_HIP_FLEXION', operator: '<', value: 50, message: 'Keep your left knee lifted at 90 degrees!', isBlocking: false },
            { id: 'fc-p2-2', metric: 'PELVIC_DROP_ANGLE', operator: '>', value: 8, message: 'Do not hike your hip to cheat range!', isBlocking: false },
            { id: 'fc-p2-3', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Do not lean your torso sideways!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Center',
          isSetupPhase: false,
          entryCue: 'Return your left shin back to the center vertical position.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'LEFT_HIP_EXTERNAL_ROTATION', operator: '<=', value: 8, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'LEFT_HIP_FLEXION', operator: '<', value: 50, message: 'Keep your left knee lifted', isBlocking: false }
          ]
        },
        {
          name: 'Left Internal Rotation (Outward Sweep)',
          isSetupPhase: false,
          entryCue: 'Now rotate your left shin outward away from your body.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p4-1', metric: 'LEFT_HIP_INTERNAL_ROTATION', operator: '>=', value: 6, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p4-1', metric: 'LEFT_HIP_FLEXION', operator: '<', value: 50, message: 'Keep your left knee lifted at 90 degrees!', isBlocking: false },
            { id: 'fc-p4-2', metric: 'PELVIC_DROP_ANGLE', operator: '>', value: 8, message: 'Keep pelvis level, do not tilt hips!', isBlocking: false },
            { id: 'fc-p4-3', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Do not lean your torso!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Neutral & Lower Leg',
          isSetupPhase: false,
          entryCue: 'Return your leg and lower your left foot back to the floor. Rep complete!',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p5-1', metric: 'LEFT_HIP_INTERNAL_ROTATION', operator: '<=', value: 8, isBlocking: true },
            { id: 'ec-p5-2', metric: 'LEFT_HIP_FLEXION', operator: '<=', value: 25, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p5-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 8, message: 'Stand tall with torso upright', isBlocking: false }
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
      { raw: 'Keep left knee bent at 90 degrees!', spoken: 'Keep left knee bent at 90 degrees!', display: 'Maintain 90° knee bend', type: 'warning' },
      { raw: 'Do not extend left knee, keep 90 degrees!', spoken: 'Do not extend left knee, keep 90 degrees', display: 'Keep 90° knee bend', type: 'warning' },
      { raw: 'Do not extend your left knee!', spoken: 'Do not extend left knee', display: 'Keep 90° knee bend', type: 'warning' },
      { raw: 'Do not hike your hip to cheat range!', spoken: 'Do not hike your hip, keep pelvis level', display: 'Keep pelvis level', type: 'warning' },
      { raw: 'Keep pelvis level, do not tilt hips!', spoken: 'Keep pelvis level, avoid tilting', display: 'Level hips', type: 'warning' },
      { raw: 'Do not lean your torso sideways!', spoken: 'Do not lean torso sideways, stay tall', display: 'Torso tall', type: 'warning' },
      { raw: 'Stand tall with torso upright', spoken: 'Stand tall with torso upright', display: 'Stand tall', type: 'info' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Left Hip Internal & External Rotation (Front View) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await client.end();
  }
}

seedLeftHipRotation();
