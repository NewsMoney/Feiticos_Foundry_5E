import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleRate = 44100;
const duration = 2.2;
const sampleCount = Math.floor(sampleRate * duration);
const pcm = Buffer.alloc(sampleCount * 2);
let randomState = 0x5eed1234;
let filteredNoise = 0;

function random() {
  randomState = (1664525 * randomState + 1013904223) >>> 0;
  return randomState / 0xffffffff * 2 - 1;
}

for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  const attack = Math.min(time / 0.018, 1);
  const decay = Math.exp(-time * 2.25);
  filteredNoise += 0.035 * (random() - filteredNoise);
  const body = Math.sin(2 * Math.PI * (54 - 9 * time) * time) * 0.5;
  const rumble = Math.sin(2 * Math.PI * 31 * time) * 0.24;
  const crack = filteredNoise * Math.exp(-time * 8) * 1.4;
  const echoTime = Math.max(time - 0.18, 0);
  const echo = time > 0.18
    ? Math.sin(2 * Math.PI * 43 * echoTime) * Math.exp(-echoTime * 3.1) * 0.22
    : 0;
  const sample = Math.max(-1, Math.min(1, attack * decay * (body + rumble + crack) + echo));
  pcm.writeInt16LE(Math.round(sample * 32767 * 0.82), index * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const outputDirectory = path.join(root, "sounds");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "thunderclap.wav"), Buffer.concat([header, pcm]));
console.log("Som do Thunderclap gerado.");
