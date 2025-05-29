import pkg, { PrismaClient } from '@prisma/client';

const dev = process.env.NODE_ENV !== 'production';

const debugSql = process.env.DEBUG_SQL === 'true';

declare global {
  var _prisma: PrismaClient; // eslint-disable-line
}

let prisma;
if (dev) {
  if (!global._prisma) {
    global._prisma = new PrismaClient({
      log: debugSql ? [{ emit: 'event', level: 'query' }] : undefined,
    });
    prisma = global._prisma;
    if (debugSql) {
      prisma.$on('query', (e) => {
        console.log('--------------------------------');
        console.log('Query: ' + e.query)
        console.log('Params: ' + e.params)
        console.log('Duration: ' + e.duration + 'ms')
      });
    }
  }
  prisma = global._prisma;
} else {
  const { PrismaClient: PrismaClientProd } = pkg;
  const dbUrl = process.env.DATABASE_URL;
  console.log('dbUrl:', dbUrl?.replace(/(.*)(?:@)/, '[redacted]'));
  prisma = new PrismaClientProd();
}

export default prisma as PrismaClient; // type assertion for shim