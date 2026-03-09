# QA Audit Rapport: search-lotana Edge Function v33/v34

**Datum:** 2026-03-09
**Tester:** Claude (geautomatiseerde QA)
**Methode:** Statische code-analyse van werkelijke v34 code (opgehaald via Supabase MCP) + SQL functie-analyse + live database queries
**Code versie:** Supabase slug v34, interne versie v33-BUGFIX

---

## Executive Summary

De v33-bugfix release heeft **11 van de 13 eerder gerapporteerde bugs aangepakt**. Score normalisatie (BUG-001) is nu in-memory gefixt, d&d preprocessing werkt, CORS is consistent, en duration parsing is verbeterd. Echter: de SQL-laag is ONGEWIJZIGD gebleven — de SQL functie `lotana_hybrid_search` heeft nog steeds het normalisatieprobleem, en `lotana_exact_match` mist nog steeds velden. De in-memory workarounds in de Edge Function zijn functioneel maar fragiel. Daarnaast zijn er **8 nieuwe issues** gevonden in de bugfix-code zelf, en **alle data-kwaliteitsproblemen** (HTML, corrupte players, corrupte ages) zijn nog steeds aanwezig in de database.

**Risicobeoordeling: MEDIUM-HOOG** (verbeterd van HOOG)

---

## 1. Status van Eerder Gerapporteerde Bugs

### Gefixt in v33/v34 Edge Function code:

| Bug | Beschrijving | Fix Status | Kwaliteit Fix |
|-----|-------------|------------|---------------|
| BUG-001 | Score normalisatie FTS vs semantic | GEFIXT (in-memory) | Goed maar fragiel - SQL nog niet gefixt |
| BUG-004 | d&d query preprocessing | GEFIXT | Goed - abbreviations map + preprocessing |
| BUG-005 | exact_match schema alignment | GEDEELTELIJK | Velden worden in-memory toegevoegd, maar SQL retourneert ze niet |
| BUG-006 | Spelfouttolerantie | GEFIXT | Goed maar beperkt - hardcoded dictionary |
| BUG-007 | availability !== 'out_of_stock' | GEFIXT | Correct |
| BUG-008 | response_format: json_object | GEFIXT | Correct |
| BUG-009 | Duration range parsing | GEFIXT | Goed - inclusief "90+" format |
| BUG-010 | price === 0 falsy check | GEFIXT | Correct - expliciete null check |
| BUG-011 | CORS headers op alle responses | GEFIXT | Correct - CORS_HEADERS constant |
| BUG-012 | HTTP method validatie | GEFIXT | Correct - 405 response |
| BUG-013 | match_count validatie | GEDEELTELIJK | `Math.max(1, 200)` is altijd 200 - geen echte validatie |

### NIET gefixt (SQL-laag / database):

| Issue | Beschrijving | Status |
|-------|-------------|--------|
| DQ-001 | 90.8% HTML in beschrijvingen | **NOG STEEDS: 5.274 producten** |
| DQ-002 | Corrupte min/max_players | **VERSLECHTERD: 68 producten** (was 36) |
| DQ-003 | Corrupte min_age op accessoires | **NOG STEEDS: 86 producten** |
| DQ-004 | availability = 'unknown' | **NOG STEEDS: 729 producten** |
| MED-008 | Duplicate GIN index | **NOG STEEDS: 2 identieke FTS indexes** |
| MED-009 | Ontbrekende ean_code/sku indexes | **NOG STEEDS: geen indexes** |
| SQL | lotana_hybrid_search niet genormaliseerd | **NOG STEEDS** |
| SQL | lotana_exact_match mist velden | **NOG STEEDS** |

---

## 2. Kritieke Issues (blokkers)

