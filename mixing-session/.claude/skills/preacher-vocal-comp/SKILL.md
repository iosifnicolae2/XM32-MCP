---
name: preacher-vocal-comp
description: Configure professional compression for preacher/speech vocals on XR18/X32 mixers. Use when setting up dynamics control for sermons, speeches, or voice-over.
---

# Preacher Vocal Compression Configuration

Professional compressor settings for speech/sermon delivery on Behringer XR18/X32 digital mixers.

## Quick Start - Recommended Preset

**#2 Greg Wells Natural** - Fat, present, not choked:

| Parameter | Value | OSC Address | OSC Value |
|-----------|-------|-------------|-----------|
| Mode | COMP | `/ch/01/dyn/mode` | 0 |
| Detection | RMS | `/ch/01/dyn/det` | 1 |
| Envelope | LOG | `/ch/01/dyn/env` | 1 |
| Threshold | -35 dB | `/ch/01/dyn/thr` | 0.417 |
| Ratio | 2.5:1 | `/ch/01/dyn/ratio` | 4 |
| Knee | Very Soft (5) | `/ch/01/dyn/knee` | 1 |
| Attack | 25 ms | `/ch/01/dyn/attack` | 0.208 |
| Release | 60 ms | `/ch/01/dyn/release` | 0.372 |
| Makeup Gain | +4 dB | `/ch/01/dyn/mgain` | 0.167 |
| Mix | 100% | `/ch/01/dyn/mix` | 90 (use integer!) |
| On | ON | `/ch/01/dyn/on` | 1 |

**Key characteristics:** Slow attack preserves transients, fast release provides immediate response. "Fat and loud without being choked."

## OSC Commands to Apply (Channel 1)

```
/ch/01/dyn/on 1
/ch/01/dyn/mode 0
/ch/01/dyn/det 1
/ch/01/dyn/env 1
/ch/01/dyn/thr 0.417
/ch/01/dyn/ratio 4
/ch/01/dyn/knee 1
/ch/01/dyn/attack 0.208
/ch/01/dyn/release 0.372
/ch/01/dyn/mgain 0.167
/ch/01/dyn/mix 90
```

**IMPORTANT:** Mix parameter requires integer value (90 = 100%). Using 1.0 causes a bug setting it to 2%.

---

## All 5 Presets

### 1. Broadcast Standard (NPR/BBC)
*Transparent, professional, natural dynamics*

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -35 dB | 0.417 |
| Ratio | 3:1 | 5 |
| Knee | Soft (4) | 0.8 |
| Attack | 12 ms | 0.10 |
| Release | 330 ms | 0.627 |
| Makeup | +8 dB | 0.333 |

**GR Target:** 4-8 dB | **Best for:** Professional broadcast, podcast

### 2. Greg Wells Natural (RECOMMENDED)
*Fat and loud without being choked*

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -35 dB | 0.417 |
| Ratio | 2.5:1 | 4 |
| Knee | Very Soft (5) | 1.0 |
| Attack | 25 ms | 0.208 |
| Release | 60 ms | 0.372 |
| Makeup | +4 dB | 0.167 |

**GR Target:** 3-4 dB | **Best for:** Natural, present sound

### 3. Church/Pastor Standard
*ProSoundWeb recommendation - preserves emotion, controls peaks*

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Detection | PEAK | 0 |
| Envelope | LOG | 1 |
| Threshold | -35 dB | 0.417 |
| Ratio | 4:1 | 6 |
| Knee | Medium (2.5) | 0.5 |
| Attack | 8 ms | 0.067 |
| Release | 100 ms | 0.448 |
| Makeup | +8 dB | 0.333 |

**GR Target:** 6 dB | **Best for:** Dynamic preachers

### 4. LA-2A / Opto Style
*Smooth, classic, transient-preserving*

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -35 dB | 0.417 |
| Ratio | 5:1 | 7 |
| Knee | Very Soft (5) | 1.0 |
| Attack | 20 ms | 0.167 |
| Release | 120 ms | 0.475 |
| Makeup | +10 dB | 0.417 |

