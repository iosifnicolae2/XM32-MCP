---
name: preacher-vocal-eq
description: Configure professional EQ for preacher/speech vocals on XR18/X32 mixers. Use when setting up vocal EQ for sermons, speeches, or voice-over with Sennheiser ME36 or similar shotgun/gooseneck microphones.
---

# Preacher Vocal EQ Configuration

Professional EQ settings for speech/sermon delivery on Behringer XR18/X32 digital mixers.

## Quick Start - Recommended Preset

**#9 Podcast Pro** - Clean, intimate, professional sound:

| Band | Frequency | Gain | Q | OSC Normalized |
|------|-----------|------|---|----------------|
| HPF | 120 Hz | ON | - | 0.259 |
| Band 1 | 200 Hz | +2 dB | 1.5 | f=0.333, g=0.567, q=0.124 |
| Band 2 | 350 Hz | -4 dB | 2.0 | f=0.414, g=0.367, q=0.175 |
| Band 3 | 3.5 kHz | +3 dB | 1.5 | f=0.748, g=0.6, q=0.124 |
| Band 4 | 7 kHz | -2 dB | 2.0 | f=0.848, g=0.433, q=0.175 |

## OSC Commands to Apply

```
/ch/01/preamp/hpon 1
/ch/01/preamp/hpf 0.259
/ch/01/eq/on 1
/ch/01/eq/1/f 0.333
/ch/01/eq/1/g 0.567
/ch/01/eq/1/q 0.124
/ch/01/eq/2/f 0.414
/ch/01/eq/2/g 0.367
/ch/01/eq/2/q 0.175
/ch/01/eq/3/f 0.748
/ch/01/eq/3/g 0.6
/ch/01/eq/3/q 0.124
/ch/01/eq/4/f 0.848
/ch/01/eq/4/g 0.433
/ch/01/eq/4/q 0.175
```

## Alternative Presets

### 1. Andrew Scheps Style (Warm + Controlled)
Best for: Intimate, warm voice without harshness

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 100 Hz | ON | Clean |
| 1 | 100 Hz | +3 dB | Warmth |
| 2 | 400 Hz | -3 dB | Cut mud |
| 3 | 3 kHz | +4 dB | Presence |
| 4 | 8 kHz | -2 dB | Tame harshness |

### 2. Pultec Style (Warm + Silky Air)
Best for: Classic analog sound with shimmer

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 80 Hz | ON | Clean |
| 1 | 100 Hz | +3 dB | Body |
| 2 | 500 Hz | -2 dB | Cut boxiness |
| 3 | 4 kHz | +3 dB | Presence |
| 4 | 12 kHz | +4 dB | Silky air |

### 3. Broadcast Radio (NPR/BBC Style)
Best for: Authoritative, clear speech

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 80 Hz | ON | Clean |
| 1 | 180 Hz | +3 dB | Low-end weight |
| 2 | 350 Hz | -4 dB | Cut mud |
| 3 | 4 kHz | +3 dB | Presence |
| 4 | 6 kHz | -2 dB | De-ess |

### 4. CLA Style - Soft (Bright but Controlled)
Best for: Modern, clear, present sound

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 70 Hz | ON | Clean |
| 1 | 200 Hz | -3 dB | Cut proximity |
| 2 | 2.5 kHz | +3 dB | Bite |
| 3 | 4.5 kHz | +3 dB | Presence |
| 4 | 8 kHz | +2 dB | Air |

### 5. FM Radio DJ (Big + Sparkly)
Best for: Big, impactful voice

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 80 Hz | ON | Clean |
| 1 | 100 Hz | +4 dB | Boom |
| 2 | 300 Hz | -3 dB | Cut mud |
| 3 | 3 kHz | +4 dB | Clarity |
| 4 | 10 kHz | +3 dB | Sparkle |

### 6. Preacher Special (Authority + Intelligibility)
Best for: Sermon delivery in churches

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 100 Hz | ON | Clean |
| 1 | 180 Hz | +3 dB | Authority |
| 2 | 400 Hz | -3 dB | Cut mud |
| 3 | 2.5 kHz | +4 dB | Intelligibility |
| 4 | 5.5 kHz | -3 dB | No harshness |

## OSC Parameter Conversion Reference

### EQ Frequency (20Hz - 20kHz, logarithmic)
Formula: `normalized = log10(freq_hz / 20) / 3`

