# Mixing Session Analysis Report

**Date:** 2025-12-26
**Session:** Preacher Vocal Processing
**Mixer:** XR18 @ 192.168.0.50

---

## Channel Analysis

### Channel 1: Preacher

**Recording:** `workdir/recordings/preacher_raw_ch1.wav`
**Spectrogram:** `preacher_ch1_spectrogram.png`

#### Raw Analysis Results

| Metric | Value | Assessment |
|--------|-------|------------|
| RMS Level | -40 dB | LOW - needs gain |
| Peak Level | -7.9 dB | OK |
| Dynamic Range | 42.1 dB | VERY WIDE - needs compression |
| SNR | 26.7 dB | Moderate |
| Noise Floor | -58.6 dB | Gate optional |
| Sibilance | 0.6% | None detected |

#### Frequency Balance (Raw)

| Band | Energy | Status |
|------|--------|--------|
| Sub-Bass (20-60Hz) | 0.9% | OK |
| Bass (60-250Hz) | **66.5%** | WAY TOO HIGH (proximity effect) |
| Low-Mid (250-500Hz) | **23.2%** | Muddy |
| Mid (500Hz-2kHz) | 8.8% | OK |
| High-Mid (2-4kHz) | **0.5%** | LACKING presence |
| Presence (4-6kHz) | **0.1%** | LACKING clarity |
| Brilliance (6-20kHz) | **0.1%** | LACKING air |

#### EQ Problems Detected

| Problem | Frequency | Severity | Action Taken |
|---------|-----------|----------|--------------|
| Proximity Effect | 60-250Hz | Severe | HPF 80Hz + cut 250Hz |
| Muddy | 250-500Hz | Moderate | Cut -4dB @ 250Hz, -2dB @ 500Hz |
| Lacking Presence | 2-4kHz | Severe | Boost +3dB @ 3kHz |
| Lacking Air | 6-20kHz | Moderate | Boost +2dB @ 8kHz |

---

## Applied Settings - Channel 1 (Preacher)

### Input Section
- **Name:** Preacher
- **Color:** Cyan
- **Gain:** 0.5 (normalized)
- **Pan:** Center

### High-Pass Filter
- **HPF On:** Yes
- **Frequency:** ~80Hz (0.256 normalized)

### EQ (4-Band Parametric)

| Band | Frequency | Gain | Q | Purpose |
|------|-----------|------|---|---------|
| 1 | 250 Hz | -4 dB | 2.0 | Cut mud/proximity |
| 2 | 500 Hz | -2 dB | 2.5 | Reduce boxiness |
| 3 | 3 kHz | +3 dB | 1.5 | Add presence/clarity |
| 4 | 8 kHz | +2 dB | 0.7 | Add air (shelf-like) |

### Noise Gate

| Parameter | Value |
|-----------|-------|
| On | Yes |
| Threshold | ~-40 dB (0.35 normalized) |
| Range | -20 dB (0.5 normalized) |
| Attack | 0.5 ms (fast) |
| Hold | 100 ms |
| Release | 200 ms |

### Dynamics (Compressor) - Greg Wells Natural Preset

**Preset:** #2 Greg Wells Natural - "Fat and loud, not choked"

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Mode | COMP | 0 |
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -35 dB | 0.417 |
| Ratio | 2.5:1 | 4 |
| Knee | Very Soft (5) | 1.0 |
| Attack | 25 ms (slow) | 0.208 |
| Release | 60 ms (fast) | 0.372 |
| Makeup Gain | +4 dB | 0.167 |
| Mix | 100% | 90 (integer!) |

**Key characteristics:**
- Slow attack (25ms) preserves natural transients - words "punch through"
- Fast release (60ms) provides immediate response
- Very soft knee for invisible compression
- RMS detection for smooth, musical response
- GR Target: 3-4 dB

**Research sources:** PureMix (Greg Wells 1176), Andrew Scheps, ProSoundWeb