**GR Target:** 7-10 dB | **Best for:** Voiceover, broadcast narration

### 5. Scheps Parallel Style
*Heavy compression with dry blend*

| Parameter | Value | OSC Value |
|-----------|-------|-----------|
| Detection | RMS | 1 |
| Envelope | LOG | 1 |
| Threshold | -30 dB | 0.50 |
| Ratio | 3:1 | 5 |
| Knee | Medium (3) | 0.6 |
| Attack | 20 ms | 0.167 |
| Release | 50 ms | 0.344 |
| Makeup | +12 dB | 0.50 |
| **Mix** | **50-70%** | 25-35 |

**GR Target:** 10-15 dB | **Best for:** Parallel compression effect

---

## OSC Parameter Conversion Reference

### Threshold (-60 to 0 dB, linear)

**Formula:** `normalized = (thr_db + 60) / 60`

| dB | Normalized | dB | Normalized |
|----|------------|-----|------------|
| -60 | 0.000 | -30 | 0.500 |
| -50 | 0.167 | -25 | 0.583 |
| -45 | 0.250 | -22 | 0.633 |
| -40 | 0.333 | -20 | 0.667 |
| -35 | 0.417 | -15 | 0.750 |

### Ratio (Index 0-11)

| Ratio | Index | Ratio | Index |
|-------|-------|-------|-------|
| 1.1:1 | 0 | 4:1 | 6 |
| 1.3:1 | 1 | 5:1 | 7 |
| 1.5:1 | 2 | 7:1 | 8 |
| 2:1 | 3 | 10:1 | 9 |
| 2.5:1 | 4 | 20:1 | 10 |
| 3:1 | 5 | 100:1 (limiter) | 11 |

### Attack (0-120 ms, linear)

**Formula:** `normalized = attack_ms / 120`

| ms | Normalized | ms | Normalized |
|----|------------|-----|------------|
| 5 | 0.042 | 20 | 0.167 |
| 8 | 0.067 | 25 | 0.208 |
| 10 | 0.083 | 30 | 0.250 |
| 12 | 0.100 | 50 | 0.417 |
| 15 | 0.125 | 100 | 0.833 |

### Release (5-4000 ms, logarithmic)

**Formula:** `normalized = ln(release_ms / 5) / ln(800)`

| ms | Normalized | ms | Normalized |
|----|------------|-----|------------|
| 50 | 0.344 | 200 | 0.552 |
| 60 | 0.372 | 250 | 0.585 |
| 80 | 0.415 | 330 | 0.627 |
| 100 | 0.448 | 500 | 0.688 |
| 120 | 0.475 | 1000 | 0.772 |
| 150 | 0.509 | 2000 | 0.857 |

### Knee (0-5)

**Formula:** `normalized = knee / 5`

| Knee | Normalized | Description |
|------|------------|-------------|
| 0 | 0.0 | Hard |
| 1 | 0.2 | Hard-Medium |
| 2 | 0.4 | Medium |
| 3 | 0.6 | Medium-Soft |
| 4 | 0.8 | Soft |
| 5 | 1.0 | Very Soft |

### Makeup Gain (0-24 dB)

**Formula:** `normalized = gain_db / 24`

| dB | Normalized | dB | Normalized |
|----|------------|-----|------------|
| 0 | 0.000 | 10 | 0.417 |
| 2 | 0.083 | 12 | 0.500 |
| 4 | 0.167 | 15 | 0.625 |
| 6 | 0.250 | 18 | 0.750 |
| 8 | 0.333 | 24 | 1.000 |

### Mix (0-100%, use INTEGER values)

**IMPORTANT BUG:** Sending normalized float values (0.0-1.0) causes incorrect behavior. Use integer values instead:

| Percentage | Integer Value |
|------------|---------------|
| 50% | 50 |
| 70% | 70 |
| 90% | 90 |
| 100% | 90 or higher |

---

## Sidechain Filter Settings

Enable sidechain HPF to prevent low-frequency rumble from triggering compression:

| Parameter | OSC Address | Recommended Value |
|-----------|-------------|-------------------|
| Filter On | `/ch/01/dyn/filter/on` | 1 |
| Filter Type | `/ch/01/dyn/filter/type` | 1 (LC12 = HPF 12dB/oct) |
| Frequency | `/ch/01/dyn/filter/f` | 0.31 (~170 Hz) |

---

## Professional Research Sources

### ProSoundWeb - Pastor's Mic
- Ratio: 3:1 to 4:1
- Attack: 6-8 ms
- Knee: 2-3 (soft)
- GR Target: ~6 dB
- "Should be audibly invisible"

### Gearspace - Spoken Word
- Broadcast: 3:1 ratio, 6-9 dB GR
- "Serial compression - each doing a little"
- "Rarely compress VO over 3 or 4 dB"

### Sound on Sound - Live Speech
- Ratio: 3:1 to 5:1
- Release: ~330 ms
- GR: 4-8 dB
- Soft-knee for "invisible" compression

### PureMix - Greg Wells 1176
- Slow attack, fast release
- ~3 dB GR for tracking
- "Fat and loud, not choked"

### PureMix - Rich Keller (Distressor)
- Slow attack (preserve transients)
- High ratio (10:1 opto mode)
- GR: -7 to -10 dB peaks

### Andrew Scheps - Parallel Compression
- Low ratio, slow attack, fast release
- Blend compressed with dry signal
- "Best of both worlds"

---

## Speech Compression Guidelines

### Attack Time Philosophy

| Attack | Effect | Use When |
|--------|--------|----------|
| Fast (1-10 ms) | Catches transients, more controlled | Dynamic speaker, peaks are problem |
| Medium (10-20 ms) | Balanced, natural | Most situations |
| Slow (20-50 ms) | Transients punch through, "fat" sound | Want presence and impact |

### Release Time Philosophy

| Release | Effect | Use When |
|---------|--------|----------|
| Fast (50-100 ms) | Immediate, responsive | Punchy, present sound |
| Medium (100-200 ms) | Natural recovery | Most speech |
| Slow (250-500 ms) | Smooth, unobtrusive | Broadcast, narration |

### Ratio Guidelines for Speech

| Ratio | Compression Level | Use Case |
|-------|-------------------|----------|
| 2:1 - 2.5:1 | Gentle leveling | Natural sound, minimal control |
| 3:1 - 4:1 | Standard speech | Most preacher/speech applications |
| 5:1 - 6:1 | Heavy control | Very dynamic speakers |
| 10:1+ | Limiting | Peak protection only |

---

## Threshold Calibration

**Critical:** Threshold must match your actual signal levels!

1. Record 10 seconds of speech
2. Analyze with `audio_get_loudness`
3. Set threshold ~3-5 dB above RMS level

Example from this session:
- RMS Level: -38.3 dB
- Peak Level: -9.1 dB
- Threshold set: -35 dB (catches speech, not silence)

---

## Golden Rules

1. **Match threshold to signal** - Analyze first, then set threshold
2. **Start with slow attack** - Preserve natural transients
3. **Soft knee for speech** - Invisible compression
4. **3-6 dB GR max** - More sounds unnatural
5. **RMS detection for speech** - Smoother response than PEAK
6. **Enable sidechain HPF** - Prevents rumble from triggering
7. **Listen in context** - Solo can be misleading

---

## Sources

- [ProSoundWeb - Pastor's Mic Compression](https://forums.prosoundweb.com/index.php?topic=162954.0)
- [Gearspace - Spoken Word Compression](https://gearspace.com/board/so-much-gear-so-little-time/1413720-proper-way-use-compressor-spoken-word.html)
- [Sound on Sound - Live Speech Compression](https://www.soundonsound.com/forum/viewtopic.php?t=68090)
- [PureMix - Greg Wells 1176 Settings](https://www.puremix.net/blog/greg-wells-1176-vocal-settings.html)
- [PureMix - Rich Keller Distressor](https://www.puremix.net/blog/rich-kellers-vocal-distressor-settings.html)
- [Andrew Scheps Parallel Compression](https://gearspace.com/board/so-much-gear-so-little-time/992041-andrew-scheps-parallel-compression-layout.html)
