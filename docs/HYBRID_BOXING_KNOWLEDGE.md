# Fight AI — Hybrid Boxing Knowledge Base

Version: `2026.09.04-v2`

## Purpose

Fight AI uses a hybrid knowledge layer to make video analysis more consistent without replacing direct observation. The database does **not** diagnose the athlete by itself. It provides candidate principles that Gemini must validate against visible evidence in the sparring video.

The reasoning order is:

`visible observation -> recurring pattern -> supported biomechanical/coaching hypothesis -> consequence -> correction -> drill -> timestamp`

If the video contradicts the knowledge base, the video wins.

## Source policy

Two source classes are accepted:

1. **Official coaching standards** — recognized boxing governing bodies and national coach-education systems. These define coachable fundamentals, teaching progressions and tactical concepts.
2. **Peer-reviewed academic / institute research** — biomechanics, kinetics and systematic reviews. These can support hypotheses about balance, kinetic-chain contribution and punch mechanics, but are never used to invent athlete-specific force, velocity, accuracy or other metrics that Fight AI did not measure.

National styles are not treated as scientific facts. Fight AI must not diagnose a boxer as “Mexican style”, “Russian style”, “Cuban style”, etc. unless the user explicitly uses such a term descriptively; even then, the report should state the actual visible behaviors instead of relying on stereotypes.

## Verified core sources

### Official coaching

- **International Boxing Association (IBA) Coaches Manual**  
  https://www.iba.sport/documents/iba-coach-manual/  
  Standardized reference covering technique, tactics, training organization and physical preparation.

- **England Boxing Level 1 Coaching Handbook**  
  https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf  
  Governing-body coach handbook used for basic boxing skills and technical progression.

- **USA Boxing Education**  
  https://www.usaboxing.org/usa-boxing-launches-team-usa-mobile-coach-app  
  USA Boxing describes trusted education resources covering fundamentals, advanced strategy and match review.

### Peer-reviewed / university and high-performance research

- **Dinu & Louis (2020), INSEP + Liverpool John Moores University**  
  https://pubmed.ncbi.nlm.nih.gov/33345181/  
  Comparison of junior and elite/potential Olympic medalist boxers using IMUs; relevant to segment synchronization, force, velocity and stability.

- **Biomechanics of the lead straight punch (2022)**  
  https://pubmed.ncbi.nlm.nih.gov/36589432/  
  Uses Vicon motion capture and Kistler force platforms; supports lower-extremity contribution and lead-straight punch mechanics.

- **Force and velocity of impact during upper-limb strikes — systematic review/meta-analysis (2020)**  
  https://pubmed.ncbi.nlm.nih.gov/32677587/  
  Used only for general mechanical context; never to assign unmeasured punch values to a Fight AI user.

- **Wearable sensor analysis of punch acceleration and plantar pressure (2026)**  
  https://pubmed.ncbi.nlm.nih.gov/42122430/  
  Collegiate boxer study relating plantar loading and punch acceleration; relevant to kinetic-chain hypotheses.

## Current knowledge domains

- stance / posture
- guard recovery
- footwork
- distance and range
- balance
- kinetic chain
- entry mechanics
- exits and pivots
- defence and countering
- feints
- tactical adaptation
- short-range space management
- body attack

## Guardrails

- Never fabricate force, speed, accuracy, punch count or percentages.
- Never claim an academic study proves a specific flaw in a user video; it only supports the biomechanical hypothesis after the flaw is visually observed.
- Do not copy long source passages into prompts or reports. Store concise derived principles only.
- Prefer repeated visible patterns over isolated moments.
- Do not force every knowledge-base item into every report.
- Maintain fighter identity before applying any correction.

## Next expansion candidates

Future versions can add verified material on fatigue, energy systems, injury-risk-aware coaching, scoring/tactical decision-making and kickboxing-specific sources. Kickboxing should have its own evidence set rather than inheriting boxing-only principles blindly.
