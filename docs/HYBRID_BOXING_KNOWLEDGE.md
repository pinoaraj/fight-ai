# Fight AI — Hybrid Boxing Knowledge Base

Version: `2026.09.04-v3`

## Purpose

Fight AI uses a hybrid knowledge layer to make video analysis more consistent without replacing direct observation. The database does **not** diagnose the athlete by itself. It provides candidate principles that Gemini must validate against visible evidence in the sparring video.

The reasoning order is:

`visible observation -> recurring pattern -> supported biomechanical/coaching hypothesis -> consequence -> correction -> drill -> timestamp`

If the video contradicts the knowledge base, the video wins.

## Source policy

Three source classes are accepted:

1. **Official coaching standards** — recognized boxing governing bodies and coach-education systems. These define coachable fundamentals, teaching progressions and tactical concepts.
2. **Official competition/judging rules** — used only to explain tactical value and scoring concepts such as clean scoring blows, technical/tactical superiority, effective aggression and ring control. They do not authorize Fight AI to fabricate a round winner.
3. **Peer-reviewed academic / institute research** — biomechanics, kinetics, physiology, fatigue and systematic reviews. These support hypotheses but never create athlete-specific measurements Fight AI did not actually obtain.

National styles are not treated as scientific facts. Fight AI must not diagnose a boxer as “Mexican style”, “Russian style”, “Cuban style”, etc. The report should describe the actual visible behaviors instead of relying on stereotypes.

## Verified core sources

### Official coaching and rules

- **International Boxing Association (IBA) Coaches Manual**  
  https://www.iba.sport/documents/iba-coach-manual/  
  Standardized reference covering technique, tactics, training organization and physical preparation.

- **England Boxing Level 1 Coaching Handbook**  
  https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf  
  Governing-body coach handbook used for basic boxing skills and technical progression.

- **USA Boxing Education**  
  https://www.usaboxing.org/usa-boxing-launches-team-usa-mobile-coach-app  
  USA Boxing education material covering fundamentals, advanced strategy and match review.

- **World Boxing Competition Rules — Judging a Bout**  
  https://worldboxing.org/wp-content/uploads/2024/11/World-Boxing-Competition-Rules-Nov-2024-Approved.pdf  
  Used for scoring logic: scoring blows are the primary criterion, followed by technical/tactical superiority and competitiveness. Forward movement by itself is not automatically effective aggression.

### Peer-reviewed / university and high-performance research

- **Dinu & Louis (2020), INSEP + Liverpool John Moores University**  
  https://pubmed.ncbi.nlm.nih.gov/33345181/  
  Comparison of junior and elite/potential Olympic medalist boxers using IMUs; relevant to segment synchronization, force, velocity and stability.

- **Biomechanics of the lead straight punch (2022)**  
  https://pubmed.ncbi.nlm.nih.gov/36589432/  
  Uses 3D motion capture and force platforms; supports lower-extremity contribution and lead-straight punch mechanics.

- **Force and velocity of impact during upper-limb strikes — systematic review/meta-analysis (2020)**  
  https://pubmed.ncbi.nlm.nih.gov/32677587/  
  Used only for general mechanical context; never to assign unmeasured punch values to a Fight AI user.

- **Acute physiological responses associated with amateur boxing — systematic review/meta-analysis, Edge Hill University (2022/2023)**  
  https://pubmed.ncbi.nlm.nih.gov/35380916/  
  Synthesizes 25 studies. Supports the high physiological demand of boxing while warning against assuming that sport-specific performance always deteriorates after activity.

- **Effect of fatiguing lower-body exercise on punch forces in highly-trained boxers (2021)**  
  https://pubmed.ncbi.nlm.nih.gov/33858296/  
  Supports the role of lower-body/trunk force in punch production and the possibility of fatigue-related mechanical decline.

- **Lower-limb kinetics and fatigue in boxing — Ningbo University, University of the West of Scotland, Hong Kong Baptist University et al. (2025)**  
  https://pubmed.ncbi.nlm.nih.gov/41463652/  
  Force-platform work showing fatigue-related punch-force changes and substantial punch-to-punch / athlete variability.

- **Wearable sensor analysis of punch acceleration and plantar pressure (2026)**  
  https://pubmed.ncbi.nlm.nih.gov/42122430/  
  Collegiate boxer study relating plantar loading and punch acceleration; relevant to kinetic-chain hypotheses.

## Current knowledge domains

- stance / posture
- guard recovery
- footwork
- distance and range
- balance and kinetic chain
- entry mechanics
- exits and pivots
- defence and countering
- feints
- tactical adaptation
- short-range space management
- body attack
- ringcraft / ring control
- effective pressure
- scoring-quality concepts
- visible fatigue / late-round technical deterioration

## Important scoring guardrail

Fight AI may say that a behavior has **higher or lower scoring value** when that conclusion is supported by visible evidence. For example, pressure that repeatedly ends in clean scoring blows, defensive control and ring-position advantage can be described as effective pressure.

Fight AI must **not** declare that an athlete won a round merely because they advanced more, threw more, or appeared busier. A round-winner judgment requires sufficient observable evidence and must remain separate from fabricated punch counts or statistics.

## Fatigue guardrail

Clock time is not proof of fatigue. A mistake at 02:30 is not automatically caused by conditioning.

A fatigue hypothesis is allowed only when the video shows a repeated temporal deterioration, such as progressively slower guard recovery, worsening posture, loss of base, or a clear decline in the same technique compared with earlier repetitions. The report should phrase this as a supported hypothesis, not a measured physiological diagnosis.

## General guardrails

- Never fabricate force, speed, accuracy, punch count, percentages, heart rate, fatigue score or energy expenditure.
- Never claim an academic study proves a specific flaw in a user video; it supports a hypothesis only after the relevant cue is visually observed.
- Do not copy long source passages into prompts or reports. Store concise derived principles only.
- Prefer repeated visible patterns over isolated moments.
- Do not force every knowledge-base item into every report.
- Maintain fighter identity before applying any correction.
- Boxing-only evidence must not be blindly transferred to kickboxing.

## Next expansion candidates

Future versions should add a separate kickboxing evidence set and can expand boxing-specific material on defensive decision trees, southpaw/orthodox interactions, competition pacing and injury-risk-aware coaching, provided each principle has verified provenance.