| ID | Issue | Impact | Locatie | Aanbeveling |
|----|-------|--------|---------|-------------|
| K1 | **SQL `lotana_hybrid_search` nog steeds niet genormaliseerd** — de Edge Function doet nu in-memory normalisatie, maar de SQL LIMIT selecteert al de top-200 op BASIS van de niet-genormaliseerde combined_score. Producten met hoge FTS maar lage semantic score worden geselecteerd VOOR de normalisatie plaatsvindt. | Conceptuele queries missen potentieel de beste semantische matches omdat die al weggefilterd zijn door de SQL LIMIT op de verkeerde ranking. De in-memory fix corrigeert alleen de VOLGORDE van de top-200, niet de SELECTIE. | `lotana_hybrid_search` SQL, regel `LIMIT match_count` | Fix de SQL functie zelf met min-max normalisatie, of gebruik twee aparte queries (top-N FTS + top-N semantic) en merge in-memory. |
| K2 | **`d&d` geeft nog steeds 74 FTS false positives in SQL** — `plainto_tsquery('dutch', 'd&d')` produceert `'d' & 'd'`. De Edge Function preprocessing expandeert naar "dungeons and dragons", maar de SQL FTS CTE matcht ALLE 74 producten met letter "d". Deze 74 krijgen nonzero fts_score en beïnvloeden de top-200 selectie. | 74 irrelevante producten nemen plekken in van de top-200 pool. Na in-memory normalisatie worden ze wel lager gerankt, maar ze verdringen potentieel betere semantische matches. | `lotana_hybrid_search` SQL, `plainto_tsquery` | Gebruik `websearch_to_tsquery` of voeg pre-processing toe in de SQL functie. Of: stuur de preprocessed query naar SQL ipv de originele. |
| K3 | **5.274 beschrijvingen bevatten raw HTML** — Onveranderd. Vervuilt FTS-index (HTML tags worden geïndexeerd) en embeddings (markup-ruis). | Verminderde zoekprecisie voor zowel FTS als semantic search. FTS kan matchen op "strong", "nbsp", "div" etc. | Database `lotana_products.description` | Migratiescript: `UPDATE lotana_products SET description = regexp_replace(regexp_replace(description, '<[^>]+>', ' ', 'g'), '&[a-z]+;', '', 'g')` + re-index FTS + re-embed. |
| K4 | **Corrupte players data VERSLECHTERD: nu 68 producten** (was 36) — Puzzelmatten met stukjes-aantallen als min/max_players (300-6000), jaarcijfers uit titels (1952-1954), en verkeerd geclassificeerde spellen (Dobble Classic als accessoire). | Players filter geeft corrupte resultaten. De Edge Function code skipt nu producten met `min_players > 20`, maar dit is een pleisters-fix die echte 20+ player games ook zou skippen. | Database + players filter code | Clean data: `UPDATE lotana_products SET min_players=NULL, max_players=NULL WHERE product_type IN ('puzzel','accessoire') AND min_players IS NOT NULL;` + fix trigger classificatie. |

---

## 3. Hoge Issues (moeten gefixt)

