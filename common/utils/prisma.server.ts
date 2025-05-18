import pkg, { PrismaClient } from '@prisma/client';

const dev = process.env.NODE_ENV !== 'production';

declare global {
  var _prisma: PrismaClient; // eslint-disable-line
}

let prisma;
if (dev) {
  if (!global._prisma) {
    global._prisma = new PrismaClient();
  }
  prisma = global._prisma;
} else {
  const { PrismaClient: PrismaClientProd } = pkg;
  const dbUrl = process.env.DATABASE_URL;
  console.log('dbUrl:', dbUrl?.replace(/(.*)(?:@)/, '[redacted]'));
  prisma = new PrismaClientProd();
}

export default prisma as PrismaClient; // type assertion for shim