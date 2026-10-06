/** Runs once when the server starts: begins the clean-up timer for website screenshots. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCleaner } = await import("./lib/storage");
    startCleaner();
  }
}