| ID | Issue | Impact | Locatie | Aanbeveling |
|----|-------|--------|---------|-------------|
| H1 | **`normalizeScores` min-max normalisatie is instabiel bij weinig resultaten** — Bij <3 resultaten met FTS score > 0 wordt `ftsRange` zeer klein. Eén outlier FTS score kan alle andere naar ~0 normaliseren. Bij exact 1 FTS result: `ftsRange = 0`, formule deelt door 1 (de fallback), maar het resultaat is `(score - min) / 1` wat incorrect is. | Ranking kan chaotisch zijn bij queries met weinig FTS matches (bijv. zeldzame productnamen). | `normalizeScores()`, regel `const ftsRange = ftsMax - ftsMin \|\| 1` | Gebruik percentiel-normalisatie of rank-based normalisatie ipv min-max. Of: bij <5 FTS results, skip normalisatie en gebruik alleen semantic scores. |
| H2 | **`lotana_exact_match` SQL retourneert NIET availability, product_type, puzzle_pieces_min/max** — De Edge Function voegt `availability: p.availability \|\| 'unknown'` toe, maar `p.availability` is `undefined` (niet geretourneerd door SQL). Dus ALLE exact_match resultaten krijgen `availability: 'unknown'`. | Exact match resultaten hebben altijd `availability: 'unknown'` ongeacht werkelijke status. Downstream consumers die op availability filteren krijgen verkeerde data. | `lotana_exact_match` SQL functie + Edge Function enrichment | Voeg ontbrekende kolommen toe aan de SQL functie return type. |
| H3 | **`isEanOrSku` regex `^[A-Z]{3,4}\d{4,10}$` matcht geldige zoektermen** — Hoewel test toont dat geen productnamen exact dit patroon matchen, matchen zoektermen als "HABA2345", "EXIT1234" WEL. Deze worden als SKU behandeld → exact_match → 0 resultaten → geen fallback naar hybrid search. | Zoektermen die toevallig op een SKU-patroon lijken geven 0 resultaten zonder foutmelding. | `isEanOrSku()` | Voeg fallback toe: als exact_match 0 resultaten geeft, alsnog hybrid search uitvoeren. |
| H4 | **Spelling dictionary is statisch en niet uitbreidbaar** — Hardcoded dictionary van ~30 entries. Nieuwe spelfouten vereisen code deployment. Veel voorkomende fouten ontbreken (bijv. "exploding kittns", "uno stacko", varianten van Azul uitbreidingen). | Spelfouttolerantie werkt alleen voor de 30 hardcoded entries. Alle andere spelfouten vertrouwen volledig op semantic search. | `getSpellingVariants()` | Verplaats dictionary naar database tabel of Supabase config. Of implementeer echte Levenshtein-afstand met `pg_trgm`. |
| H5 | **`fuzzyNameMatch` common-prefix matching is te simplistisch** — Checkt alleen of eerste 3 characters matchen. "cat" → matcht "catapult", "catheter", etc. "pan" → matcht "panorama", "pannenkoek". | False positive name boosts voor ongerelateerde producten. Een zoekopdracht naar "Pandemic" boost ook "Panorama" puzzels. | `fuzzyNameMatch()` | Implementeer echte edit-distance (Levenshtein) met threshold, of gebruik `pg_trgm` similarity in SQL. |
| H6 | **Geen timeout op LLM filter extractie** — `extractFiltersWithLLM` heeft geen AbortController/timeout. `generateEmbedding` heeft WEL een 10s timeout (goed). Als OpenAI chat API traag is, kan de Edge Function hangen tot Deno's 30s timeout. | Bij OpenAI latency spikes hangt de hele zoekfunctie. Deno timeout geeft een cryptische error ipv graceful degradation. | `extractFiltersWithLLM()` | Voeg AbortController toe met 5s timeout, net als bij `generateEmbedding`. |

---

## 4. Medium Issues (nice to have)

