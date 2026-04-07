import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", "android/**", "ios/**", ".next/**", "out/**", "MarkdownPad/**"],
  },
];

export default eslintConfig;