### Sidechain Filter Configuration

**Spectrogram Analysis Results:**
- Male voice fundamental: **100-150 Hz**
- Primary energy band: **100-400 Hz** (66.5% in bass region)
- Speech harmonics extend to: **2-4 kHz**
- Spectral centroid: **155 Hz** (confirms bass-heavy voice)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Filter Type** | HPF (High-Pass) | Prevents low-frequency rumble from triggering compressor |
| **Frequency** | **150-200 Hz** | Above room noise, captures vocal fundamental & harmonics |
| **Why 150-200 Hz?** | Spectral centroid at 155 Hz indicates voice "center of mass" - HPF just below this ensures voice triggers compressor while rejecting rumble |

**Applied Sidechain Filter Settings (OSC):**

| OSC Address | Value | Actual Setting |
|-------------|-------|----------------|
| `/ch/01/dyn/filter/on` | 1 | **Enabled** |
| `/ch/01/dyn/filter/type` | 1 | **HPF (High-Pass)** |
| `/ch/01/dyn/filter/f` | 0.31 | **~170 Hz** |

*Frequency calculation: 20 × 10^(0.31 × 3) = 20 × 8.51 ≈ 170 Hz*

**Spectrogram Reference:** `workdir/visualizations/preacher_ch1_spectrogram.png`

### FX Configuration

| FX Slot | Type | Mode | Return Name | Route to LR |
|---------|------|------|-------------|-------------|
| FX2 | EXC (Exciter) | INSERT on Ch1 | Exciter | Yes @ 0dB |
| FX3 | ENH (Enhancer) | SEND from Ch1 | Enhancer | Yes @ 0dB |

---

## FX2 Configuration - Exciter (Aphex-Style)

**Effect Type:** EXC (Exciter) - Type 51
**Purpose:** Add harmonic excitement, clarity, and intelligibility
**Mode:** INSERT on Channel 1

### Parameter Settings

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| Tune | ~3500 Hz | 0.544 | Presence frequency for speech |
| Peak | 30% | 0.30 | Filter resonance |
| ZeroFill | 25% | 0.25 | Filter shape |
| Timbre | +15 | 0.65 | Even harmonics (warmer) |
| Harmonics | 30% | 0.30 | Amount of excitement |
| Mix | 50% | 0.50 | Blend with dry signal |
| Solo | OFF | 0 | Normal operation |

### OSC Commands

```
/fx/2/type 51
/fx/2/insert 1
/fx/2/par/01 0.544
/fx/2/par/02 0.30
/fx/2/par/03 0.25
/fx/2/par/04 0.65
/fx/2/par/05 0.30
/fx/2/par/06 0.50
/fx/2/par/07 0

/ch/01/insert/on 1
/ch/01/insert/sel 3

/rtn/2/config/name "Exciter"
/rtn/2/mix/on 1
/rtn/2/mix/lr 1
/rtn/2/mix/fader 0.75
```

---

## FX3 Configuration - Enhancer (SPL Vitalizer-Style)

**Effect Type:** ENH (Enhancer) - Type 49
**Purpose:** Add punch, clarity, and presence (Psycho EQ)
**Mode:** SEND from Channel 1

### Parameter Settings

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| OutGain | 0 dB | 0.50 | Unity output |
| Spread | 0% | 0.00 | Mono (for speech) |
| BassGain | 15% | 0.15 | Subtle bass punch |
| BassFreq | ~115 Hz | 0.286 | Low voice body |
| MidGain | 25% | 0.25 | Presence boost |
| MidQ | ~32 | 0.633 | Focused mid enhancement |
| HiGain | 18% | 0.18 | Air and clarity |
| HiFreq | ~10 kHz | 0.837 | High frequency sparkle |
| Solo | OFF | 0 | Normal operation |

### OSC Commands

