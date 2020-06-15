const path = require("path");

const { src, dest } = require("gulp");
const babel = require("gulp-babel");
const sourcemaps = require("gulp-sourcemaps");

/**
 * @param {string} root
 * @return {() => NodeJS.ReadWriteStream}
 */
exports.babel = function(root) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return src(path.join(root, "src", "**", "*.ts"))
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write("."))
      .pipe(dest(path.join(root, "build")));
  };
};
