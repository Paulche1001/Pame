const BuzzerMode = require("./buzzerMode");
module.exports = class WhoIsMode extends BuzzerMode {
  constructor(io, players, questions, variant = "whois_emojis", options = {}) {
    super(io, players, questions, "whois", options);
    this.variant = variant;
  }
};
