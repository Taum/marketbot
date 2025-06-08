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
        const params = JSON.parse(e.params)
        console.log('--------------------------------');
        console.log('Query: ' + e.query)
        console.log('Params: ' + e.params)
        console.log('Duration: ' + e.duration + 'ms')
        console.log('--------------------------------');
        const interpolated = e.query.replace(/\$\d+/g, (match) => {
          const paramIndex = parseInt(match.slice(1)) - 1;
          const param = params[paramIndex];
          // console.log('Param', match, ' : ', paramIndex, ' = ', param)
          if (typeof param === 'string') {
            return `'${param}'`;
          }
          return `${param}`;
        });
        console.log('Interpolated: ' + interpolated);
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