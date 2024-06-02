import path from "path";
import { promises as fs } from "fs";

const VERSION_RE = /major=(\d+), minor=(\d+), revision=(\d+), build=\d+,/;

function parseVersion(major, minor, patch) {
  let parts = [];
  if (process.argv[2] && process.argv[2].startsWith("v")) {
    parts = process.argv[2].slice(1).split(".");
    while (parts.length < 3) {
      parts.push(0);
    }

    return {
      major: parts[0] ?? 0,
      minor: parts[1] ?? 0,
      patch: parts[2] ?? 0,
    };
  }

  return {
    major,
    minor,
    patch,
  };
}

let source = path.join(import.meta.dirname, "packages", "LrPixelbin.lrplugin");
let target = path.join(import.meta.dirname, "build", "LrPixelbin.lrplugin");

await fs.rm(target, { recursive: true, force: true });
await fs.mkdir(target, { recursive: true });
await fs.cp(source, target, { recursive: true, preserveTimestamps: true });

let sourceInfo = path.join(source, "Info.lua");
let targetInfo = path.join(target, "Info.lua");

let info = await fs.readFile(sourceInfo, { encoding: "utf8" });
let output = [];
for (let line of info.split("\n")) {
  if (line.endsWith('-dev",')) {
    line = line.slice(0, -6) + '",';
  } else if (line.endsWith('-Dev",')) {
    line = line.slice(0, -6) + '",';
  }

  let versionMatches = VERSION_RE.exec(line);
  if (versionMatches) {
    let version = parseVersion(
      versionMatches[1],
      versionMatches[2],
      versionMatches[3]
    );
    line = line.replace(
      VERSION_RE,
      `major=${version.major}, minor=${version.minor}, revision=${version.patch}, build=0,`
    );
  }

  output.push(line);
}

await fs.writeFile(targetInfo, output.join("\n"));
