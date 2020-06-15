var colors = require("ansi-colors");
var supportsColor = require("color-support");

/**
 * @param {string} message
 * @return {string}
 */
function noColor(message) {
  return message;
}

/**
 * @param {string} flag
 * @return {boolean}
 */
function hasFlag(flag) {
  return process.argv.indexOf("--" + flag) !== -1;
}

/**
 * @return boolean
 */
function shouldColour() {
  if (hasFlag("no-color")) {
    return false;
  }

  if (hasFlag("color")) {
    return true;
  }

  return supportsColor() && true;
}

var hasColors = shouldColour();

exports.ansi = {
  red: hasColors ? colors.red : noColor,
  green: hasColors ? colors.green : noColor,
  blue: hasColors ? colors.blue : noColor,
  magenta: hasColors ? colors.magenta : noColor,
  cyan: hasColors ? colors.cyan : noColor,
  white: hasColors ? colors.white : noColor,
  gray: hasColors ? colors.gray : noColor,
  bgRed: hasColors ? colors.bgRed : noColor,
  bold: hasColors ? colors.bold : noColor,
  yellow: hasColors ? colors.yellow : noColor,

  underline: hasColors ? colors.underline : noColor,
};
