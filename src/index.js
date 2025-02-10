const Dashboard = require("./classes/dashboard");
const logger = require("./utils/logger");
const path = require("path");
const { getRandomProxy, loadProxies } = require("./classes/proxy");
const fs = require("fs");
const gokiteAiAgent = require("./classes/gokiteAi");

const dashboard = new Dashboard();

const gokite = new Map();
let accounts = [];

async function main() {
  try {
    const accountsPath = path.join(__dirname, "..", "accounts.json");
    if (!fs.existsSync(accountsPath)) {
      logger.log(`{red-fg}Error: accounts.json not found{/red-fg}`);
      return;
    }

    const wallets = JSON.parse(fs.readFileSync(accountsPath, "utf-8"));
    logger.log(
      `{green-fg}Found ${wallets.length} accounts to process{/green-fg}`
    );

    const proxiesLoaded = loadProxies();
    if (!proxiesLoaded) {
      logger.log(`{red-fg}No proxy using default IP{/red-fg}`);
    }

    for (const wallet of wallets) {
      try {
        const currentProxy = await getRandomProxy();
        const kite = new gokiteAiAgent(wallet, currentProxy);
        gokite.set(wallet.address, kite);
        const userInfo = await kite.proccesingGetDataAccount();

        if (userInfo) {
          const account = {
            walletAddress: kite.account.address,
            stats: kite.stats,
          };
          accounts.push(account);
        }
      } catch (error) {
        logger.log(
          `{red-fg}Error initializing account: ${error.message}{/red-fg}`
        );
      }

      dashboard.setAccounts(accounts);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    logger.log(
      `{green-fg}All accounts initialized, starting auto chat...{/green-fg}`
    );

    for (const kite of gokite.values()) {
      kite.startAutoChatLoop();
    }

    startAutoUpdate();
  } catch (error) {
    logger.log(`{red-fg}Main process failed: ${error.message}{/red-fg}`);
  }
}

async function startAutoUpdate() {
  setInterval(async () => {
    logger.log("{cyan-fg}Refreshing account data...{/cyan-fg}");
    const updatedAccounts = [];
    for (const [walletAddress, kite] of gokite) {
      try {
        await kite.refreshOrGetData();
        updatedAccounts.push({
          walletAddress: kite.account.address,
          stats: kite.stats,
        });
      } catch (error) {
        logger.log(
          `{red-fg}Error refreshing account ${walletAddress}: ${error.message}{/red-fg}`
        );
      }
    }

    dashboard.setAccounts(updatedAccounts);
  }, 20 * 60 * 1000);
}

main();
