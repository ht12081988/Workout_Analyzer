import pool, { query } from './db';

async function seedHipCars() {
  console.log('--- Seeding Quadruped Hip CARs Exercise ---');

  try {
    // 0. Seed Master Metrics in PostgreSQL
    console.log('Seeding Master Metrics into master_metrics table...');
    const metricsToSeed = [
      {
        metric_key: 'LEFT_HIP_ABDUCTION',
        metric_name: 'Left Hip Abduction',
        description: '0 to 90 degrees. Measures lateral elevation/opening of left knee and thigh outward relative to the hip in quadruped or standing stance (e.g. Fire Hydrant or Hip CARs).',
        min_val: 0,
        max_val: 90,
        step_val: 1,
        direction: '>='
      },
      {
        metric_key: 'RIGHT_HIP_ABDUCTION',
        metric_name: 'Right Hip Abduction',
        description: '0 to 90 degrees. Measures lateral elevation/opening of right knee and thigh outward relative to the hip in quadruped or standing stance (e.g. Fire Hydrant or Hip CARs).',
        min_val: 0,
        max_val: 90,
        step_val: 1,
        direction: '>='
      },
      {
        metric_key: 'HIP_ABDUCTION_ANGLE',
        metric_name: 'Hip Abduction Angle',
        description: '0 to 90 degrees. General hip abduction angle measuring lateral leg elevation across active leg.',
        min_val: 0,
        max_val: 90,
        step_val: 1,
        direction: '>='
      },
      {
        metric_key: 'KNEE_OUTSIDE_HAND_RATIO',
        metric_name: 'Knee Outside Hand Ratio',
        description: 'Measures lateral displacement of the active knee relative to the planted hand in tabletop/quadruped, normalized to torso length. <= 0 means in-line/inside hand; > 0 means outside hand line (Fire Hydrant).',
        min_val: -0.5,
        max_val: 1.0,
        step_val: 0.01,
        direction: '>='
      },
      {
        metric_key: 'LEFT_KNEE_OUTSIDE_HAND_RATIO',
        metric_name: 'Left Knee Outside Hand Ratio',
        description: 'Measures lateral displacement of the left knee relative to the planted left hand in tabletop/quadruped, normalized to torso length. <= 0 means in-line/inside hand; > 0 means outside hand line.',
        min_val: -0.5,
        max_val: 1.0,
        step_val: 0.01,
        direction: '>='
      }
    ];

    for (const m of metricsToSeed) {
      await query(
        `INSERT INTO master_metrics (metric_key, metric_name, description, min_val, max_val, step_val, direction)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (metric_key) DO UPDATE SET
           metric_name = EXCLUDED.metric_name,
           description = EXCLUDED.description,
           min_val = EXCLUDED.min_val,
           max_val = EXCLUDED.max_val,
           step_val = EXCLUDED.step_val,
           direction = EXCLUDED.direction`,
        [m.metric_key, m.metric_name, m.description, m.min_val, m.max_val, m.step_val, m.direction]
      );
    }

    const exerciseName = 'Quadruped Hip CARs';
    const category = 'Hips';
    const subcategory = 'Mobility & CARs';
    const cameraAngle = 'SIDE';
    const videoPath = 'C:/Users/hardi/OneDrive/Desktop/Hips CARS.mp4';
    const imagePath = '/images/hip_cars_thumb.png';
    const description = 'Controlled Articular Rotations (CARs) for the hip in a quadruped position. Full bi-directional rotation (Forward & Reverse) to improve hip mobility, capsular control, and core stability.';

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

    // 2. Define the complete 8-phase bi-directional dynamic profile
    const dynamicProfile = {
      phases: [
        {
          name: 'Phase 1: Quadruped Setup',
          isSetupPhase: true,
          entryConditions: [
            { id: 'ec-setup-1', metric: 'TORSO_ANGLE_VERT', operator: '>=', value: 80, isBlocking: true },
            { id: 'ec-setup-2', metric: 'TORSO_ANGLE_VERT', operator: '<=', value: 100, isBlocking: true },
            { id: 'ec-setup-3', metric: 'LEFT_KNEE_ANGLE', operator: '>=', value: 75, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-setup-1', metric: 'STILLNESS_JITTER', operator: '<', value: 25, message: 'Hold a steady all-fours position to calibrate', isBlocking: false }
          ]
        },
        {
          name: 'Phase 2: Forward Flexion (Knee to Elbow)',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p2-1', metric: 'HIP_HINGE_ANGLE', operator: '<=', value: 100, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p2-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 70, message: 'Keep spine neutral, avoid rounding lower back', isBlocking: false }
          ]
        },
        {
          name: 'Phase 3: Forward Abduction (Fire Hydrant Lift)',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p3-1', metric: 'LEFT_HIP_ABDUCTION', operator: '>=', value: 28, isBlocking: true },
            { id: 'ec-p3-2', metric: 'KNEE_OUTSIDE_HAND_RATIO', operator: '>=', value: 0.10, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p3-1', metric: 'SHOULDER_ROTATION', operator: '<', value: 30, message: 'Avoid leaning or twisting torso to the side', isBlocking: false }
          ]
        },
        {
          name: 'Phase 4: Forward Extension (Heel Kick Up)',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p4-1', metric: 'HIP_HINGE_ANGLE', operator: '>=', value: 140, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p4-1', metric: 'HEAD_FORWARD_LEAN', operator: '<', value: 25, message: 'Keep head neutral, do not drop your chin', isBlocking: false }
          ]
        },
        {
          name: 'Phase 5: Mid-Rep Forward Sweep',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p5-1', metric: 'HIP_HINGE_ANGLE', operator: '<=', value: 110, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p5-1', metric: 'BODY_SWAY', operator: '<', value: 20, message: 'Control knee sweep without collapsing posture', isBlocking: false }
          ]
        },
        {
          name: 'Phase 6: Reverse Extension (Kick Back)',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p6-1', metric: 'HIP_HINGE_ANGLE', operator: '>=', value: 140, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p6-1', metric: 'TORSO_ANGLE_VERT', operator: '>', value: 70, message: 'Drive heel up without arching lumbar spine', isBlocking: false }
          ]
        },
        {
          name: 'Phase 7: Reverse Abduction & External Rotation',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p7-1', metric: 'KNEE_OUTSIDE_HAND_RATIO', operator: '>=', value: 0.10, isBlocking: true },
            { id: 'ec-p7-2', metric: 'HIP_ABDUCTION_ANGLE', operator: '>=', value: 18, isBlocking: true }
          ],
          formChecks: [
            { id: 'fc-p7-1', metric: 'SHOULDER_ROTATION', operator: '<', value: 30, message: 'Distribute weight equally between both hands', isBlocking: false }
          ]
        },
        {
          name: 'Phase 8: Return to Rest Stance',
          isSetupPhase: false,
          entryConditions: [
            { id: 'ec-p8-1', metric: 'KNEE_OUTSIDE_HAND_RATIO', operator: '<=', value: 0.05, isBlocking: true },
            { id: 'ec-p8-2', metric: 'HIP_HINGE_ANGLE', operator: '<=', value: 115, isBlocking: true }
          ],
          formChecks: []
        }
      ]
    };

    // 3. Upsert exercise_pose_rules (DYNAMIC_PROFILE)
    const existingRule = await query(
      'SELECT id FROM exercise_pose_rules WHERE exercise_id = $1 AND rule_name = $2 AND creator_type = $3',
      [exerciseId, 'DYNAMIC_PROFILE', 'system']
    );

    if (existingRule.rows.length > 0) {
      console.log('Updating DYNAMIC_PROFILE rule in exercise_pose_rules...');
      await query(
        'UPDATE exercise_pose_rules SET threshold_value = $1, exercise_name = $2 WHERE id = $3',
        [JSON.stringify(dynamicProfile), exerciseName, existingRule.rows[0].id]
      );
    } else {
      console.log('Inserting DYNAMIC_PROFILE rule into exercise_pose_rules...');
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
      { raw: 'Keep spine neutral, avoid rounding lower back', spoken: 'Keep spine neutral, avoid rounding your lower back', display: 'Keep spine neutral', type: 'warning' },
      { raw: 'Avoid leaning or twisting torso to the side', spoken: 'Avoid leaning your torso to the side', display: 'Avoid leaning torso', type: 'warning' },
      { raw: 'Keep head neutral, do not drop your chin', spoken: 'Keep your head neutral, do not drop your chin', display: 'Keep head neutral', type: 'warning' },
      { raw: 'Control knee sweep without collapsing posture', spoken: 'Control the knee sweep, stay stable', display: 'Control knee sweep', type: 'warning' },
      { raw: 'Drive heel up without arching lumbar spine', spoken: 'Drive your heel up without arching your back', display: 'Avoid arching back', type: 'warning' },
      { raw: 'Distribute weight equally between both hands', spoken: 'Keep equal weight on both hands', display: 'Balance weight on hands', type: 'warning' }
    ];

    for (const c of cues) {
      await query(
        `INSERT INTO voice_cues (exercise_id, exercise_name, raw_cue, spoken_cue, display_cue, cue_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [exerciseId, exerciseName, c.raw, c.spoken, c.display, c.type]
      );
    }

    console.log('✅ Successfully seeded Quadruped Hip CARs exercise!');
    console.log(`Exercise ID: ${exerciseId}`);
    console.log(`Category: ${category} | Subcategory: ${subcategory}`);
    console.log(`Phases configured: 8 total bi-directional phases`);
  } catch (err) {
    console.error('❌ Failed to seed Quadruped Hip CARs exercise:', err);
  } finally {
    await pool.end();
  }
}

seedHipCars();
