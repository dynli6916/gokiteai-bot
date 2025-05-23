const { getProxyAgent } = require("./proxy");
const UserAgent = require("user-agents");
const axios = require("axios");
const { logMessage } = require("../utils/logger");
const { generateAuthToken } = require("../utils/generator");

const AGENTS = {
  AGENT1: {
    id: "deployment_KiMLvUiTydioiHm7PWZ12zJU",
    name: "Professor",
    prompts: ["What is proof of AI", "what is KiteAI"],
  },
  AGENT2: {
    id: "deployment_ByVHjMD6eDb9AdekRIbyuz14",
    name: "Crypto Buddy",
    prompts: ["Top Movers Today", "Price of bitcoin"],
  },
  AGENT3: {
    id: "deployment_OX7sn2D0WvxGUGK8CTqsU5VJ",
    name: "Sherlock",
    prompts: [
      "What do you think of this transaction? 0x252c02bded9a24426219248c9c1b065b752d3cf8bedf4902ed62245ab950895b",
    ],
  },
};

module.exports = class gokiteV2Bot {
  constructor(account, proxy = null, currentNum, total) {
    this.currentNum = currentNum;
    this.total = total;
    this.token = null;
    this.proxy = proxy;
    this.address = account;
    this.axios = axios.create({
      httpsAgent: proxy ? getProxyAgent(proxy) : undefined,
      timeout: 120000,
      headers: {
        "User-Agent": new UserAgent().toString(),
        Origin: "https://testnet.gokite.ai",
        Referer: "https://testnet.gokite.ai/",
      },
    });
  }

  async makeRequest(method, url, config = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.axios({ method, url, ...config });
      } catch (error) {
        if (error.response && error.response.status === 401) {
          logMessage(
            this.currentNum,
            this.total,
            "Unauthorized (401), trying to re-login...",
            "warning"
          );
          this.token = await this.loginUser();
          logMessage(
            this.currentNum,
            this.total,
            "Re-login successful, retrying request...",
            "process"
          );
          continue;
        }
        const errorData = error.response ? error.response.data : error.message;
        logMessage(
          this.currentNum,
          this.total,
          `Request failed: ${error.message}`,
          "error"
        );
        logMessage(
          this.currentNum,
          this.total,
          `Error response data: ${JSON.stringify(errorData, null, 2)}`,
          "error"
        );

        logMessage(
          this.currentNum,
          this.total,
          `Retrying... (${i + 1}/${retries})`,
          "process"
        );
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
    }
    return null;
  }

  async loginUser() {
    const authorkey = await generateAuthToken(this.address);
    const response = await this.loginAccount(authorkey);
    if (response) {
      return response.data.data.access_token;
    }
    return null;
  }

  async loginAccount(author) {
    logMessage(
      this.currentNum,
      this.total,
      `Trying Login Account...`,
      "process"
    );
    const headers = {
      authorization: author,
      "Content-Type": "application/json",
    };

    const payload = {
      eoa: this.address,
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://neo.prod.gokite.ai/v2/signin",
        {
          data: payload,
          headers: headers,
        }
      );
      if (response?.data.error === "") {
        logMessage(this.currentNum, this.total, "Login Success", "success");
        this.token = response.data.data.access_token;
        return response.data;
      }
      return null;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Login failed: ${error.message}`,
        "error"
      );
      return null;
    }
  }
  async chatWithAgent(serviceId, message, agentName) {
    try {
      logMessage(
        this.currentNum,
        this.total,
        `Chatting with ${agentName}...`,
        "process"
      );

      const headers = {
        authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      };

      const payload = {
        service_id: serviceId,
        subnet: "kite_ai_labs",
        stream: true,
        body: {
          stream: true,
          message: message,
        },
      };

      const response = await this.makeRequest(
        "POST",
        "https://ozone-point-system.prod.gokite.ai/agent/inference",
        {
          data: payload,
          headers: headers,
          responseType: "stream",
        }
      );

      if (!response || !response.data) {
        logMessage(
          this.currentNum,
          this.total,
          `Failed to get response from agent ${serviceId}`,
          "error"
        );
        return null;
      }

      return new Promise((resolve) => {
        let result = "";
        response.data.on("data", (chunk) => {
          const lines = chunk
            .toString()
            .split("\n")
            .filter((line) => line.trim());
          for (const line of lines) {
            try {
              if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6);
                if (jsonStr === "[DONE]") continue;

                const data = JSON.parse(jsonStr);
                if (data.choices && data.choices[0].delta.content) {
                  result += data.choices[0].delta.content;
                }
              }
            } catch (e) {
              logMessage(
                this.currentNum,
                this.total,
                `Error parsing response: ${e.message}`,
                "error"
              );
            }
          }
        });
        response.data.on("end", () => {
          const trimmedResult = result.trim();
          const preview =
            trimmedResult.length > 50
              ? trimmedResult.substring(0, 50) + "..."
              : trimmedResult;

          logMessage(
            this.currentNum,
            this.total,
            `${agentName} responded: "${preview}"`,
            "success"
          );
          resolve(trimmedResult);
        });
      });
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Chat failed: ${error.message}`,
        "error"
      );
      return null;
    }
  }
  async submitReceipt(serviceId, inputMessage, outputMessage, agentName) {
    try {
      logMessage(
        this.currentNum,
        this.total,
        `Submitting receipt for ${agentName}...`,
        "process"
      );

      const headers = {
        authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      };

      const payload = {
        address: this.address,
        service_id: serviceId,
        input: [
          {
            type: "text/plain",
            value: inputMessage,
          },
        ],
        output: [
          {
            type: "text/plain",
            value: outputMessage,
          },
        ],
      };

      const response = await this.makeRequest(
        "POST",
        "https://neo.prod.gokite.ai/v2/submit_receipt",
        {
          data: payload,
          headers: headers,
        }
      );
      if (response?.data.error === "") {
        logMessage(
          this.currentNum,
          this.total,
          `Successfully submitted receipt for ${agentName}`,
          "success"
        );
        return true;
      } else {
        logMessage(
          this.currentNum,
          this.total,
          `Failed to submit receipt for ${agentName}: ${
            response?.data.error || "Unknown error"
          }`,
          "error"
        );
        return false;
      }
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Submit receipt failed: ${error.message}`,
        "error"
      );
      return false;
    }
  }
  async chatRepeat() {
    try {
      let successCount = 0;
      for (const agent of Object.values(AGENTS)) {
        logMessage(
          this.currentNum,
          this.total,
          `Starting conversation with ${agent.name}...`,
          "process"
        );

        for (const prompt of agent.prompts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          logMessage(
            this.currentNum,
            this.total,
            `Prompt: "${prompt}"`,
            "info"
          );

          const response = await this.chatWithAgent(
            agent.id,
            prompt,
            agent.name
          );
          if (!response) continue;

          const success = await this.submitReceipt(
            agent.id,
            prompt,
            response,
            agent.name
          );
          if (success) successCount++;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        logMessage(
          this.currentNum,
          this.total,
          `Completed conversation with ${agent.name}`,
          "success"
        );
      }

      logMessage(
        this.currentNum,
        this.total,
        `Chat session completed with ${successCount} successful interactions`,
        "success"
      );

      return successCount > 0;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Chat repeat failed: ${error.message}`,
        "error"
      );
      return false;
    }
  }

  async getTotalPoints() {
    logMessage(this.currentNum, this.total, `Getting User Data...`, "process");

    const headers = {
      authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await this.makeRequest(
        "GET",
        "https://ozone-point-system.prod.gokite.ai/me",
        {
          headers: headers,
        }
      );

      if (response?.data.error === "") {
        logMessage(
          this.currentNum,
          this.total,
          "Get User Data Success",
          "success"
        );
        return response.data.data.profile.total_xp_points;
      } else {
        logMessage(
          this.currentNum,
          this.total,
          `Failed to get user data: ${response.data.error}`,
          "error"
        );
        return null;
      }
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Failed to get user data: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async processKeepAlive() {
    try {
      if (!this.token) {
        const authorkey = await generateAuthToken(this.address);
        await this.loginAccount(authorkey);
      }
      const chatRepeat = await this.chatRepeat();
      const pointsXp = await this.getTotalPoints();
      return {
        points: pointsXp,
        keepAlive: chatRepeat,
      };
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logMessage(
          this.currentNum,
          this.total,
          "Token expired, attempting to login again...",
          "warning"
        );
        await this.loginUser();
        return this.processKeepAlive();
      }

      logMessage(
        this.currentNum,
        this.total,
        `Failed to process account: ${error.message}`,
        "error"
      );
      throw error;
    }
  }
};
