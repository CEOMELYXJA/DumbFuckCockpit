"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repository = path.resolve(__dirname, "../../");
const output = path.join(__dirname, "..", "widget");
const appFiles = ["index.html", "tasks.js", "tasks.css", "manifest.webmanifest", "service-worker.js", "icon.svg"];

fs.mkdirSync(output, { recursive: true });
for (const file of appFiles) {
  fs.copyFileSync(path.join(repository, file), path.join(output, file));
}

