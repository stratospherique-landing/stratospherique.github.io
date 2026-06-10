import Parser from "rss-parser";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CATEGORIES = [
  { id: "radar", label: "Radar & postures", sources: [
    { name: "Techmeme", url: "https://www.techmeme.com/feed.xml" },
    { name: "Stratechery", url: "https://stratechery.com/feed/" },
    { name: "Import AI", url: "https://jack-clark.net/feed/", aiOnly: true } ] },
  { id: "capital", label: "Capital & marché", sources: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
    { name: "Sifted", url: "https://sifted.eu/feed/" } ] },
  { id: "capab", label: "Capabilities & releases", sources: [
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", aiOnly: true } ] },
  { id: "usages", label: "Usages & analyse critique", sources: [
    { name: "AI Snake Oil", url: "https://www.aisnakeoil.com/feed", aiOnly: true },
    { name: "Hacker News", url: "https://hnrss.org/frontpage?points=100" } ] },
  { id: "france", label: "France & Europe", sources: [
    { name: "Numerama", url: "https://www.numerama.com/feed/" },
    { name: "Siècle Digital", url: "https://siecledigital.fr/feed/" },
    { name: "ActuIA", url: "https://www.actuia.com/feed/", aiOnly: true } ] }
];

const MAX_ITEMS = 300, MAX_AGE_DAYS = 45;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5";

const AI_RE = /\b(ia|intelligence artificielle|artificial intelligence|machine learning|deep learning|neural|r[ée]seaux? de neurones|llm|gpt|chatgpt|openai|anthropic|claude|gemini|mistral|llama|hugging\s?face|copilot|midjourney|stable diffusion|nvidia|gpu|g[ée]n[ée]ratives?|generative|genai|agentique|agentic|inf[ée]rence|inference|transformer|fine[\s-]?tun|rag|chatbot|deepfake|deepseek|grok|perplexity|sora|dall-?e)\b/i;
function isAI(title, snippet) {
  const raw = title + " " + snippet;
  if (/\bAI\b/.test(raw)) return true;
  return AI_RE.test(raw.toLowerCase());
}

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; StratospheriqueObservatoire/1.0)" }
});

function stripHtml(s = "") {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function pickDate(item) {