| Hz | Normalized | Hz | Normalized |
|----|------------|-----|------------|
| 80 | 0.201 | 2000 | 0.667 |
| 100 | 0.233 | 2500 | 0.699 |
| 120 | 0.259 | 3000 | 0.725 |
| 150 | 0.292 | 3500 | 0.748 |
| 180 | 0.318 | 4000 | 0.767 |
| 200 | 0.333 | 4500 | 0.784 |
| 300 | 0.392 | 5000 | 0.799 |
| 350 | 0.414 | 5500 | 0.813 |
| 400 | 0.434 | 6000 | 0.826 |
| 500 | 0.466 | 7000 | 0.848 |
| 800 | 0.534 | 8000 | 0.867 |
| 1000 | 0.567 | 10000 | 0.9 |
| 1500 | 0.625 | 12000 | 0.926 |

### EQ Gain (-15dB to +15dB)
Formula: `normalized = (gain_db + 15) / 30`

| dB | Normalized | dB | Normalized |
|----|------------|-----|------------|
| -6 | 0.300 | +1 | 0.533 |
| -5 | 0.333 | +2 | 0.567 |
| -4 | 0.367 | +3 | 0.600 |
| -3 | 0.400 | +4 | 0.633 |
| -2 | 0.433 | +5 | 0.667 |
| -1 | 0.467 | +6 | 0.700 |
| 0 | 0.500 | +8 | 0.767 |

### EQ Q (Bandwidth)
Formula: `normalized = (q - 0.3) / 9.7`

| Q | Normalized | Description |
|---|------------|-------------|
| 0.7 | 0.041 | Wide shelf |
| 1.0 | 0.072 | Wide |
| 1.5 | 0.124 | Medium-wide |
| 2.0 | 0.175 | Medium |
| 2.5 | 0.227 | Medium-narrow |
| 3.0 | 0.278 | Narrow |

## Sennheiser ME36 Mini Shotgun Considerations

The ME36 is a mini shotgun microphone with hypercardioid/lobar pattern (40Hz-20kHz).

**Key characteristics:**
- Rear lobe picks up low frequencies (room rumble)
- Off-axis coloration indoors
- Highly directional

**Recommended adjustments:**
- Use higher HPF (100-120Hz) to combat rear lobe room pickup
- Cut 300-400Hz more aggressively for room reflection control
- Presence boost at 2.5-4kHz for speech intelligibility
- Consider de-essing cut at 5-7kHz

## Speech Frequency Zones

| Range | Name | Energy | Intelligibility |
|-------|------|--------|-----------------|
| 63-500 Hz | Low/Body | 60% | 5% |
| 500-1000 Hz | Low-Mid | - | 35% |
| 1-8 kHz | Clarity | 5% | **60%** |

**Key insight:** 60% of speech intelligibility is in 1-8kHz, but only 5% of energy. Always boost presence!

## Problem Frequencies

| Problem | Frequency | Solution |
|---------|-----------|----------|
| Proximity effect | 100-300 Hz | Cut or HPF |
| Muddy/boomy | 200-400 Hz | Cut -3 to -4dB |
| Boxy | 400-600 Hz | Cut -2 to -3dB |
| Nasal | 800-1.2 kHz | Narrow cut |
| Harsh | 2.5-4 kHz | Careful, this is clarity zone |
| Sibilance (SSS) | 5-8 kHz | Cut -2 to -3dB |

## Professional Engineer Insights

**Andrew Scheps:** Cut lows, boost highs, compress, then add 100Hz warmth back. Cut 8kHz slightly to tame harshness.

**Chris Lord-Alge:** Starts with 9dB boost at 8kHz (!), boosts 2.5kHz and 4.5kHz for presence. Very aggressive.

**Broadcast standard:** HPF at 80-100Hz, boost 180Hz for weight, presence at 3-5kHz, de-ess at 6-8kHz.

**Pultec trick:** Boost 100Hz for body, boost 3-5kHz for presence, boost 10-16kHz for air with wide Q.

## Golden Rules

1. **Cut before boost** - Remove problems first
2. **Small moves** - 2-3dB adjustments, not 6dB+
3. **HPF always** - Speech doesn't need below 80-100Hz
4. **Presence is key** - 2-4kHz = intelligibility
5. **De-ess if needed** - Cut 5-7kHz for harsh S sounds
6. **Listen in context** - Solo misleads, check in full mix

## Sources

- [Andrew Scheps Vocal Trick](https://audiospectra.net/andrew-scheps-trick/)
- [Pultec EQ Settings](https://songmixmaster.com/how-to-use-pultec-eq-for-warm-and-punchy-sound)
- [Broadcast EQ](https://www.thebroadcastbridge.com/content/entry/20040/audio-for-broadcast-equalizers-eq)
- [Vocal EQ Cheat Sheet 2024](https://www.343labs.com/vocal-eq-cheat-sheet/)
- [Sennheiser ME36](https://en-us.sennheiser.com/mini-shotgun-microphone-directional-lobar-me-36)
