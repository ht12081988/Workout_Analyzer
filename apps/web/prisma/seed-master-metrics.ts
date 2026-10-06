import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Load the 95 master metrics definition
const { ALL_MASTER_METRICS } = require('../../api/src/seed-all-master-metrics.js');

async function main() {
  console.log(`Starting migration of ${ALL_MASTER_METRICS.length} Master Metrics into Prisma Postgres DB...`);

  const validKeys = ALL_MASTER_METRICS.map((m: any) => m.key);

  // 1. Delete legacy / deprecated metric keys not present in the master list
  const deleteResult = await prisma.master_metrics.deleteMany({
    where: {
      metric_key: {
        notIn: validKeys
      }
    }
  });
  console.log(`Pruned ${deleteResult.count} legacy/obsolete metric keys from Prisma DB.`);

  // 2. Upsert the canonical master metrics
  let count = 0;
  for (const m of ALL_MASTER_METRICS) {
    await prisma.master_metrics.upsert({
      where: { metric_key: m.key },
      update: {
        metric_name: m.name,
        description: m.desc,
        min_val: m.min,
        max_val: m.max,
        step_val: m.step,
        direction: m.dir,
        default_val: m.default_val !== undefined ? m.default_val : null,
        category: m.category || null
      },
      create: {
        metric_key: m.key,
        metric_name: m.name,
        description: m.desc,
        min_val: m.min,
        max_val: m.max,
        step_val: m.step,
        direction: m.dir,
        default_val: m.default_val !== undefined ? m.default_val : null,
        category: m.category || null
      }
    });
    count++;
  }

  const totalInDb = await prisma.master_metrics.count();
  console.log(`Successfully migrated and upserted ${count} Master Metrics to Prisma DB!`);
  console.log(`Total Master Metrics currently in Prisma Postgres DB: ${totalInDb}`);
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
