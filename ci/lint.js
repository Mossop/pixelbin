const { promises: fs } = require("fs");
const path = require("path");

async function lintPackages() {
  let root = path.resolve(path.dirname(__dirname));

  let packageLock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), {
    encoding: "utf8",
  }));

  let packagePath = path.join(root, "src", "client", "externals.json");
  let packages = JSON.parse(await fs.readFile(packagePath, {
    encoding: "utf8",
  }));

  let errors = [];

  for (let pkg of packages) {
    if (!(pkg.id in packageLock.dependencies)) {
      errors.push(`Package ${pkg.id} not listed in package-lock.json`);
      continue;
    }

    let file = pkg.productionPath.split("/");
    let target = path.join(root, "node_modules", pkg.id, ...file);
    try {
      let stat = await fs.stat(target);
      if (!stat.isFile()) {
        errors.push(`Target path for ${pkg.id} does not exist in package.`);
        continue;
      }
    } catch (e) {
      errors.push(`Target path for ${pkg.id} (${target}) does not exist in package.`);
      continue;
    }

    file = pkg.developmentPath.split("/");
    target = path.join(root, "node_modules", pkg.id, ...file);
    try {
      let stat = await fs.stat(target);
      if (!stat.isFile()) {
        errors.push(`Target path for ${pkg.id} does not exist in package.`);
        continue;
      }
    } catch (e) {
      errors.push(`Target path for ${pkg.id} (${target}) does not exist in package.`);
      continue;
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

lintPackages().catch(console.error);
