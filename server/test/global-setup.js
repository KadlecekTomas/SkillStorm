/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

module.exports = async () => {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

  // čistý stav DB (bez seedů – nebo si klidně přidej vlastní seed)
  execSync('npx prisma migrate reset --force --skip-seed', {
    stdio: 'inherit',
  });

  // pokud potřebuješ seed, odkomentuj (ale ať je deterministický pro testy)
  // execSync('npm run prisma:seed', { stdio: 'inherit' });
};
