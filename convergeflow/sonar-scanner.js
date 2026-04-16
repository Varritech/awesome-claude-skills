const scanner = require("sonarqube-scanner");

scanner(
  {
    serverUrl: process.env.SONAR_HOST_URL || "https://sonarcloud.io",
    token: process.env.SONAR_TOKEN || "",
    options: {
      "sonar.projectKey": "varritech_convergeflow",
      "sonar.organization": "varritech",
      "sonar.projectName": "ConvergeFlow",
      "sonar.sources": "src",
      "sonar.tests": "src",
      "sonar.test.inclusions": "src/**/*.{test,spec}.{ts,tsx}",
      "sonar.exclusions": "src/**/*.d.ts,src/**/*.index.ts",
      "sonar.javascript.lcov.reportPaths": "coverage/lcov.info",
      "sonar.coverage.exclusions": "src/app/**,src/components/icons/**",
    },
  },
  () => process.exit()
);