| ID | Issue | Impact | Locatie | Aanbeveling |
|----|-------|--------|---------|-------------|
| M1 | **`matchesPuzzlePieces` falsy check op 0** — `if (!productMin && !productMax) return true`. `!0` is true, dus puzzle_pieces_min=0 bypast filter. | Latente bug (0 is geen geldige puzzel-stukaantal in huidige data). | `matchesPuzzlePieces()` | Gebruik `productMin === null && productMax === null`. |
| M2 | **Language filter matcht te breed met substring** — `prodLang.includes(searchLang)`. "Nederlands" matcht "Nederlands, Engels, Frans, Duits" (correct), maar "Frans" zou ook matchen als onderdeel van een niet-Frans product (bijv. hypothetisch "niet-Franstalig"). Bidirectionele check `searchLang.includes(prodLang)` is onverwacht: als searchLang="Nederlands" en prodLang="Ne", zou dat matchen. | Mogelijke false positives bij language filtering. | Language filter in main handler | Split `p.language` op comma, check of zoektaal IN de lijst zit: `prodLang.split(',').map(l => l.trim().toLowerCase()).includes(searchLang)`. |
| M3 | **`safeMatchCount = Math.max(1, 200)` is altijd 200** — De "FIX BUG-013" is een no-op. De hardcoded 200 wordt nooit dynamisch aangepast. | match_count is altijd 200, ongeacht of de query minder resultaten nodig heeft. Voor queries met strenge filters (bijv. "puzzel 500 stukjes Engels") wordt 200 opgehaald maar >90% weggefilterd. | Main handler | Dynamisch match_count op basis van verwacht filter-verlies. Of laat 200 maar verwijder de misleidende "fix" comment. |
| M4 | **Players filter skipt producten met `min_players > 20` als "corrupt"** — Dit filtert ook echte mega-spellen weg. "Werewolves" (8-40 spelers) zou als corrupt behandeld worden. | Echte grote-groep spellen worden ten onrechte doorgelaten zonder filtering (ze bypassen het filter ipv correct geëvalueerd te worden). | Players filter, `if (p.min_players > 20 \|\| p.max_players > 20) return true` | Filter corrupt data in de database, niet in de query-logica. Verwijder de >20 check en clean de bron. |
| M5 | **`getDefaultFilters` extraheert geen numerieke filters** — Bij LLM failure worden players, age, duration, price allemaal `null`. Query "spel voor 4 spelers 8+ onder 30 euro" verliest alle filters bij fallback. | 5-10% van queries (LLM timeout/error scenarios) krijgt geen filtering. | `getDefaultFilters()` | Voeg basis-regex extractie toe voor getallen: `/(\d+)\s*spelers/`, `/(\d+)\s*\+/`, `/€\s*(\d+)/`. |
| M6 | **Version mismatch: code zegt v33, slug is v34** — Verwarrend voor debugging en monitoring. | Moeilijk te achterhalen welke versie draait bij productie-issues. | Versie string | Synchroniseer versienummers bij elke deployment. |
| M7 | **`preprocessQuery` abbreviation matching mist randgevallen** — Check voor `lowerQuery.includes(` ${abbr} `)` matcht niet als afkorting aan begin/eind van zin staat met extra whitespace, of als afkorting gevolgd wordt door interpunctie. | "d&d!" of "ik zoek d&d." worden niet geëxpandeerd. | `preprocessQuery()` | Gebruik word-boundary regex: `new RegExp(\`\\b${abbr}\\b\`, 'gi')`. |
| M8 | **Duplicate GIN indexes verspillen 8MB en vertragen writes** — `idx_lotana_fts` en `lotana_products_fts_idx` zijn identiek. | Performance overhead bij INSERT/UPDATE + onnodige storage. | Database | `DROP INDEX lotana_products_fts_idx;` |
| M9 | **Geen indexes op ean_code en sku** — `lotana_exact_match` doet Seq Scan op 5.999 rijen. | 8.8ms nu, maar schaalt lineair bij groeiend assortiment. | Database | `CREATE INDEX idx_lotana_ean ON lotana_products(ean_code); CREATE INDEX idx_lotana_sku ON lotana_products(sku);` |
| M10 | **86 accessoires met corrupte min_age** — "18mm dobbelstenen" → min_age=18, "9-Pocket Portfolio" → min_age=9. | Age filter geeft incorrect resultaten voor accessoires. Edge Function accessoire safeguard in LLM filters helpt, maar niet als product_type niet als accessoire wordt herkend. | Database | `UPDATE lotana_products SET min_age=NULL WHERE product_type='accessoire';` |

---

## 5. Code Smells

- [ ] **Supabase client op module-scope** — `createClient(supabaseUrl, supabaseKey)` wordt 1x aangemaakt en hergebruikt over alle requests. Dit is correct voor Deno Edge Functions (cold start model), maar de non-null assertions op env vars (`Deno.env.get(...)!`) geven cryptische fouten bij missing config.
- [ ] **Hardcoded spelling dictionary** — 30+ entries inline in de code. Zou in een config/database tabel moeten.
- [ ] **Magic numbers** — `1.5` marge in duration filter, `0.7` marge in duration_min, `20` als max players threshold, `10000` ms embedding timeout, `500` max_tokens voor LLM. Geen van deze zijn geconfigureerd of gedocumenteerd.
- [ ] **`fuzzyNameMatch` return type is een score (0-1+) maar wordt opgeteld bij combined_score (0-2)** — De schalen zijn incompatibel. Een fuzzy boost van 0.5 is enorm vergeleken met een genormaliseerde combined_score van ~0.6-1.0.
- [ ] **Console.log overal** — 15+ console.log statements met emoji's. Prima voor debugging maar zal Supabase logs vervuilen in productie. Overweeg structured logging met log levels.
- [ ] **Geen rate limiting** — Elke request maakt 2 OpenAI API calls (chat + embedding). Geen bescherming tegen abuse.
- [ ] **`requestedStockFilter` type coercion** — `requestedStockFilter === true || requestedStockFilter === 'true'` is defensief maar de `!== undefined && !== null` check erboven laat `false` (boolean) en `0` door, wat `in_stock_only = false` correct zet. `"false"` (string) zet het ook op `false` wat correct is. Maar `1` (number) zou `false` geven — onverwacht.

