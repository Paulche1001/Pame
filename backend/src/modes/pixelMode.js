const BuzzerMode = require("./buzzerMode");
module.exports = class PixelMode extends BuzzerMode {
  constructor(io, players) {
    super(io, players, require("../questions/pixelPictures.json"), "pixel");
  }
};
