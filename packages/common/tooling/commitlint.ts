import { execSync } from "node:child_process";

const run = (command: string): void => {
  execSync(command, { stdio: "inherit" });
};

try {
  execSync("git rev-parse --verify HEAD", { stdio: "ignore" });
} catch {
  console.log("No commits found yet. Skipping commitlint.");
  process.exit(0);
}

run("commitlint --last --verbose");
