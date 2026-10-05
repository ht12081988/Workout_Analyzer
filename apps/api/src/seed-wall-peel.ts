import pool, { query } from './db';

async function seedWallPeel() {
  console.log('--- Seeding Spinal Flexion (Wall Peel Test) Exercise ---');

  try {
    const exerciseName = 'Spinal Flexion (Wall Peel Test)';
    const category = 'Spine';
    const subcategory = 'Mobility Assessment';
    const cameraAngle = 'SIDE';
    const videoPath = ''; 
    const imagePath = ''; 
    const description = 'A strict spinal articulation assessment. Stand flat against a wall and peel the spine forward vertebrae by vertebrae. The test stops the moment the hips detach from the wall.';

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

    // 2. Define the phases
    const dynamicProfile = {
      phases: [
        {
          name: 'Phase 1: Setup & Calibration',
          isSetupPhase: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'TORSO_ANGLE_VERT', operator: '<=', value: 5, isBlocking: true },
            { id: 'ec-setup-2', metric: 'KNEE_ANGLE', operator: '>=', value: 170, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'STILLNESS_JITTER', operator: '<', value: 25, message: 'Stand flat against the wall and hold completely still to calibrate', isBlocking: false }
          ]
        },
        {
          name: 'Phase 2: Segmental Flexion (The Peel)',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'TORSO_ANGLE_VERT', operator: '>=', value: 60, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'HIP_SAGITTAL_SHIFT', operator: '>', value: 5, message: 'Hips detached from the wall! Test complete.', isBlocking: true },
            { id: 'fc-p2-2', metric: 'KNEE_ANGLE', operator: '<', value: 165, message: 'Keep your knees locked straight!', isBlocking: true }
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
      { raw: 'Hips detached from the wall! Test complete.', spoken: 'Hips detached from the wall! Test complete.', display: 'Hips detached!', type: 'error' },
      { raw: 'Keep your knees locked straight!', spoken: 'Keep your knees locked straight!', display: 'Keep knees straight', type: 'warning' },
      { raw: 'Stand flat against the wall and hold completely still to calibrate', spoken: 'Stand flat against the wall and hold still', display: 'Hold still to calibrate', type: 'info' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Spinal Flexion (Wall Peel Test) exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
  } catch (err) {
    console.error('❌ Failed to seed exercise:', err);
  } finally {
    await pool.end();
  }
}

seedWallPeel();
