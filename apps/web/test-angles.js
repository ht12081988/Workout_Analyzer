const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const angles = await prisma.workout_joint_angles.findMany({
    select: { angle_name: true },
    distinct: ['angle_name'],
  });
  console.log(angles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