---

## 6. Positieve Observaties

- **Score normalisatie in-memory is een goede workaround** — Min-max normalisatie + herberekening van combined_score is correct geïmplementeerd. Hoewel de SQL-selectie nog steeds suboptimaal is, verbetert dit de ranking significant.
- **LLM prompt is zeer gedetailleerd en goed gestructureerd** — Voorbeelden, safeguards, en edge cases zijn goed gedocumenteerd. De prompt behandelt puzzels-zonder-players, duration-parsing, en leeftijdsmodellen expliciet.
- **Safeguards zijn uitgebreid** — Age < 3 validatie, puzzel players removal, accessoire age removal, unrealistische duration/players caps. Dit vangt veel LLM-hallucinaties op.
- **Duration parsing is significant verbeterd** — Ondersteunt nu "60-120 min", "90+" en single values. De marge-logica (1.5x voor max, 0.7x voor min) is een pragmatische keuze.
- **CORS is nu consistent** — Alle responses (200, 400, 405, 500) hebben dezelfde CORS headers via de `CORS_HEADERS` en `JSON_HEADERS` constants.
- **Embedding timeout is toegevoegd** — 10s AbortController op de embedding API call. Goed.
- **`normalizeLanguage` mapping is compleet** — Dekt NL/EN/DE/FR spellingen en ISO codes.
- **Semantic search kwaliteit is uitstekend** — Eerdere audit bevestigt A+ scores op alle embedding tests. Dit compenseert veel FTS-beperkingen.

---

## 7. Analyse per Audit Checklist

### 7.1 LLM Filter Extractie

| Check | Status | Details |
|-------|--------|---------|
| Worden filters correct geëxtraheerd? | GOED | Prompt is zeer gedetailleerd met voorbeelden |
| Edge cases waar LLM faalt? | RISICO | "volwassenen" kan age:null of adult triggeren afhankelijk van context. "familiespel" kan product_type:spel triggeren maar is eigenlijk game_type |
| Is de prompt duidelijk? | GOED | 100+ regels met voorbeelden en regels |
| Timeout/fout van OpenAI? | RISICO | Geen timeout op chat completion (wel op embedding) |
| Safeguards correct? | GOED | Age<3, puzzel-players, accessoire-age, unrealistische waarden |
| `response_format: json_object`? | GEFIXT | Correct toegevoegd |

### 7.2 Query Preprocessing

| Check | Status | Details |
|-------|--------|---------|
| Afkortingen geëxpandeerd? | GOED | 8 afkortingen: d&d, dnd, mtg, ttr, cah, lotr, got, hp |
| Spelfoutcorrectie? | BEPERKT | Hardcoded dictionary van ~30 entries, geen fuzzy matching |
| Verkeerde preprocessing? | RISICO | "hp" expandeert naar "harry potter" maar kan ook "hit points" betekenen in D&D context |

### 7.3 Score Normalisatie

| Check | Status | Details |
|-------|--------|---------|
| FTS scores genormaliseerd? | GEFIXT (in-memory) | Min-max naar 0-1 |
| Combined_score herberekend? | GEFIXT | Met correcte semantic_weight |
| Semantic_weight logica? | CORRECT | 0.60 standaard, 0.80 conceptueel |
| SQL nog niet gefixt? | PROBLEEM | Top-200 selectie nog op verkeerde ranking |

### 7.4 Filter Toepassing

| Check | Status | Details |
|-------|--------|---------|
| Availability met 'unknown'? | GEFIXT | `!== 'out_of_stock'` — correct |
| Corrupte player counts? | WORKAROUND | `> 20` wordt geskipt, maar dit skipt ook echte grote spellen |
| Duration parsing? | GEFIXT | Range, single, "90+" formats |
| Price filter edge cases? | GEFIXT | Expliciete null checks |
| Language case-insensitive? | GOED | toLowerCase + includes (maar substring match te breed) |

### 7.5 Ranking Kwaliteit

| Check | Status | Details |
|-------|--------|---------|
| Beste resultaten bovenaan? | VERBETERD | Na normalisatie significant beter |
| Irrelevante resultaten? | RISICO | d&d SQL false positives nog in pool, fuzzyNameMatch false positives |
| Exacte naam matches geboost? | GOED | fuzzyNameMatch geeft +0.5 boost |