```
/fx/3/type 49
/fx/3/par/01 0.50
/fx/3/par/02 0.00
/fx/3/par/03 0.15
/fx/3/par/04 0.286
/fx/3/par/05 0.25
/fx/3/par/06 0.633
/fx/3/par/07 0.18
/fx/3/par/08 0.837
/fx/3/par/09 0

/ch/01/mix/09/level 0.45
/ch/01/mix/09/tap 4

/rtn/3/config/name "Enhancer"
/rtn/3/mix/on 1
/rtn/3/mix/lr 1
/rtn/3/mix/fader 0.75
```

---

## Complete Signal Chain

```
Preacher Mic (Channel 1)
    │
    ▼
  Preamp (Gain 0.5)
    │
    ▼
  Gate (Threshold -40dB)
    │
    ▼
  ★ INSERT [EXCITER FX2] ★  ◄── Harmonic excitement
    │
    ▼
  EQ (Podcast Pro preset)
    │
    ▼
  Dynamics (Greg Wells Natural)
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
  Fader                              FX Send 3 (-12dB)
    │                                      │
    ▼                                      ▼
  Main LR  ◄─────────────────────  [ENHANCER FX3] Return (0dB)
```

### Research Sources

- [Aphex Aural Exciter](https://aphex.com/products/exciter)
- [SPL Vitalizer](https://spl.audio/en/spl-produkt/vitalizer-mk2-t/)
- [Behringer Wiki - Effect Descriptions](https://behringerwiki.musictribe.com/index.php?title=10._Effect_Descriptions)
- [The Broadcast Bridge - Voice Processing](https://www.thebroadcastbridge.com/content/entry/6476/the-changing-face-of-audio-processing-for-the-human-voice)

---

## Processing Rationale

### Why These EQ Choices?

1. **HPF at 80Hz** - Removes low-frequency rumble and handling noise without affecting vocal body
2. **-4dB @ 250Hz** - Aggressive cut to combat severe proximity effect (66.5% bass energy)
3. **-2dB @ 500Hz** - Reduces boxiness common in close-mic'd speech
4. **+3dB @ 3kHz** - Critical presence frequency for speech intelligibility
5. **+2dB @ 8kHz** - Adds air and clarity that was completely missing (0.1% in raw)

### Why This Compression? (Greg Wells Natural)

Based on professional research from PureMix, Gearspace, ProSoundWeb, and Sound on Sound:

- **59dB dynamic range** measured - compression essential
- **2.5:1 ratio** - Low ratio preserves natural dynamics while controlling levels
- **25ms attack (slow)** - Transients punch through, words have impact (Greg Wells philosophy)
- **60ms release (fast)** - Immediate response, "fat and loud" sound
- **-35dB threshold** - Calibrated to actual signal levels (RMS: -38dB, Peak: -9dB)
- **Very soft knee** - Invisible compression, no audible "pumping"
- **RMS detection** - Smooth, musical response suited for speech

**Alternative presets tested:**
1. Broadcast Standard (NPR/BBC) - 3:1, 12ms attack, 330ms release
2. **Greg Wells Natural** (SELECTED) - 2.5:1, 25ms attack, 60ms release
3. Church/Pastor Standard - 4:1, 8ms attack, 100ms release
4. LA-2A Opto Style - 5:1, 20ms attack, 120ms release
5. Scheps Parallel - 3:1, 20ms attack, 50ms release, 50-70% mix

---

## Session Notes

- Raw recording showed classic close-mic speech characteristics: heavy proximity effect, lacking high frequencies
- Subtractive EQ applied first (cut before boost principle)
- Presence and air boosts essential for intelligibility in a live mix
- Compressor essential due to 42dB dynamic range
- Light reverb send for subtle room ambiance

---

## Channel 5: GUITAR (Acoustic DI)

**Date Configured:** 2025-12-26
**Input Type:** DI/Pickup
**Role:** Lead acoustic guitar
**Genre:** Country/Christian worship

### Raw Analysis Results

| Metric | Value | Assessment |
|--------|-------|------------|
| RMS Level | -40.7 dB | LOW (before gain adjustment) |
| Peak Level | -8.4 dB | Good (after gain adjustment) |
| Dynamic Range | 20.9 dB | Consistent playing |
| Noise Floor | -29.2 dB | Acceptable |

### Frequency Balance (Raw - Before EQ)

| Band | Energy | Status |
|------|--------|--------|
| Sub-Bass (20-60Hz) | 4.1% | OK |
| Bass (60-250Hz) | **60.7%** | WAY TOO HIGH (typical DI) |
| Low-Mid (250-500Hz) | **25.2%** | Muddy |
| Mid (500Hz-2kHz) | 8.7% | Low |
| High-Mid (2-4kHz) | **0.8%** | LACKING presence |
| Presence (4-6kHz) | **0.2%** | LACKING clarity |
| Brilliance (6-20kHz) | **0.3%** | LACKING sparkle |

**Diagnosis:** Classic DI acoustic guitar - heavy on bass, lacking sparkle and presence. Typical of piezo pickups.

---

## Applied Settings - Channel 5 (GUITAR)

### Input Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Name | GUITAR | `/ch/05/config/name "GUITAR"` |
| Color | Yellow | `/ch/05/config/color 5` |
| HPF | ON @ 80Hz | `hpon=1, hpf=0.463` |
| Gain | 0.5 | `/ch/05/preamp/trim 0.5` |
| Peak Level | -8.4 dBFS | Target: -12 to -10 |

### Gate Section

| Parameter | Value | Reason |
|-----------|-------|--------|
| Gate | **OFF** | No audible noise, preserve dynamics |

### EQ Section (4-Band Parametric)

| Band | Frequency | Gain | Q | Purpose | OSC Values |
|------|-----------|------|---|---------|------------|
| 1 | 300 Hz | -3 dB | 2.0 | Cut mud/boom | f=0.392, g=0.400, q=0.175 |
| 2 | 5 kHz | +1 dB | 2.0 | Pick attack | f=0.800, g=0.533, q=0.175 |
| 3 | 3 kHz | +5 dB | 1.5 | Presence | f=0.725, g=0.667, q=0.124 |
| 4 | 10 kHz | +3 dB | HiShelf | Air/sparkle | f=0.900, g=0.600, type=4 |

### OSC Commands - EQ

```
/ch/05/eq/on 1
/ch/05/eq/1/f 0.392
/ch/05/eq/1/g 0.400
/ch/05/eq/1/q 0.175
/ch/05/eq/2/f 0.800
/ch/05/eq/2/g 0.533
/ch/05/eq/2/q 0.175
/ch/05/eq/3/f 0.725
/ch/05/eq/3/g 0.667
/ch/05/eq/3/q 0.124
/ch/05/eq/4/type 4
/ch/05/eq/4/f 0.900
/ch/05/eq/4/g 0.600
```

### Dynamics (Compressor)

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Threshold | -18 dB | 0.70 |
| Ratio | 3:1 | 0.36 |
| Attack | 20 ms | 0.167 |
| Release | 100 ms | 0.024 |
| Knee | Medium | 0.5 |
| Makeup Gain | +3 dB | 0.125 |

**Rationale:**
- Light ratio (3:1) preserves natural dynamics
- Slow attack (20ms) preserves pick transients
- Fast release (100ms) for natural recovery
- Target GR: 2-4 dB

### OSC Commands - Compressor

```
/ch/05/dyn/on 1
/ch/05/dyn/thr 0.70
/ch/05/dyn/ratio 0.36
/ch/05/dyn/attack 0.167
/ch/05/dyn/release 0.024
/ch/05/dyn/knee 0.5
/ch/05/dyn/mgain 0.125
```

### FX Send Configuration

| Destination | Send Level | Tap Point | OSC |
|-------------|------------|-----------|-----|
| FX1 (GTR VERB) | -30 dB | Post-fader | `mix/07/level=0.30, mix/07/tap=4` |

### FX1 - Plate Reverb Settings

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Type | PLAT (5) | `/fx/1/type 5` |
| Pre-Delay | 30 ms | 0.15 |
| Decay | ~1.0 s | 0.24 |
| Size | 50 | 0.49 |
| Damping | ~5.7 kHz | 0.58 |
| Diffusion | 24 | 0.79 |
| Level | 0 dB | 0.50 |

### OSC Commands - FX1

```
/fx/1/type 5
/fx/1/par/01 0.15
/fx/1/par/02 0.24
/fx/1/par/03 0.49
/fx/1/par/04 0.58
/fx/1/par/05 0.79
/fx/1/par/06 0.50

/fxsend/1/config/name "GTR VERB"
/rtn/1/config/name "GTR VERB"
/rtn/1/mix/on 1
/rtn/1/mix/fader 0.75
```

### Main/Pan Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Fader | 0 dB (unity) | `/ch/05/mix/fader 0.75` |
| Pan | Center | `/ch/05/mix/pan 0.5` |
| Route to LR | ON | `/ch/05/mix/lr 1` |
| Channel On | Yes | `/ch/05/mix/on 1` |

---

## Channel 5 Signal Chain

```
Acoustic Guitar DI (Channel 5)
    │
    ▼
  Preamp (Gain 0.5, HPF 80Hz)
    │
    ▼
  Gate (OFF - not needed)
    │
    ▼
  EQ (Cut 300Hz, Boost 3kHz/5kHz/10kHz)
    │
    ▼
  Dynamics (3:1, -18dB threshold)
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
  Fader (0dB)                        FX Send 7 (-30dB)
    │                                      │
    ▼                                      ▼
  Main LR (Center)  ◄────────────  [PLATE REVERB FX1] Return
```

---

## Processing Rationale - Acoustic Guitar

### Why These EQ Choices?

1. **HPF at 80Hz** - DI acoustic doesn't need sub-bass, removes rumble
2. **-3dB @ 300Hz** - Cuts the muddy/boomy character of piezo pickups
3. **+1dB @ 5kHz** - Adds pick attack definition
4. **+5dB @ 3kHz** - Critical presence boost for acoustic to cut through mix
5. **+3dB @ 10kHz shelf** - Adds the "air" and shimmer that DI pickups lack

### Why This Compression?

- **3:1 ratio** - Light control without squashing dynamics
- **-18dB threshold** - Only catches louder strums
- **20ms attack** - Preserves the pick transient (slower = more punch)
- **100ms release** - Natural recovery between strums

### Why Plate Reverb?

- Classic choice for acoustic instruments
- Smooth, warm character
- 1.0s decay keeps clarity without washing out
- 30ms pre-delay separates dry sound from reverb
- -30dB send level = subtle, adds space without dominating

---

## Channel 2: MIH (Female Backing Vocal)

**Date Configured:** 2025-12-26
**Input Type:** Vocal Microphone
**Role:** Backing Vocalist (close to lead vocalist/guitarist)
**Strategy:** Supportive - sits behind lead vocal

### Raw Analysis Results

**Recording:** `workdir/recordings/mih_raw_ch2.wav`
**Spectrogram:** `workdir/visualizations/mih_ch2_spectrogram.png`

| Metric | Value | Assessment |
|--------|-------|------------|
| RMS Level | -37.9 dB | LOW - gain increased |
| Peak Level | -16.6 dB | OK |
| Dynamic Range | 8.3 dB | Good control |
| Sibilance | None | Clean |

### Frequency Balance (Raw)

| Band | Energy | Status |
|------|--------|--------|
| Sub-Bass (20-60Hz) | 0.0% | OK |
| Bass (60-250Hz) | **52.2%** | HIGH (proximity) |
| Low-Mid (250-500Hz) | **33.6%** | MUDDY |
| Mid (500Hz-2kHz) | 12.4% | OK |
| High-Mid (2-4kHz) | **1.5%** | LACKING |
| Presence (4-6kHz) | **0.2%** | LACKING |
| Brilliance (6-20kHz) | **0.2%** | LACKING |

---

## Applied Settings - Channel 2 (MIH)

### Input Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Name | MIH | `/ch/02/config/name "MIH"` |
| Color | Magenta | `/ch/02/config/color 6` |
| HPF | ON @ 120Hz | `hpon=1, hpf=0.26` |
| Gain | 0.7 | `/ch/02/preamp/trim 0.7` |

**Note:** HPF at 120Hz (higher than lead's 80Hz) reserves low-end for lead vocal.

### Gate Section

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| On | Yes | 1 | Clean up when not singing |
| Threshold | -40 dB | 0.5 | Opens easily |
| Range | -15 dB | 0.21 | Gentle reduction |
| Attack | 0.5 ms | 0.004 | Fast open |
| Hold | 150 ms | 0.075 | Holds between phrases |
| Release | 250 ms | 0.061 | Natural fade |

**Gate Sidechain Filter:**

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| On | Yes | 1 | Focus on voice |
| Type | HPF (LC12) | 1 | High-pass |
| Frequency | ~220 Hz | 0.347 | Female voice fundamental |

### EQ Section (4-Band Parametric)

| Band | Type | Frequency | Gain | Q | Purpose | OSC Values |
|------|------|-----------|------|---|---------|------------|
| 1 | PEQ | 300 Hz | -3 dB | 2.0 | Cut mud | f=0.392, g=0.400, q=0.175 |
| 2 | PEQ | 800 Hz | +1 dB | 1.5 | Warmth | f=0.534, g=0.533, q=0.124 |
| 3 | PEQ | 3 kHz | +1 dB | 1.5 | Light presence | f=0.725, g=0.533, q=0.124 |
| 4 | **LPF** | 6 kHz | - | - | Roll off highs | f=0.826, type=5 |

**Backing Vocal EQ Strategy:**
- Less presence boost than lead (+1dB vs +3dB)
- LPF at 6kHz reserves brightness for lead vocal
- Higher HPF (120Hz vs 80Hz) reserves low-end for lead

### Dynamics (Compressor)

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Mode | COMP | 0 |
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -22 dB | 0.633 |
| Ratio | 3:1 | 4 |
| Knee | Soft | 0.6 |
| Attack | 15 ms | 0.125 |
| Release | 100 ms | 0.024 |
| Makeup Gain | +2 dB | 0.083 |
| Mix | 100% | 100 |

**Compressor Sidechain Filter:**

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Type | HPF (LC12) | 1 |
| Frequency | ~220 Hz | 0.347 |

### FX Send Configuration

| Destination | Send Level | Tap Point | OSC |
|-------------|------------|-----------|-----|
| FX4 (BV HALL) | -10 dB | Post-fader | `mix/10/level=0.5, mix/10/tap=4` |

### Main/Pan Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Fader | 0 dB (unity) | `/ch/02/mix/fader 0.75` |
| Pan | **L50** | `/ch/02/mix/pan 0.25` |
| Route to LR | ON | `/ch/02/mix/lr 1` |
| Channel On | Yes | `/ch/02/mix/on 1` |

---

## FX4 Configuration - BV HALL (Backing Vocal Hall Reverb)

**Effect Type:** HALL (8)
**Purpose:** Push backing vocals back in mix with long, diffuse reverb
**Mode:** SEND from backing vocal channels

### Parameter Settings

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| Pre-Delay | ~40 ms | 0.2 | Separation from dry |
| Decay | ~2.2 s | 0.45 | Long decay pushes back |
| Size | 60% | 0.6 | Large hall |
| Damping | Medium | 0.5 | Natural decay |
| Diffusion | 70% | 0.7 | Smooth tail |
| Level | 0 dB | 0.5 | Unity |

### OSC Commands

```
/fx/4/type 8
/fx/4/par/01 0.2
/fx/4/par/02 0.45
/fx/4/par/03 0.6
/fx/4/par/04 0.5
/fx/4/par/05 0.7
/fx/4/par/06 0.5

/rtn/4/config/name "BV HALL"
/rtn/4/mix/on 1
/rtn/4/mix/fader 0.75
```

---

## Channel 2 Signal Chain

```
MIH Vocal Mic (Channel 2)
    │
    ▼
  Preamp (Gain 0.7, HPF 120Hz)
    │
    ▼
  Gate (Threshold -40dB, Range -15dB)
   [Sidechain HPF @ 220Hz]
    │
    ▼
  EQ (Cut 300Hz, Boost 800Hz/3kHz, LPF 6kHz)
    │
    ▼
  Dynamics (3:1, -22dB threshold)
   [Sidechain HPF @ 220Hz]
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
  Fader (0dB)                        FX Send 10 (-10dB)
    │                                      │
    ▼                                      ▼
  Main LR (Pan L50)  ◄────────────  [HALL REVERB FX4] Return
```

---

## Processing Rationale - Backing Vocal (MIH)

### Backing Vocal Philosophy

The goal is to make MIH **supportive** rather than competing with the lead vocalist:

1. **Higher HPF (120Hz)** - Reserves low-end body for lead
2. **Less presence boost (+1dB vs +3dB)** - Lead vocal stays forward
3. **LPF at 6kHz** - Reserves brightness/air for lead
4. **Pan L50** - Creates stereo width, leaves center for lead
5. **Hall reverb (longer decay)** - Pushes her back in the mix vs lead's drier sound

### Why Hall Reverb for Backing Vocals?

- **Longer decay (2.2s)** naturally places vocals further back
- **Hall character** is more diffuse than plate, adds depth
- **Shared FX4** can be used by all backing vocalists
- Contrasts with guitar's plate reverb (different character)

---

## Channel 3: TIBI (Male Backing Vocal)

**Date Configured:** 2025-12-26
**Input Type:** Vocal Microphone
**Role:** Backing Vocalist (far right position)
**Strategy:** Supportive - sits behind lead vocal, sings quietly

### Raw Analysis Results

**Recording:** `workdir/recordings/tibi_ch03_analysis.wav`
**Spectrogram:** `tibi_ch03_spectrogram.png`

| Metric | Value | Assessment |
|--------|-------|------------|
| RMS Level | -38.9 dB | LOW - quiet singer |
| Peak Level | -16.1 dB | OK |
| Dynamic Range | 10.7 dB | Good, compression optional |
| Sibilance | None | Clean |

### Frequency Balance (Raw)

| Band | Energy | Status |
|------|--------|--------|
| Sub-Bass (20-60Hz) | 0.3% | OK |
| Bass (60-250Hz) | **74.5%** | WAY TOO HIGH |
| Low-Mid (250-500Hz) | 15.8% | Muddy |
| Mid (500Hz-2kHz) | 8.3% | LOW |
| High-Mid (2-4kHz) | 0.7% | LACKING |
| Presence (4-6kHz) | 0.1% | LACKING |
| Brilliance (6-20kHz) | 0.2% | LACKING |

**Diagnosis:** Extremely bass-heavy male voice lacking clarity and presence. Needs HPF and presence boost to cut through.

---

## Applied Settings - Channel 3 (TIBI)

### Input Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Name | TIBI | `/ch/03/config/name "TIBI"` |
| HPF | ON @ 150Hz | `hpon=1, hpf=0.342` |
| Polarity | Inverted | `invert=1` |
| Fader | -2.8 dB | `/ch/03/mix/fader 0.65` |

**Note:** HPF at 150Hz (higher than lead) for backing vocal - reserves low-end for lead.

### Gate Section

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| On | Yes | 1 | Clean up when not singing |
| Threshold | -45 dB | 0.4375 | Low for quiet singer |
| Range | -20 dB | 0.298 | Gentle reduction |
| Attack | 0.5 ms | 0.004 | Fast open |
| Hold | 150 ms | 0.075 | Holds between phrases |
| Release | 250 ms | 0.061 | Natural fade |

**Gate Sidechain Filter:**

| Parameter | Value | OSC Value | Purpose |
|-----------|-------|-----------|---------|
| On | Yes | 1 | Focus on voice |
| Type | HPF (LC12) | 1 | High-pass |
| Frequency | ~180 Hz | 0.317 | Male voice fundamental |

### EQ Section (4-Band Parametric)

| Band | Type | Frequency | Gain | Q | Purpose | OSC Values |
|------|------|-----------|------|---|---------|------------|
| 1 | PEQ | 300 Hz | -3 dB | 2.0 | Cut mud | f=0.392, g=0.400, q=0.175 |
| 2 | PEQ | 2 kHz | +2 dB | 1.5 | Clarity | f=0.667, g=0.567, q=0.124 |
| 3 | PEQ | 6 kHz | +1 dB | 1.0 | Presence | f=0.826, g=0.533, q=0.072 |
| 4 | **HiShelf** | 10 kHz | -2 dB | Wide | Roll off (behind lead) | f=0.900, g=0.433, type=4 |

**Backing Vocal EQ Strategy:**
- Less presence boost than lead (+2dB vs +3dB)
- High shelf rolloff at 10kHz reserves brightness for lead vocal
- Higher HPF (150Hz) reserves low-end for lead

### Dynamics (Compressor)

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Mode | COMP | 0 |
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -28 dB | 0.533 |
| Ratio | 4:1 | 0.45 |
| Knee | Soft | 0.6 |
| Attack | 15 ms | 0.125 |
| Release | 100 ms | 0.024 |
| Makeup Gain | +4 dB | 0.167 |
| Mix | 100% | 100 |

**Compressor Sidechain Filter:**

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| On | Yes | 1 |
| Type | HPF (LC12) | 1 |
| Frequency | ~180 Hz | 0.317 |

**Rationale:**
- 4:1 ratio for backing vocal (more controlled than lead)
- Higher makeup gain (+4dB) compensates for quiet singing
- RMS detection for smooth, musical compression

### Main/Pan Section

| Parameter | Value | OSC |
|-----------|-------|-----|
| Fader | -2.8 dB | `/ch/03/mix/fader 0.65` |
| Pan | **R100 (Far Right)** | `/ch/03/mix/pan 1.0` |

---

## Channel 3 Signal Chain

```
TIBI Vocal Mic (Channel 3)
    │
    ▼
  Preamp (HPF 150Hz, Polarity Inverted)
    │
    ▼
  EQ (Cut 300Hz, Boost 2kHz/6kHz, HiShelf rolloff 10kHz)
    │
    ▼
  Fader (-2.8dB boosted for quiet singer)
    │
    ▼
  Main LR (Pan R100 - Far Right)
```

---

## Processing Rationale - Backing Vocal (TIBI)

### Why These Choices?

1. **HPF at 150Hz** - Male backing doesn't need low-end, reserves body for lead
2. **-3dB @ 300Hz** - Cuts the massive mud buildup (74.5% bass energy!)
3. **+2dB @ 2kHz** - Adds clarity for intelligibility
4. **+1dB @ 6kHz** - Light presence to help voice cut through
5. **-2dB HiShelf @ 10kHz** - Rolls off highs to keep him behind lead vocal
6. **Fader boost (-2.8dB)** - Compensates for quiet singing style
7. **Pan R100** - Far right position as specified

### Backing Vocal Arrangement

| Vocalist | Channel | Pan | Position |
|----------|---------|-----|----------|
| Flori | ? | Far Left | L100 |
| Mihaela | ? | Left | L50? |
| Claudiu | ? | Near Tibi | R50? |
| **TIBI** | **3** | **Far Right** | **R100** |

---

*Analysis generated by Claude Code with XM32-MCP*
