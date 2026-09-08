# Fight AI — Boxing Program Catalog

Version: `2026.09.07-v1`

## Purpose

The institutional catalog records verified official profiles for university research programs, governing-body coach education, high-performance pathways and established boxing academies. It complements the technical knowledge base; it does not replace it.

Inclusion means that Fight AI verified the institution or program through its official website on the date stored in the catalog. Inclusion is **not** a ranking, partnership, accreditation, endorsement or claim that Fight AI reproduces that institution's methods.

## Evidence boundary

The catalog has four evidence tiers:

1. `peer_reviewed_research_context` identifies a university or institute connected to relevant published research. Scientific claims must still cite the linked study, not the institution's reputation.
2. `official_curriculum` describes an official governing-body coach-education system.
3. `official_program_profile` describes an officially documented performance or athlete-development pathway.
4. `institutional_profile_only` records an academy's own history and training role. This material is contextual and promotional, not scientific evidence.

The video remains the authority for every athlete-specific observation. A program name cannot prove a technical fault, fatigue, ability, style, competitive level or future potential.

## Catalog schema

Each entry in `lib/boxingProgramCatalog.ts` contains:

- stable `id`, display `name`, `kind`, country and official URL;
- `verifiedAt` date and `evidenceTier`;
- relevant technical domains;
- a narrowly written documented role and allowed prompt use;
- explicit limitations;
- links to technical knowledge entries and verified source IDs when applicable;
- retrieval terms used to keep prompt context small and relevant.

## Included institutions and programs

### Research and high-performance context

- Liverpool John Moores University — Research Institute for Sport and Exercise Sciences  
  https://www.ljmu.ac.uk/research/centres-and-institutes/research-institute-for-sport-and-exercise-sciences
- Edge Hill University — Physical Performance Profiling of Combat Sports  
  https://www.edgehill.ac.uk/departments/academic/sport/research/spep-research-group/physical-performance-profiling-of-combat-sports/
- INSEP — Institut national du sport, de l’expertise et de la performance  
  https://www.insep.fr/en
- GB Boxing — World Class Programme  
  https://gbboxing.org.uk/how-to-be-a-gb-boxer/

### Official coach education

- USA Boxing — Coach Education  
  https://www.usaboxing.org/coach
- England Boxing — Coach Education  
  https://www.englandboxing.org/coach-education/

### Academy profiles

- Gleason's Gym  
  https://www.gleasonsgym.com/
- Wild Card Boxing Club  
  https://wildcardboxing.com/pages/about-us

Academy profiles are deliberately excluded from automatic technical provenance. They enter prompt context only when a user explicitly asks about an academy, gym or training environment.

## Prompt integration

`boxingKnowledgePrompt()` retrieves technical principles first. It then asks the program catalog for at most three related institutions. The resulting block is compact and contains the evidence tier, documented role, allowed use and an explicit no-ranking/no-endorsement guardrail.

Programs without links to selected technical principles are not injected automatically. This prevents famous gym names from biasing an ordinary sparring diagnosis.

## Maintenance rules

- Verify every URL against the institution's official domain before adding or refreshing an entry.
- Store the verification date and increment `BOXING_PROGRAM_CATALOG_VERSION` when entries or semantics change.
- Keep technical-source versioning separate from catalog versioning.
- Do not convert marketing language, championship associations or alumni lists into technical evidence.
- Do not create national-style stereotypes.
- Do not claim certification, affiliation or endorsement.
- Remove or quarantine an entry if its official provenance can no longer be verified.