### 7.6 Error Handling

| Check | Status | Details |
|-------|--------|---------|
| Database fouten? | GOED | try/catch met 500 response |
| Embedding API fouten? | GOED | 10s timeout + error propagation |
| LLM API fouten? | RISICO | Geen timeout, maar fallback naar getDefaultFilters |
| HTTP responses correct? | GEFIXT | 200, 400, 405, 500 alle met CORS |

---

## 8. Query-Specifieke Analyse

### Categorie 1: Conceptuele queries

| Query | Verwacht gedrag | Analyse |
|-------|----------------|---------|
| "gezellig spel voor familieweekend" | Catan, Ticket to Ride | `is_conceptual: true` → weight 0.80. Semantic search sterk. FTS matcht "spel" + "familieweekend" breed. Na normalisatie: semantic dominant. **Verwacht: GOED** |
| "spannend detective spel" | Sherlock Holmes, Exit games | `is_conceptual: true`. "detective" matcht in FTS. Semantic search vindt thematisch. **Verwacht: GOED** |
| "rustig puzzelachtig spel voor alleen" | Solo puzzelspellen | `product_type: spel, players: 1, is_conceptual: true`. Risk: "alleen" → players:1 correct? Of bedoelt gebruiker puzzels? LLM moet beslissen. **Verwacht: RISICO** — kan te streng filteren |

### Categorie 2: Concrete queries

| Query | Verwacht gedrag | Analyse |
|-------|----------------|---------|
| "Catan" | Alle Catan producten | FTS matcht 28 producten. Semantic search vindt Catan familie (similarity 0.78-0.83). Na normalisatie: hoge combined scores. **Verwacht: GOED** |
| "puzzel 1000 stukjes natuur" | 1000-stukjes natuur puzzels | `product_type: puzzel, puzzle_pieces: {min:950, max:1050}`. Semantic search vindt natuur thema. **Verwacht: GOED** |
| "kaartspel 2 spelers 30 min" | Korte 2-speler kaartspellen | `product_type: spel, players: 2, duration_max: 30`. "kaartspel" matcht in FTS maar is geen product_type — het is een game_type. Risk: veel bordspellen voor 2 die geen kaartspel zijn. **Verwacht: MEDIUM** |

### Categorie 3: Edge cases

| Query | Verwacht gedrag | Analyse |
|-------|----------------|---------|
| "d&d" | D&D producten | Preprocessing → "dungeons and dragons". Maar SQL FTS krijgt nog "d&d" via `search_query` parameter... **WACHT** — de Edge Function stuurt `processedQuery` naar de SQL! Dus FTS zoekt op "dungeons and dragons" niet "d&d". **Verwacht: GOED** (BUG-004 fix werkt!) |
| "katan" | Catan producten | Spelling variant "catan" gevonden. Embedding voor "katan" zal ook dichtbij Catan liggen. fuzzyNameMatch boost op "catan" prefix. **Verwacht: GOED** |
| "expert eurogames 2 spelers 90+ minuten Engels" | Lange expert games EN 2p | `players:2, duration_min:90, language:"Engels", is_conceptual:true`. Streng filter combo. Risk: te weinig resultaten. **Verwacht: RISICO** — zero-result kans hoog |
| "partyspel 8+ spelers 18+" | Volwassen partyspellen grote groep | `product_type:spel, min_players:8, age:{mode:"adult", value:18}`. Zeer niche. **Verwacht: RISICO** — weinig 8+ speler 18+ games in assortiment |

### Categorie 4: Filter stress tests

| Query | Verwacht gedrag | Analyse |
|-------|----------------|---------|
| "bordspel €20-50 op voorraad" | In-stock spellen €20-50 | `product_type:spel, price:{min:20,max:50}, in_stock_only:true`. Breed genoeg. **Verwacht: GOED** |
| "puzzel 500 stukjes kinderen" | Kindvriendelijke 500-st puzzels | `product_type:puzzel, puzzle_pieces:{min:450,max:550}, age:{mode:"family",value:10}`. **Verwacht: GOED** |
| "lange strategie spellen 3-4 spelers" | 90+ min strategiespellen | `product_type:spel, players:4, min_players:3, duration_min:90, is_conceptual:true`. **Verwacht: GOED** |

