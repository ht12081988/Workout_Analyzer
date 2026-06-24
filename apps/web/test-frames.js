const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const frameCounts = await prisma.workout_landmark_frames.groupBy({
    by: ['rep_id'],
    _count: { id: true }
  });
  
  const distribution = {};
  for (const row of frameCounts) {
    const count = row._count.id;
    distribution[count] = (distribution[count] || 0) + 1;
  }
  
  console.log('Frame count distribution across reps:', distribution);
}

main().catch(console.error).finally(() => prisma.$disconnect());
