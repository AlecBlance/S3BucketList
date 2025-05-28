const logger = (...args: any[]) => {
  console.log("\x1b[36m[logger]:\x1b[0m", ...args); // Cyan color with logger indication
};

export { logger };
