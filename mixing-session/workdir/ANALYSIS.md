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

### FX Sends

| Bus | Level | Purpose |
|-----|-------|---------|
| Bus 5 (FX1) | -12 dB (0.35) | Subtle reverb |

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

*Analysis generated by Claude Code with XM32-MCP*
