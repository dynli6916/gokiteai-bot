const gokiteV2Bot = require("./main/gokiteV2bot");
const chalk = require("chalk");
const { getRandomProxy, loadProxies } = require("./main/proxy");
const fs = require("fs");
const { logMessage } = require("./utils/logger");
const util = require("util");
const figlet = require("figlet");
const figletAsync = util.promisify(figlet);

async function main() {
  const banner = await figletAsync("Gokite V2");
  console.log(chalk.green(banner));
  console.log(
    chalk.cyan(`
    By : El Puqus Airdrop
    github.com/ahlulmukh
  Use it at your own risk
  `)
  );

  try {
    const accounts = fs
      .readFileSync("accounts.txt", "utf8")
      .split("\n")
      .map((account) => account.trim())
      .filter(Boolean);
    const count = accounts.length;
    const proxiesLoaded = loadProxies();
    if (!proxiesLoaded) {
      logMessage(
        null,
        null,
        "Failed to load proxies, using default IP",
        "error"
      );
    }

    const botInstances = await Promise.all(
      accounts.map(async (account, index) => {
        const currentProxy = await getRandomProxy();
        return new gokiteV2Bot(account, currentProxy, index + 1, count);
      })
    );

    while (true) {
      logMessage(null, null, "Starting new process, Please wait...", "process");

      try {
        const results = await Promise.all(
          botInstances.map(async (flow) => {
            try {
              console.log(chalk.white("-".repeat(85)));
              const data = await flow.processKeepAlive();
              return {
                points: data.points || 0,
                keepAlive: data.keepAlive || false,
                proxy: flow.proxy || "N/A",
              };
            } catch (error) {
              logMessage(
                null,
                null,
                `Failed to process account: ${error.message}`,
                "error"
              );
              return {
                points: 0,
                keepAlive: false,
                proxy: "N/A",
              };
            }
          })
        );

        console.log("\n" + "═".repeat(70));
        results.forEach((result) => {
          logMessage(null, null, `Today XP: ${result.points}`, "success");
          const keepAliveStatus = result.keepAlive
            ? chalk.green("✔ Auto Chatting Success")
            : chalk.red("✖ Auto Chatting Failed");
          logMessage(
            null,
            null,
            `Auto Chatting : ${keepAliveStatus}`,
            "success"
          );
          logMessage(null, null, `Proxy: ${result.proxy}`, "success");
          console.log("─".repeat(70));
        });

        logMessage(
          null,
          null,
          "Process completed, waiting for 60 minutes before starting new auto chatting...",
          "success"
        );

        await new Promise((resolve) => setTimeout(resolve, 60000 * 60));
      } catch (error) {
        logMessage(
          null,
          null,
          `Main process failed: ${error.message}`,
          "error"
        );
      }
    }
  } catch (error) {
    logMessage(null, null, `Main process failed: ${error.message}`, "error");
  }
}

main();