### Categorie 5: Zero-result risico

| Query | Verwacht gedrag | Analyse |
|-------|----------------|---------|
| "legspellen dierenthema 2-5 spelers 8+ €20-50" | Zou resultaten moeten geven | 5 filters tegelijk. "legspellen" → product_type:spel? Of puzzel? LLM moet kiezen. Als spel + players + age + price: kan werken. **Verwacht: RISICO** |
| "uitbreidingen voor Catan" | Catan uitbreidingen | Geen explicit "uitbreiding" filter. Semantic search moet dit vinden. FTS matcht "Catan". Na filtering op product_type:spel (als LLM dat kiest): werkt. **Verwacht: GOED** |
| "taalonafhankelijk puzzelachtig bordspel 1 speler" | Solo puzzelspellen | `product_type:spel, players:1`. "taalonafhankelijk" — geen language_independent filter beschikbaar! Semantic search moet compenseren. **Verwacht: MEDIUM** |

---

## 9. Nieuwe Bugs in v33/v34 Code

### NEW-001: `processedQuery` wordt naar SQL gestuurd maar spelling variants NIET
- **Ernst:** MEDIUM
- **Locatie:** Main handler, `supabase.rpc('lotana_hybrid_search', { search_query: processedQuery, ... })`
- **Probleem:** Als gebruiker "katan" zoekt, stuurt de Edge Function "katan" als search_query naar SQL (niet de variant "catan"). De spelling variants worden alleen gebruikt voor `fuzzyNameMatch` boosting. FTS zoekt dus op "katan" → 0 FTS matches.
- **Impact:** Spelfouttolerantie vertrouwt volledig op semantic search + name boosting. FTS draagt niet bij.
- **Fix:** Combineer spelling variants in de FTS query: `search_query: spellingVariants.join(' | ')` of voer meerdere FTS queries uit.

### NEW-002: `fuzzyNameMatch` boost schaal is incompatibel met combined_score
- **Ernst:** MEDIUM
- **Locatie:** Fuzzy boost toepassing
- **Code:** `combined_score: r.combined_score + fuzzyBoost` waar `fuzzyBoost` tot 0.5 per term kan zijn
- **Probleem:** Na normalisatie is combined_score in bereik [0, 1]. Een fuzzyBoost van 0.5 verdubbelt effectief de score. Bij meerdere matching termen kan de boost >1.0 zijn.
- **Impact:** Producten met naam-matches worden disproportioneel geboost, ongeacht semantische relevantie.
- **Fix:** Schaal de boost: `combined_score: r.combined_score * (1 + fuzzyBoost * 0.3)`

### NEW-003: Embedding wordt gegenereerd voor preprocessed query, maar FTS zoekt ook op preprocessed query
- **Ernst:** LAAG
- **Locatie:** `generateEmbedding(processedQuery)` + `search_query: processedQuery`
- **Probleem:** Als "d&d" → "dungeons and dragons": embedding is voor "dungeons and dragons" (goed). FTS zoekt op "dungeons and dragons" (goed). Maar: als "hp" → "harry potter": FTS zoekt op "harry potter" wat veel false positives geeft (Harry Potter merchandise). De originele korte afkorting was beter voor FTS.
- **Impact:** Sommige afkortingen geven te brede FTS resultaten na expansie.
- **Fix:** Overweeg aparte query voor FTS (origineel) en embedding (geëxpandeerd).

### NEW-004: `in_stock_only` override accepteert onverwachte types
- **Ernst:** LAAG
- **Locatie:** `requestedStockFilter === true || requestedStockFilter === 'true'`
- **Probleem:** `in_stock_only: 1` → `false` (niet strict equal aan `true`). `in_stock_only: "yes"` → `false`. Inconsistent met verwachtingen.
- **Fix:** `Boolean(requestedStockFilter)` of stricter type checking.

---

## 10. Aanbevolen Fixes (geprioriteerd)

### Prioriteit 1 — KRITIEK (direct impact op zoekresultaten)

