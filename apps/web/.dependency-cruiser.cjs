/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "lib-no-cycles",
      severity: "error",
      from: { path: "src/lib/" },
      to: { path: "src/lib/", circular: true },
    },
    {
      name: "route-imports-only-lib-entrypoints",
      severity: "error",
      comment:
        "Route handlers may import from src/lib/ module files directly. " +
        "They must not reach into any subfolder of src/lib/ (if one is added later).",
      from: { path: "src/app/" },
      to: {
        path: "src/lib/",
        pathNot: "src/lib/[^/]+\\.ts$",
      },
    },
    {
      name: "tests-imports-only-lib-entrypoints",
      severity: "error",
      comment:
        "Test files may import from src/lib/ module files directly. " +
        "They must not reach into any subfolder of src/lib/.",
      from: { path: "\\.test\\.ts$" },
      to: {
        path: "src/lib/",
        pathNot: "src/lib/[^/]+\\.ts$",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules/",
    },
    tsPreCompilationDeps: false,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
