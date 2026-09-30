// Container entry point. Hosts mount persistent volumes owned by root (Railway, and often Render
// and plain `docker run -v`), which the unprivileged app user can't write to. Started as root, this
// hands the data folder to the `node` user, drops to that user for good, then starts the Next.js
// server. Started as any other user (a host that forces one), it just starts the server.
const fs = require("node:fs");
const path = require("node:path");

function nodeUser() {
  try {
    const line = fs
      .readFileSync("/etc/passwd", "utf8")
      .split("\n")
      .find((l) => l.startsWith("node:"));
    if (line) {
      const [, , uid, gid, , home] = line.split(":");
      return { uid: Number(uid), gid: Number(gid), home };
    }
  } catch {
    /* fall through */
  }
  return { uid: 1000, gid: 1000, home: "/home/node" };
}

function chownTree(dir, uid, gid) {
  fs.chownSync(dir, uid, gid);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) chownTree(p, uid, gid);
    else fs.lchownSync(p, uid, gid);
  }
}

if (typeof process.getuid === "function" && process.getuid() === 0) {
  const user = nodeUser();
  const dataDir = process.env.INTROMAKER_DATA_DIR;
  if (dataDir) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      chownTree(dataDir, user.uid, user.gid);
    } catch (e) {
      console.warn(`[intromaker] could not prepare ${dataDir}: ${e.message}`);
    }
  }
  process.setgroups([user.gid]);
  process.setgid(user.gid);
  process.setuid(user.uid);
  process.env.HOME = user.home;
  process.env.USER = "node";
}

require("./server.js");
