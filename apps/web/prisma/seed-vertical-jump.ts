import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exerciseName = 'Countermovement Vertical Jump';
  const category = 'Lower Body';
  const subcategory = 'Athletic Performance';
  const cameraAngle = 'FRONT';
  const description = 'Athletic vertical power test. Stand tall, execute an explosive countermovement dip, propel upward with maximal force reaching peak height, and absorb impact softly with proper knee alignment.';

  console.log(`Seeding "${exerciseName}" into Prisma Vercel DB...`);

  // 1. Upsert exercise
  let exercise = await prisma.exercises.findFirst({
    where: { name: exerciseName, is_deleted: false }
  });

  if (exercise) {
    console.log(`Updating existing exercise: ${exercise.id}`);
    exercise = await prisma.exercises.update({
      where: { id: exercise.id },
      data: {
        description,
        category,
        subcategory,
        camera_angle: cameraAngle,
        status: true
      }
    });
  } else {
    console.log(`Creating new exercise: ${exerciseName}`);
    exercise = await prisma.exercises.create({
      data: {
        name: exerciseName,
        description,
        category,
        subcategory,
        camera_angle: cameraAngle,
        status: true
      }
    });
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

  // 3. Upsert exercise pose rule
  const existingRule = await prisma.exercise_pose_rules.findFirst({
    where: { exercise_id: exercise.id, rule_name: 'DYNAMIC_PROFILE' }
  });

  if (existingRule) {
    console.log(`Updating DYNAMIC_PROFILE rule for exercise ${exercise.id}`);
    await prisma.exercise_pose_rules.update({
      where: { id: existingRule.id },
      data: {
        threshold_value: dynamicProfile as any,
        rule_type: 'PHASE_SEQUENCE',
        exercise_name: exerciseName
      }
    });
  } else {
    console.log(`Creating DYNAMIC_PROFILE rule for exercise ${exercise.id}`);
    await prisma.exercise_pose_rules.create({
      data: {
        exercise_id: exercise.id,
        exercise_name: exerciseName,
        rule_name: 'DYNAMIC_PROFILE',
        rule_type: 'PHASE_SEQUENCE',
        threshold_value: dynamicProfile as any,
        creator_type: 'system'
      }
    });
  }

  console.log(`✅ Successfully seeded "${exerciseName}" in Prisma Vercel DB!`);
}

main()
  .catch((e) => {
    console.error('Error seeding exercise in Prisma DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
