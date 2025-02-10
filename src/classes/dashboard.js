const blessed = require("blessed");
const contrib = require("blessed-contrib");
const dashboardConfig = require("../utils/bless_contrib");
const logger = require("../utils/logger");

class Dashboard {
  constructor() {
    this.screen = blessed.screen(dashboardConfig.screen);
    this.grid = new contrib.grid({
      ...dashboardConfig.grid,
      screen: this.screen,
    });

    this.accountLog = this.grid.set(
      ...dashboardConfig.components.accountLog.position,
      contrib.log,
      dashboardConfig.components.accountLog.config
    );
    this.dataAccount = this.grid.set(
      ...dashboardConfig.components.dataAccount.position,
      contrib.table,
      dashboardConfig.components.dataAccount.config
    );
    this.accountList = this.grid.set(
      ...dashboardConfig.components.accountList.position,
      contrib.table,
      dashboardConfig.components.accountList.config
    );
    this.lcdDisplay = this.grid.set(
      ...dashboardConfig.components.lcd.position,
      contrib.lcd,
      dashboardConfig.components.lcd.config
    );
    this.lcdText = this.grid.set(
      ...dashboardConfig.components.lcdText.position,
      blessed.text,
      dashboardConfig.components.lcdText.config
    );

    this.lcdText.border = null;
    this.accounts = [];
    this.selectedAccountIndex = 0;
    this.lcdMessages = ["GOKITE", "PUQUS"];
    this.lcdIndex = 0;

    this.initScreenControls();
    logger.setLogger(this.accountLog);
    this.startLcdAnimation();
  }

  initScreenControls() {
    this.screen.key(["escape", "q", "C-c"], () => process.exit(0));
    this.accountList.focus();
    this.accountList.rows.on("select", async (_, index) => {
      this.selectedAccountIndex = index;
      this.refreshSelectedAccount();
      this.updateDashboard();
    });
  }

  refreshSelectedAccount() {
    const selectedAccount = this.accounts[this.selectedAccountIndex];

    if (!selectedAccount) {
      logger.log("{yellow-fg}No account selected{/yellow-fg}");
      return;
    }

    this.updateDashboard();
  }

  startLcdAnimation() {
    setInterval(() => {
      this.lcdDisplay.setDisplay(this.lcdMessages[this.lcdIndex]);
      this.lcdIndex = (this.lcdIndex + 1) % this.lcdMessages.length;
      this.screen.render();
    }, 2000);
  }

  setAccounts(accounts) {
    this.accounts = accounts;
    this.updateDashboard();
  }

  updateDashboard() {
    const accountData = this.accounts.map((account) => [
      account.walletAddress || "N/A",
    ]);

    this.accountList.setData({
      headers: ["Wallet"],
      data: accountData,
    });

    this.lcdText.setContent(`Total Account: ${this.accounts.length}`);

    const selectedAccount = this.accounts[this.selectedAccountIndex];
    if (selectedAccount && selectedAccount.stats) {
      this.dataAccount.setData({
        headers: ["Name", "Value"],
        data: [
          ["User XP", selectedAccount.stats.userXp || 0],
          ["User Rank", selectedAccount.stats.rank || 0],
          ["Daily Agent Action", selectedAccount.stats.dailyAgentAction || 0],
          ["Total Agent Action", selectedAccount.stats.totalAgentActions || 0],
          ["Daily Agent XP", selectedAccount.stats.dailyAgentActionsXp || 0],
          ["Total Agent XP", selectedAccount.stats.totalAgentActionsXp || 0],
        ],
      });
    } else {
      logger.log(
        `{yellow-fg}Warning: No selected account data available{/yellow-fg}`
      );
    }

    this.screen.render();
  }
}

module.exports = Dashboard;
