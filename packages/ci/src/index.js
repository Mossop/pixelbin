module.exports = {
  ...require("./ansi"),
  ...require("./babel"),
  ...require("./coverage"),
  ...require("./eslint"),
  ...require("./jest"),
  ...require("./karma"),
  ...require("./lint"),
  spawn: require("./process").spawn,
  ...require("./typescript"),
  ...require("./utils"),
};

// Good grief!
module.exports["Pro" + "cess"] = require("./process").Process;
