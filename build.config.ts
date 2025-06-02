import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/forms/index"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
});
