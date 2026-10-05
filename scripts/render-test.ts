import path from "node:path";
import { generateVoiceover } from "../lib/tts";
import { buildContent } from "../lib/templates";
import { withSyncedSpeech } from "../lib/speech";
import { renderVideo } from "../lib/render-video";
import { FPS } from "../video/config";

async function main() {
  const output = path.resolve("output/test.mp4");
  const content = buildContent("explain", "创业 = 自由？");
  const voice = await generateVoiceover(content.voiceover, "test-voice", "zh");
  const synced = withSyncedSpeech(content, voice.cues, FPS);
  await renderVideo({ content: synced, audioSrc: voice.publicSrc, output });
  console.log(`Rendered: ${output}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
