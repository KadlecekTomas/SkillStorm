process.env.DOTENV_CONFIG_PATH = '.env.test';

// Zvyšíme timeout (DB, migrace)
jest.setTimeout(30000);