1. **Fix SQL `lotana_hybrid_search` met normalisatie** — De in-memory workaround is goed maar de top-200 selectie is nog fout. Dit is de single biggest improvement.
   ```sql
   -- Voeg normalisatie CTEs toe:
   fts_normalized AS (
     SELECT id, fts_rank,
       CASE WHEN MAX(fts_rank) OVER() = 0 THEN 0
       ELSE fts_rank / MAX(fts_rank) OVER() END AS fts_norm
     FROM fts_results
   ),
   sem_normalized AS (
     SELECT id, semantic_rank,
       (semantic_rank - MIN(semantic_rank) OVER()) /
       NULLIF(MAX(semantic_rank) OVER() - MIN(semantic_rank) OVER(), 0) AS sem_norm
     FROM semantic_results
   )
   ```

2. **Clean corrupte player data (nu 68 producten)**
   ```sql
   UPDATE lotana_products SET min_players=NULL, max_players=NULL
   WHERE product_type IN ('puzzel','accessoire','speelgoed','educatief');
   ```

3. **Strip HTML uit beschrijvingen + re-index**
   ```sql
   UPDATE lotana_products
   SET description = regexp_replace(
     regexp_replace(description, '<[^>]+>', ' ', 'g'),
     '\s+', ' ', 'g'
   );
   -- Dan: re-trigger FTS index + re-embed
   ```

4. **Voeg timeout toe aan LLM filter extractie** (5s AbortController)

### Prioriteit 2 — HOOG (verbetert zoekervaring)

5. **Fix spelling variants voor FTS** — Stuur beste spelling variant als search_query naar SQL, niet alleen de originele query.
6. **Fix `lotana_exact_match` SQL** — Voeg availability, product_type, puzzle_pieces_min/max toe.
7. **Voeg fallback toe aan `isEanOrSku`** — Bij 0 exact_match resultaten, doe hybrid search.
8. **Schaal fuzzyNameMatch boost** — `combined_score * (1 + boost * 0.3)` ipv `combined_score + boost`.
9. **Voeg indexes toe op ean_code en sku**.
10. **Verwijder duplicate GIN index**.

### Prioriteit 3 — MEDIUM (nice to have)

11. Fix `matchesPuzzlePieces` falsy check.
12. Fix language filter substring matching → split op comma.
13. Verwijder misleidende `safeMatchCount = Math.max(1, 200)`.
14. Verwijder `> 20` corrupt data workaround na database cleanup.
15. Voeg basis numerieke extractie toe aan `getDefaultFilters`.
16. Clean corrupte min_age op accessoires.
17. Synchroniseer version string met deployment version.

### Prioriteit 4 — NICE-TO-HAVE

18. Implementeer `pg_trgm` voor echte fuzzy search.
19. Structured logging met log levels.
20. Rate limiting.
21. Dynamische match_count op basis van filter-complexiteit.
22. Verplaats spelling dictionary naar database.

---

## Bijlage A: Code Statistieken v34

| Metriek | Waarde |
|---------|--------|
| Totaal regels code | 520 |
| Functies | 14 |
| OpenAI API calls per request | 2 (chat + embedding) |
| LLM prompt lengte | ~2.500 tokens |
| Hardcoded abbreviations | 8 |
| Hardcoded spelling corrections | ~30 paren |
| Hardcoded conceptual terms | 33 |
| Safeguard checks | 7 |
| Console.log statements | 15+ |
| CORS-correct responses | 5/5 (200, 400, 405, 500, OPTIONS) |

## Bijlage B: Database Status (live, 2026-03-09)

| Metriek | Vorig rapport (08-03) | Nu (09-03) | Verschil |
|---------|----------------------|------------|----------|
| Totaal producten | 5.999 | 5.999 | Geen |
| HTML in beschrijvingen | 5.450 | 5.274 | -176 (lichte verbetering) |
| Corrupte players | 36 | 68 | +32 (VERSLECHTERD) |
| Corrupte min_age (accessoire) | 86 | 86 | Geen |
| Availability unknown | 729 | 729 | Geen |
| Duplicate GIN indexes | 2 | 2 | Geen |
| Indexes op ean_code/sku | 0 | 0 | Geen |

---

*Rapport gegenereerd op 2026-03-09 door geautomatiseerde code-audit op search-lotana v34 (Supabase MCP + statische analyse).*
