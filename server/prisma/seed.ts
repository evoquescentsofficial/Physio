import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@physio.clinic' } });
  if (!existing) {
    const password = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        name: 'Clinic Admin',
        email: 'admin@physio.clinic',
        password,
        role: 'ADMIN',
      },
    });
    console.log('Seeded admin user: admin@physio.clinic / admin123');
  } else {
    console.log('Admin user already exists, skipping.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
