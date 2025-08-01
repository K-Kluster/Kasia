import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "src/service/indexer/openapi.json",
  output: "src/service/indexer/generated",
  plugins: [
    "@hey-api/schemas",
    {
      dates: true,
      name: "@hey-api/transformers",
    },
    {
      enums: "javascript",
      name: "@hey-api/typescript",
    },
    {
      name: "@hey-api/sdk",
      transformer: true,
    },
  ],
});
