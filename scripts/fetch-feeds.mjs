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
    { name: "Import AI", url: "https://jack-clark.net/feed/" } ] },
  { id: "capital", label: "Capital & marché", sources: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
    { name: "Sifted", url: "https://sifted.eu/feed/" } ] },
  { id: "capab", label: "Capabilities & releases", sources: [
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" } ] },
  { id: "usages", label: "Usages & analyse critique", sources: [
    { name: "AI Snake Oil", url: "https://www.aisnakeoil.com/feed" },
    { name: "Hacker News", url: "https://hnrss.org/frontpage?points=100" } ] },
  { id: "france", label: "France & Europe", sources: [
    { name: "Numerama", url: "https://www.numerama.com/feed/" },
    { name: "Siècle Digital", url: "https://siecledigital.fr/feed/" },
    { name: "ActuIA", url: "https://www.actuia.com/feed/" } ] }
];

const MAX_ITEMS = 300, MAX_AGE_DAYS = 45;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; StratospheriqueObservatoire/1.0)" }
});

function stripHtml(s = "") {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function pickDate(item) {
  const d = item.isoDate || item.pubDate || item.date;
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

async function synthese(label, items) {
  if (!ANTHROPIC_KEY || !items.length) return null;
  const list = items.slice(0, 25)
    .map((i, n) => `${n + 1}. [${i.source}] ${i.title}${i.snippet ? " — " + i.snippet : ""}`)
    .join("\n");
  const prompt = `Tu es analyste pour le cabinet de conseil Stratosphérique. À partir des actualités IA ci-dessous (couloir « ${label} »), rédige une note stratégique en français.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans balises de code, avec EXACTEMENT cette forme :
{
  "titre": "une phrase qui résume l'information principale",
  "resume": "résumé exécutif de 3 à 5 phrases : l'essentiel pour qui ne lit que ça",
  "faits": ["3 à 7 faits marquants, une phrase courte chacun"],
  "implications": [{"fait": "le fait", "pourquoi": "pourquoi c'est important / impact potentiel"}],
  "signaux": ["signaux faibles à surveiller : nouveaux acteurs, réglementation, mouvements de talents, technos émergentes"],
  "conclusion": "une seule phrase forte, à retenir"
}
Style : concis, direct, sans jargon, niveau comité de direction. Pas de bla-bla. N'invente rien qui ne soit pas étayé par les actualités.

ACTUALITÉS :
${list}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] })
    });
    if (!r.ok) { console.warn(`Synthese ${label} — HTTP ${r.status}`); return null; }
    const data = await r.json();
    let text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const obj = JSON.parse(text);
    obj.generatedAt = new Date().toISOString();
    console.log(`Synthese OK — ${label}`);
    return obj;
  } catch (e) { console.warn(`Synthese ${label} — ${e.message || e}`); return null; }
}

async function run() {
  const items = [];
  for (const cat of CATEGORIES) {
    for (const src of cat.sources) {
      try {
        const feed = await parser.parseURL(src.url);
        let n = 0;
        for (const it of feed.items || []) {
          const link = (it.link || it.guid || "").trim();
          const title = (it.title || "").trim();
          if (!title || !link) continue;
          items.push({
            id: link, title, link, source: src.name, category: cat.id,
            ts: pickDate(it),
            snippet: stripHtml(it.contentSnippet || it.content || it.summary || "").slice(0, 280)
          });
          n++;
        }
        console.log(`OK  ${src.name} — ${n}`);
      } catch (err) { console.warn(`ERR ${src.name} — ${err.message || err}`); }
    }
  }
  const seen = new Set();
  let cleaned = items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  cleaned = cleaned.filter((i) => i.ts === null || i.ts >= cutoff);
  cleaned.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  cleaned = cleaned.slice(0, MAX_ITEMS);

  const syntheses = {};
  if (ANTHROPIC_KEY) {
    const g = await synthese("Tout le terrain", cleaned);
    if (g) syntheses.global = g;
    for (const cat of CATEGORIES) {
      const its = cleaned.filter((i) => i.category === cat.id);
      const s = await synthese(cat.label, its);
      if (s) syntheses[cat.id] = s;
    }
  } else {
    console.log("Pas de cle ANTHROPIC_API_KEY — synthese ignoree.");
  }

  const out = {
    generatedAt: new Date().toISOString(),
    categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
    count: cleaned.length, items: cleaned, syntheses
  };
  await mkdir(join(ROOT, "data"), { recursive: true });
  await writeFile(join(ROOT, "data", "feeds.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`\n→ data/feeds.json — ${cleaned.length} signaux, ${Object.keys(syntheses).length} synthèses`);
}
run().catch((e) => { console.error(e); process.exit(1); });
