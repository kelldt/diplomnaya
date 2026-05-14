import fs from "node:fs";

const text = fs.readFileSync("data/rcsi-176/extreme_pollution.csv", "utf8");
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(";").map((x) => x.replaceAll('"', "").trim());
const idx = header.indexOf("subject");
const idxInd = header.indexOf("indicator");

const subjects = new Map();
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(";");
  const subj = (cols[idx] || "").replaceAll('"', "").trim();
  const ind = (cols[idxInd] || "").replaceAll('"', "").trim();
  if (!subjects.has(subj)) subjects.set(subj, new Set());
  if (ind) subjects.get(subj).add(ind);
}

console.log("subjects_count", subjects.size);
for (const [s, inds] of subjects) {
  if (s.toLowerCase().includes("орен")) {
    console.log("subject", s);
    console.log("indicators_sample", Array.from(inds).slice(0, 20));
  }
}

