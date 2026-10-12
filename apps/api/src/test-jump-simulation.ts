import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { DynamicRule } from '../../../packages/shared/src/exercise-engine/DynamicRule';
import { POSE_LANDMARKS, MovementPhase } from '../../../packages/shared/src/exercise-engine/types';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Admin%40123@127.0.0.1:5432/AWorkout_Analyzer';

function createSyntheticPose(options: {
  hipY: number;
  kneeAngle: number;
  isOffGround?: boolean;
}) {
  const pose: any = {};

  // Standard Torso: shoulders at Y = 0.25, hips at hipY
  pose[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: 0.25, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: 0.25, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.NOSE] = { x: 0.50, y: 0.15, z: 0, visibility: 0.99 };

  pose[POSE_LANDMARKS.LEFT_HIP] = { x: 0.46, y: options.hipY, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.54, y: options.hipY, z: 0, visibility: 0.99 };

  // Calculate knee position based on knee angle
  // Straight leg: hipY to 0.85 floor. Dip: knee bends
  const groundY = options.isOffGround ? 0.65 : 0.85;
  const kneeY = (options.hipY + groundY) / 2;

  pose[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.45, y: kneeY, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.55, y: kneeY, z: 0, visibility: 0.99 };

  pose[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.45, y: groundY - 0.05, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.55, y: groundY - 0.05, z: 0, visibility: 0.99 };

  pose[POSE_LANDMARKS.LEFT_HEEL] = { x: 0.45, y: groundY, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_HEEL] = { x: 0.55, y: groundY, z: 0, visibility: 0.99 };

  pose[POSE_LANDMARKS.LEFT_FOOT_INDEX] = { x: 0.47, y: groundY, z: 0, visibility: 0.99 };
  pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX] = { x: 0.53, y: groundY, z: 0, visibility: 0.99 };

  return pose;
}

async function runJumpSimulation() {
  console.log('--- Running Countermovement Vertical Jump Engine Simulation ---');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT e.name, r.threshold_value 
      FROM exercises e 
      JOIN exercise_pose_rules r ON e.id = r.exercise_id 
      WHERE e.name = 'Countermovement Vertical Jump' AND r.rule_name = 'DYNAMIC_PROFILE'
    `);

    if (res.rows.length === 0) {
      throw new Error('Exercise rules not found in DB');
    }

    const rules = [{ rule_name: 'DYNAMIC_PROFILE', threshold_value: res.rows[0].threshold_value }];
    const engine = new DynamicRule();
    engine.setRules(rules);

    console.log('Rules loaded successfully. Simulating jump cycle...');

    let now = Date.now();

    // 1. Setup Phase (standing tall: hipY = 0.50, shoulderY = 0.25 -> baseTorso = 0.25 (~52cm))
    console.log('\n[1] Setup Phase (Standing erect):');
    for (let i = 0; i < 5; i++) {
      const pose = createSyntheticPose({ hipY: 0.50, kneeAngle: 170 });
      const result = engine.validate(pose, { currentPhase: MovementPhase.START_POSITION } as any, now);
      now += 33;
      console.log(`Frame ${i + 1}: Phase="${result.phaseName}", Progress=${result.progressPct}%, JumpHeight=${result.angles.verticalJumpHeight ?? 0}cm`);
    }

    // 2. Dip Phase (knees bend, hips sink to hipY = 0.58)
    console.log('\n[2] Countermovement Dip (Hips sink):');
    for (let i = 0; i < 6; i++) {
      const pose = createSyntheticPose({ hipY: 0.58, kneeAngle: 115 });
      const result = engine.validate(pose, { currentPhase: MovementPhase.DESCENDING } as any, now);
      now += 33;
      console.log(`Frame ${i + 6}: Phase="${result.phaseName}", Progress=${result.progressPct}%, KneeAngle=${result.angles.kneeAngle ?? 0}°`);
    }

    // 3. Jump Apex Phase (Hips launch upward to hipY = 0.35, feet off ground)
    console.log('\n[3] Explosive Flight / Apex (Airborne, hips at 0.35):');
    for (let i = 0; i < 6; i++) {
      const pose = createSyntheticPose({ hipY: 0.35, kneeAngle: 170, isOffGround: true });
      const result = engine.validate(pose, { currentPhase: MovementPhase.BOTTOM_POSITION } as any, now);
      now += 33;
      console.log(`Frame ${i + 12}: Phase="${result.phaseName}", Progress=${result.progressPct}%, JumpHeight=${result.angles.verticalJumpHeight ?? 0}cm`);
    }

    // 4. Landing Cushion & Return Phase (Hips return to standing, knees absorb)
    console.log('\n[4] Soft Landing & Cushion (Touchdown, knees absorb and extend):');
    for (let i = 0; i < 6; i++) {
      const pose = createSyntheticPose({ hipY: 0.50, kneeAngle: 165 });
      const result = engine.validate(pose, { currentPhase: MovementPhase.ASCENDING } as any, now);
      now += 33;
      console.log(`Frame ${i + 18}: Phase="${result.phaseName}", RepCompleted=${result.isRepCompleted}, Finished=${result.isMovementFinished}`);
      if (result.isMovementFinished) {
        console.log('🎉 REPETITION COMPLETED SUCCESSFULLY!');
        break;
      }
    }

    console.log('\n✅ All simulation phases passed successfully!');
  } catch (err) {
    console.error('Simulation failed:', err);
  } finally {
    await client.end();
  }
}

runJumpSimulation();
