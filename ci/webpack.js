const { promises: fs } = require("fs");
const path = require("path");

const webpack = require("webpack");

/**
 * @param {string[]} args
 * @return {"test" | "development" | "production"}
 */
function config(args) {
  switch (args[0]) {
    case "test":
    case "development":
      return args[0];
  }

  return "production";
}

/**
 * @param {"development" | "production"} mode
 * @return {Promise<void>}
 */
async function build(mode) {
  await fs.mkdir(path.join(__dirname, "..", "dist"), {
    recursive: true,
  });

  let webpackConfig = require("../src/client/webpack.config")(mode);
  if (mode == "production") {
    webpackConfig.profile = true;
    webpackConfig.parallelism = 1;
  }
  let compiler = webpack(webpackConfig);

  /**
   * @type {import("webpack").Stats}
   */
  let stats = await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err);
        return;
      }

      resolve(stats);
    });
  });

  if (mode == "production") {
    let json = stats.toJson({
      moduleTrace: true,
      modules: true,
      entrypoints: true,
      chunkModules: true,
      chunks: true,
      chunkGroups: true,
      chunkOrigins: true,
    }, false);
    await fs.writeFile(path.join(__dirname, "..", "dist", "stats.json"), JSON.stringify(json));
  }

  console.log(stats.toString(webpackConfig.stats));

  if (stats.hasErrors()) {
    throw new Error("Compilation failed.");
  }
}

/**
 * @param {"test" | "development" | "production"} mode
 * @return {void}
 */
function watch(mode) {
  let webpackConfig = require("../src/client/webpack.config")(mode);
  let compiler = webpack(webpackConfig);

  compiler.watch({}, (err, stats) => {
    let results = stats.toString(webpackConfig.stats);
    if (results) {
      console.log(results);
    } else {
      console.log("Client code rebuilt.");
    }
  });
}

let args = process.argv.slice(2);
if (args[0] == "watch") {
  args.shift();
  watch(config(args));
} else {
  build(config(args)).catch(console.error);
}
