import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@editorial.local';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
      role: 'admin',
    },
  });

  console.log(`Admin user created: ${user.email} (id: ${user.id})`);
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
