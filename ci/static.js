const crypto = require("crypto");
const { promises: fs } = require("fs");
const path = require("path");

const chokidar = require("chokidar");
const glob = require("glob");

/**
 * @param {string} pattern
 * @param {string} cwd
 * @returns {Promise<string[]>}
 */
function listFiles(pattern, cwd) {
  return new Promise((resolve, reject) => {
    glob(pattern, {
      cwd,
      nodir: true,
      absolute: true,
    }, (err, matches) => {
      if (err) {
        reject(err);
      } else {
        resolve(matches);
      }
    });
  });
}

async function build() {
  let hasher = crypto.createHash("md5");

  let root = path.resolve(path.dirname(__dirname));

  let source = path.join(root, "static", "client");
  let target = path.join(root, "build", "static");

  let files = await listFiles("**/*", source);
  for (let file of files) {
    let relative = path.relative(source, file);
    let targetFile = path.resolve(target, relative);
    await fs.mkdir(path.dirname(targetFile), {
      recursive: true,
    });

    let contents = await fs.readFile(file);
    hasher.update(contents);
    await fs.writeFile(targetFile, contents);
  }

  let hash = hasher.digest("hex");
  await fs.writeFile(path.join(target, "hash.txt"), Buffer.from(hash));

  console.log("Built static content.");
}

function watch() {
  let root = path.resolve(path.dirname(__dirname));

  let watcher = chokidar.watch("**/*", {
    persistent: true,
    cwd: path.join(root, "static", "client"),
  });

  /**
   * @type {NodeJS.Timeout | undefined}
   */
  let timeout = undefined;
  const trigger = () => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      build().catch(console.error);
    }, 100);
  };

  watcher.on("all", trigger);
}

let args = process.argv.slice(2);
if (args[0] == "watch") {
  args.shift();
  watch();
} else {
  build().catch(console.error);
}
