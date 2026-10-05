import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

async function seedStandingSpineFlexionExtension() {
  console.log('--- Seeding Standing Spine Flexion & Extension (Side View) Exercise ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const query = (text: string, params?: any[]) => client.query(text, params);
    const exerciseName = 'Standing Spine Flexion & Extension (Side View)';
    const category = 'Spine & Trunk';
    const subcategory = 'Spine Mobility';
    const cameraAngle = 'SIDE';
    const videoPath = '';
    const imagePath = '';
    const description = 'Strict sagittal spine mobility assessment. Stand sideways with knees straight and waist locked. Round upper back forward (spine flexion), return to center, arch upper back backward (spine extension), and return to standing upright.';

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
          name: 'Setup & Standing Neutral',
          isSetupPhase: true,
          entryCue: 'Stand sideways with legs straight and waist locked.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'SPINE_FLEXION', operator: '<=', value: 10, isBlocking: true },
            { id: 'ec-setup-2', metric: 'SPINE_EXTENSION', operator: '<=', value: 10, isBlocking: true },
            { id: 'ec-setup-3', metric: 'HIP_HINGE_ANGLE', operator: '>=', value: 165, isBlocking: true },
            { id: 'ec-setup-4', metric: 'KNEE_ANGLE', operator: '>=', value: 155, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'HIP_HINGE_ANGLE', operator: '<', value: 160, message: 'Keep waist straight, do not bend at the hips', isBlocking: false }
          ]
        },
        {
          name: 'Forward Spine Flexion',
          isSetupPhase: false,
          entryCue: 'Round your upper back forward without bending from the waist.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'SPINE_FLEXION', operator: '>=', value: 12, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'HIP_HINGE_ANGLE', operator: '<', value: 155, message: 'Do not bend at the waist! Keep hips locked.', isBlocking: false },
            { id: 'fc-p2-2', metric: 'DYN_TORSO_COMPRESSION', operator: '>', value: 0.94, message: 'Round your spine, do not stay flat!', isBlocking: false },
            { id: 'fc-p2-3', metric: 'KNEE_ANGLE', operator: '<', value: 150, message: 'Keep your knees straight!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Neutral',
          isSetupPhase: false,
          entryCue: 'Return your spine back to upright.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'SPINE_FLEXION', operator: '<=', value: 10, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'KNEE_ANGLE', operator: '<', value: 150, message: 'Keep your knees straight!', isBlocking: false }
          ]
        },
        {
          name: 'Backward Spine Extension',
          isSetupPhase: false,
          entryCue: 'Now arch your upper spine backward keeping your waist intact.',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p4-1', metric: 'SPINE_EXTENSION', operator: '>=', value: 10, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p4-1', metric: 'HIP_HINGE_ANGLE', operator: '<', value: 155, message: 'Keep hips steady, arch from upper spine!', isBlocking: false },
            { id: 'fc-p4-2', metric: 'KNEE_ANGLE', operator: '<', value: 150, message: 'Keep your knees straight!', isBlocking: false }
          ]
        },
        {
          name: 'Return to Stand',
          isSetupPhase: false,
          entryCue: 'Return to standing straight. Rep complete!',
          entryCueEnabled: true,
          entryConditions: [
            { id: 'ec-p5-1', metric: 'SPINE_EXTENSION', operator: '<=', value: 8, isBlocking: true },
            { id: 'ec-p5-2', metric: 'SPINE_FLEXION', operator: '<=', value: 10, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p5-1', metric: 'HIP_HINGE_ANGLE', operator: '<', value: 160, message: 'Stand tall with torso upright', isBlocking: false }
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
      { raw: 'Do not bend at the waist! Keep hips locked.', spoken: 'Do not bend at the waist, move from your spine', display: 'Lock hips, bend spine', type: 'warning' },
      { raw: 'Keep hips steady, arch from upper spine!', spoken: 'Keep hips steady, arch from upper spine', display: 'Arch from upper spine', type: 'warning' },
      { raw: 'Round your spine, do not stay flat!', spoken: 'Round your spine, do not stay flat', display: 'Round your back', type: 'warning' },
      { raw: 'Keep your knees straight!', spoken: 'Keep your knees straight', display: 'Straight knees', type: 'warning' },
      { raw: 'Keep waist straight, do not bend at the hips', spoken: 'Keep waist straight', display: 'Waist straight', type: 'info' },
      { raw: 'Stand tall with torso upright', spoken: 'Stand tall with torso upright', display: 'Stand tall', type: 'info' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Standing Spine Flexion & Extension (Side View) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await client.end();
  }
}

seedStandingSpineFlexionExtension();
