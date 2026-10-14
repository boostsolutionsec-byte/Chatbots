#!/usr/bin/env tsx
// Valida la carpeta de un bot sin IA:  npm run validate -- <bot-id>   (o sin argumento: todos)
import { loadDotEnv } from '../runtime.js';
import { loadBot, listBots, botsDir } from '../config/loader.js';
import { loadEvals } from '../evals/runner.js';
import { Locator } from '../locator/locator.js';

loadDotEnv();
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let failed = false;
for (const id of ids.length ? ids : listBots(botsDir())) {
  try {
    const bot = loadBot(id);
    const { cases, errors } = loadEvals(bot.evalsDir);
    const loc = new Locator(bot.tiendas);
    const sinUbicar = bot.tiendas.filter((t) => !loc.gazetteer.lookup(t.ciudad, loc.gazetteer.provinceCode(t.provincia)) && (t.lat === undefined || t.lng === undefined));
    console.log(`✅ ${id}: ${bot.tiendas.length} tiendas · ${bot.catalogo.length} productos · ${bot.knowledge.length} docs de conocimiento · ${cases.length} evals`);
    for (const w of bot.warnings) console.log(`   ⚠️  ${w}`);
    for (const e of errors) console.log(`   ❌ eval: ${e}`);
    for (const t of sinUbicar) console.log(`   ⚠️  tienda ${t.id}: ciudad "${t.ciudad}" desconocida y sin coordenadas → nunca saldrá por distancia`);
    if (errors.length) failed = true;
  } catch (e) {
    failed = true;
    console.log(`❌ ${id}: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
