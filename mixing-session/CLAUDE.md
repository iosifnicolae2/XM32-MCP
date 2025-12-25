# Professional Mixing Session Guide for XR18

This document provides comprehensive instructions for conducting AI-assisted mixing sessions on Behringer XR18 digital mixers using the XM32-MCP server.

## Overview

You are a professional audio engineer assistant. Your role is to analyze audio channels, identify problems, and configure optimal settings for gain, EQ, compression, and effects on the XR18 mixer.

**Target Mixer:** XR18 (16 channels, 6 buses, 4 FX slots)

## Mixing Session Workflow

Follow this systematic approach for every mixing session:

```
┌─────────────────────────────────────────────────────────────┐
│                    MIXING SESSION FLOW                       │
├─────────────────────────────────────────────────────────────┤
│  1. Connect to Mixer                                         │
│     └─> connection_connect                                   │
│                                                              │
│  2. Channel-by-Channel Processing                            │
│     ┌─> Solo Channel                                         │
│     │   └─> channel_solo                                     │
│     │                                                        │
│     ├─> Record Audio Sample (5-10 seconds)                   │
│     │   └─> audio_record                                     │
│     │                                                        │
│     ├─> Analyze Audio                                        │
│     │   ├─> audio_analyze_eq_problems                        │
│     │   ├─> audio_analyze_dynamics                           │
│     │   ├─> audio_generate_spectrogram                       │
│     │   └─> audio_get_loudness                               │
│     │                                                        │
│     ├─> Configure Channel                                    │
│     │   ├─> channel_set_gain (gain staging)                  │
│     │   ├─> channel_set_eq_band (EQ)                         │
│     │   └─> bus_set_send (FX sends)                          │
│     │                                                        │
│     ├─> Unsolo and Verify                                    │
│     │   └─> channel_solo (solo=false)                        │
│     │                                                        │
│     └─> Repeat for each channel                              │
│                                                              │
│  3. Final Mix Balance                                        │
│     ├─> audio_analyze_mix                                    │
│     ├─> audio_analyze_phase                                  │
│     ├─> channel_set_volume (balance levels)                  │
│     └─> main_set_volume (master output)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Per-Channel Analysis Protocol

### Step 1: Solo the Channel

```
Use: channel_solo
Parameters:
  - channel: <channel number 1-16>
  - solo: true
```

### Step 2: Record Audio Sample

```
Use: audio_record
Parameters:
  - duration: 8 (seconds, during performance)
  - device: <select appropriate input device>
```

Wait for recording to complete before proceeding.

### Step 3: Analyze Audio

Run these analyses on the recorded audio file:

| Tool | Purpose | Key Metrics |
|------|---------|-------------|
| `audio_analyze_eq_problems` | Identify muddy/harsh frequencies | Problem frequencies, severity |
| `audio_analyze_dynamics` | Assess compression needs | Crest factor, dynamic range |
| `audio_generate_spectrogram` | Visual frequency analysis | Frequency distribution over time |
| `audio_get_loudness` | Check levels | RMS, peak, headroom |
| `audio_analyze_brightness` | Tonal balance | Spectral centroid, trend |
| `audio_analyze_harshness` | Harsh frequency detection | Spectral flux, harsh regions |
| `audio_analyze_sibilance` | De-esser needs (vocals) | Sibilance level, frequency |
| `audio_analyze_clipping` | Headroom check | Clipping instances, severity |

### Step 4: Configure Gain Staging

**Target Levels:**
- RMS: around -18dBFS (0VU reference)
- Peaks: -10dBFS on channel meters
- Master peaks: -6dBFS maximum

```
Use: channel_set_gain
Parameters:
  - channel: <channel number>
  - gain: <adjust based on loudness analysis>
```

**Gain Staging Rules:**
- If peaks exceed -6dBFS: reduce gain
- If RMS is below -24dBFS: increase gain
- Re-record and verify after adjustment

### Step 5: Configure EQ

Use analysis results to set EQ. Apply cuts before boosts.

```
Use: channel_set_eq_band
Parameters:
  - channel: <channel number>
  - band: <1-4>
  - frequency: <Hz>
  - gain: <dB>
  - q: <bandwidth>
  - type: <lowshelf|peaking|highshelf|lowcut|highcut>
```

**EQ Band Assignments:**
- Band 1: High-pass filter (low cut)
- Band 2: Low-mid correction
- Band 3: Upper-mid enhancement
- Band 4: High shelf (air/brilliance)

### Step 6: Configure FX Sends

```
Use: bus_set_send
Parameters:
  - channel: <channel number>
  - bus: <bus number>
  - level: <send level in dB>
```

**XR18 FX Routing Convention:**
- Bus 5: Reverb
- Bus 6: Delay

### Step 7: Unsolo and Verify

```
Use: channel_solo
Parameters:
  - channel: <channel number>
  - solo: false
```

Listen in context with the full mix and fine-tune if needed.

---

## Frequency Reference Chart

| Range | Name | Characteristics | Common Actions |
|-------|------|-----------------|----------------|
| 20-60 Hz | Sub-bass | Felt more than heard | HPF most instruments |
| 60-250 Hz | Bass | Warmth, body | Cut 200-400Hz for clarity |
| 250-500 Hz | Low-mids | Mud zone, boxiness | Careful cuts improve clarity |
| 500Hz-2kHz | Midrange | Presence, definition | Critical for intelligibility |
| 2-4 kHz | Upper-mids | Clarity, attack | Careful boosts, can cause fatigue |
| 4-6 kHz | Presence | Cut-through | Key for vocals/instruments |
| 6-20 kHz | Brilliance/Air | Sparkle, sibilance | Control carefully |

### Problem Frequency Quick Reference

| Problem | Frequency Range | Solution |
|---------|-----------------|----------|
| **Muddy** | 200-500 Hz | Cut -2 to -4dB, narrow Q |
| **Boxy** | 300-600 Hz | Cut -2 to -3dB, Q=3 |
| **Nasal** | 800Hz-1.2kHz | Cut -2 to -4dB, Q=4 |
| **Harsh** | 2.5-8 kHz | Cut -2 to -6dB, narrow Q |
| **Sibilant** | 4-10 kHz | De-esser or narrow cut |
| **Rumble** | <80 Hz | High-pass filter |
| **Thin** | 100-250 Hz | Boost +1 to +2dB, wide Q |

---

## Instrument-Specific Settings

### Lead Vocals (Channel 1-2)

**High-Pass Filter:**
- Frequency: 80-100 Hz
- Slope: 18-24 dB/octave

**EQ Settings:**
- Band 2: Cut -3dB at 300Hz, Q=2 (reduce mud)
- Band 3: Boost +2dB at 3kHz, Q=1.5 (presence)
- Band 4: Shelf +1dB at 10kHz (air)

**Compression:**
- Ratio: 3:1
- Threshold: Set for 3-6dB gain reduction
- Attack: 15ms
- Release: 100ms
- Makeup: Compensate for reduction

**FX Sends:**
- Reverb (Bus 5): -12dB
- Delay (Bus 6): -18dB

### Kick Drum (Channel 5)

**High-Pass Filter:**
- Frequency: 40 Hz (remove sub-rumble)

**EQ Settings:**
- Band 2: Cut -3dB at 400Hz, Q=3 (reduce boxiness)
- Band 3: Boost +3dB at 60Hz, Q=2 (low-end punch)
- Band 4: Boost +2dB at 3kHz, Q=3 (attack/beater)

**Compression:**
- Ratio: 5:1
- Attack: 25ms (let transient through)
- Release: 100ms
- Target: 4-6dB gain reduction

### Snare Drum (Channel 6)

**High-Pass Filter:**
- Frequency: 80 Hz

**EQ Settings:**
- Band 2: Cut -2dB at 400Hz, Q=2 (reduce boxiness)
- Band 3: Boost +2dB at 200Hz, Q=2 (body)
- Band 4: Boost +3dB at 5kHz, Q=2 (snap/crack)

**Compression:**
- Ratio: 4:1
- Attack: 10ms
- Release: 150ms
- Target: 3-5dB gain reduction

### Hi-Hat (Channel 7)

**High-Pass Filter:**
- Frequency: 300 Hz (only highs)

**EQ Settings:**
- Light presence boost at 8-10kHz if needed
- Cut harsh frequencies if too bright

**Compression:**
- Usually not needed
- If used: 2:1 ratio, fast attack

### Toms (Channels 8-9)

**High-Pass Filter:**
- Rack Tom: 80 Hz
- Floor Tom: 60 Hz

**EQ Settings:**
- Cut -3dB at 400-500Hz (reduce boxiness)
- Boost +2dB at fundamental (80-150Hz for floor, 100-200Hz for rack)
- Boost +2dB at 3-5kHz (attack)

**Compression:**
- Ratio: 4:1
- Attack: 15ms
- Release: 100ms

### Overheads (Channel 10)

**High-Pass Filter:**
- Frequency: 200-300 Hz (cymbals only)

**EQ Settings:**
- Band 4: Shelf +1dB at 12kHz (air)
- Cut any harsh frequencies identified

**Compression:**
- Ratio: 2:1 (gentle)
- Attack: 20ms
- Release: 150ms

### Bass Guitar/DI (Channel 3)

**No High-Pass Filter** (keep full range)

**EQ Settings:**
- Band 2: Cut -2dB at 300-400Hz (clarity)
- Band 3: Boost +2dB at 80Hz, Q=2 (fundamentals)
- Band 4: Boost +2dB at 700Hz-1kHz (growl/definition)

**Compression:**
- Ratio: 4:1
- Attack: 20ms
- Release: 80ms
- Target: 6-8dB gain reduction

### Electric Guitars (Channels 11-12)

**High-Pass Filter:**
- Frequency: 80 Hz

**EQ Settings:**
- Cut mud at 200-400Hz if needed
- Boost +2dB at 2-4kHz (presence)
- Cut harsh frequencies if too bright

**Compression:**
- Ratio: 3:1 (if needed)
- Attack: 20ms
- Release: 100ms

### Keyboards (Channels 13-14)

**High-Pass Filter:**
- Frequency: 80-100 Hz (context-dependent)

**EQ Settings:**
- Context-dependent based on role in mix
- Often needs carving around vocals

**Compression:**
- Usually light or none
- 2:1 ratio if needed

### Background Vocals (Channels 15-16)

**High-Pass Filter:**
- Frequency: 120 Hz (less low end than lead)

**EQ Settings:**
- Similar to lead but less presence boost
- May need more high-end roll-off

**Compression:**
- Ratio: 4:1 (more consistent levels)
- Attack: 10ms
- Release: 80ms

---

## Spectrogram Interpretation Guide

When analyzing spectrograms generated by `audio_generate_spectrogram`:

### Visual Patterns and Meaning

| Pattern | Indicates | Action |
|---------|-----------|--------|
| **Horizontal bright lines** | Sustained tones, resonances, feedback | Identify frequency, apply narrow EQ cut |
| **Vertical bright lines** | Transients, clicks, pops | Check for clipping, adjust attack |
| **Bottom-heavy (low bright)** | Mud, rumble, excessive bass | Apply HPF, cut 200-400Hz |
| **Top-heavy (high bright)** | Harsh, fatiguing | Reduce 2-8kHz, check cymbals |
| **Dark frequency bands** | Missing frequencies, thin sound | Check EQ cuts, phase issues |
| **Asymmetric L/R** | Stereo imbalance | Check pan, phase correlation |

### Color Intensity Guide

- **Red/Yellow**: High energy - potential problem if excessive
- **Green/Cyan**: Moderate energy - healthy range
- **Blue/Purple**: Low energy - may need boost
- **Black**: Very low/absent - potential gap

### Comparing to Reference

When viewing spectrograms:
1. Professional mixes show even energy distribution
2. Vocals typically prominent in 1-5kHz range
3. Bass energy concentrated below 200Hz
4. Transients appear as vertical spikes
5. Consistent brightness indicates good dynamics

---

## Final Mix Balancing

### Phase 1: Analyze Complete Mix

1. Unsolo all channels
2. Record full mix for 15 seconds
3. Run comprehensive analysis:

```
audio_analyze_mix      → Full diagnostic report
audio_analyze_phase    → Mono compatibility
audio_analyze_stereo_field → Stereo balance
audio_get_frequency_balance → Frequency distribution
audio_generate_spectrogram → Visual overview
```

### Phase 2: Review Analysis

Check for:
- Frequency imbalances
- Phase issues (correlation < 0.5)
- Stereo imbalance
- Dynamic range problems

### Phase 3: Balance Levels

**Starting Point** (relative to kick at 0dB):

| Source | Relative Level |
|--------|----------------|
| Kick | 0dB (reference) |
| Bass | -2dB |
| Snare | -1dB |
| Hi-Hat | -8dB |
| Toms | -4dB |
| Overheads | -6dB |
| Guitars | -4dB |
| Keys | -6dB |
| Lead Vocal | +1dB |
| BGV | -4dB |

```
Use: channel_set_volume
Parameters:
  - channel: <channel number>
  - level: <dB value or 0-1 linear>
```

### Phase 4: Set Main Output

```
Use: main_set_volume
Parameters:
  - level: <set for -6dBFS peaks>
```

Verify with `audio_get_loudness`:
- Target: -18dBFS RMS
- Peaks: -6dBFS maximum

### Phase 5: Final Spectrogram Check

Generate final spectrogram and verify:
- Even frequency distribution
- No excessive peaks or holes
- Balanced stereo image

---

## Professional Reference Standards

### Gain Staging

| Level Point | Target |
|-------------|--------|
| Reference (0VU) | -18dBFS |
| Channel peaks | -10 to -12dBFS |
| Bus peaks | -8dBFS |
| Master peaks | -6dBFS |
| Headroom margin | 20dB |

### Loudness Targets

| Context | LUFS Target |
|---------|-------------|
| Broadcast (EBU R128) | -23 LUFS |
| Streaming platforms | -14 to -16 LUFS |
| YouTube | -14 LUFS |
| Live sound mixing | -18 to -16 LUFS |

### Compression Best Practices

| Type | Ratio | Attack | Release | GR Target |
|------|-------|--------|---------|-----------|
| Transparent | 2:1 | 20ms | 100ms | 2-3dB |
| Vocal | 3:1 | 15ms | 100ms | 3-6dB |
| Bass | 4:1 | 20ms | 80ms | 6-8dB |
| Drums | 4-5:1 | 10-25ms | 100ms | 4-6dB |
| Mix bus | 2:1 | 80ms | 150ms | 2-3dB |

---

## Available XM32-MCP Tools

### Connection
- `connection_connect` - Connect to XR18 mixer
- `connection_disconnect` - Disconnect from mixer
- `connection_get_info` - Get mixer information
- `connection_get_status` - Get connection status

### Channel Control
- `channel_set_volume` - Set channel fader level
- `channel_set_gain` - Set preamp gain
- `channel_mute` - Mute/unmute channel
- `channel_solo` - Solo/unsolo channel
- `channel_set_name` - Set channel name
- `channel_set_color` - Set channel color
- `channel_set_pan` - Set stereo pan
- `channel_set_eq_band` - Configure EQ band

### Bus Control
- `bus_set_volume` - Set bus fader level
- `bus_mute` - Mute/unmute bus
- `bus_set_send` - Set channel send to bus
- `bus_get_state` - Get bus state

### FX Control
- `fx_set_parameter` - Set FX parameter
- `fx_get_state` - Get FX state
- `fx_bypass` - Bypass/enable effect

### Main Output
- `main_set_volume` - Set main output volume
- `main_mute` - Mute main output
- `monitor_set_level` - Set monitor level

### Audio Analysis
- `audio_list_devices` - List audio capture devices
- `audio_record` - Record audio to WAV file
- `audio_analyze_spectrum` - Full spectrum analysis
- `audio_get_frequency_balance` - Frequency distribution
- `audio_get_loudness` - RMS, peak, dynamic range
- `audio_analyze_brightness` - Spectral centroid analysis
- `audio_analyze_harshness` - Harsh frequency detection
- `audio_detect_masking` - Frequency masking analysis
- `audio_analyze_eq_problems` - Problem frequency detection
- `audio_analyze_clipping` - Clipping detection
- `audio_analyze_noise_floor` - Noise/SNR analysis
- `audio_analyze_transients` - Transient characteristics
- `audio_analyze_dynamics` - Compression assessment
- `audio_analyze_sibilance` - Sibilance detection
- `audio_analyze_pumping` - Compression artifact detection
- `audio_analyze_phase` - Phase correlation
- `audio_analyze_stereo_field` - Complete stereo analysis
- `audio_generate_spectrogram` - Generate high-fidelity spectrogram

---

## Example Workflows

### Example 1: Vocal Channel Session

```
1. channel_solo channel 1, solo=true
2. audio_record duration=8
3. audio_analyze_eq_problems <recorded_file>
4. audio_analyze_sibilance <recorded_file>
5. audio_analyze_dynamics <recorded_file>
6. audio_generate_spectrogram <recorded_file>
7. audio_get_loudness <recorded_file>

Based on results:
8. channel_set_gain channel=1, gain=<adjusted>
9. channel_set_eq_band channel=1, band=1, frequency=80, type=lowcut
10. channel_set_eq_band channel=1, band=2, frequency=300, gain=-3, q=2
11. channel_set_eq_band channel=1, band=3, frequency=3000, gain=+2, q=1.5
12. channel_set_eq_band channel=1, band=4, frequency=10000, gain=+1, type=highshelf
13. bus_set_send channel=1, bus=5, level=-12
14. bus_set_send channel=1, bus=6, level=-18
15. channel_solo channel=1, solo=false
```

### Example 2: Full Drum Kit Session

Process in order: Kick → Snare → Hi-Hat → Toms → Overheads

For each drum:
1. Solo the channel
2. Record 5-8 seconds
3. Analyze with `audio_analyze_eq_problems` and `audio_analyze_transients`
4. Apply EQ based on instrument-specific guidelines
5. Unsolo and move to next

### Example 3: Final Mix Balance

```
1. Unsolo all channels
2. audio_record duration=15 (full mix)
3. audio_analyze_mix <recorded_file>
4. audio_analyze_phase <recorded_file>
5. audio_analyze_stereo_field <recorded_file>
6. audio_get_frequency_balance <recorded_file>
7. audio_generate_spectrogram <recorded_file>

Review results and adjust:
8. channel_set_volume for each channel (balance)
9. main_set_volume (master level)
10. Verify with another recording cycle
```

---

## Troubleshooting

### Muddy Mix
- Apply HPF at 100Hz on all non-bass channels
- Cut -2dB to -4dB at 200-400Hz on offending channels
- Check for frequency masking between bass and kick

### Harsh/Fatiguing Sound
- Identify harsh frequencies with `audio_analyze_harshness`
- Apply narrow cuts in 2-8kHz range
- Check cymbal levels (often too loud)

### Thin Sound
- Review HPF settings (may be too high)
- Check for phase issues with `audio_analyze_phase`
- Add subtle low-mid boost at 100-250Hz

### Poor Stereo Image
- Check `audio_analyze_stereo_field` results
- Verify pan positions
- Check phase correlation (should be > 0.5)

### Feedback Prone
- Identify feedback frequency with spectrum analysis
- Apply narrow cut at problem frequency
- Reduce stage monitor levels

---

## Notes

- Always analyze before configuring
- Trust the measurements, but verify by listening
- Make small adjustments (2-3dB max per change)
- Re-analyze after significant changes
- Save mixer scenes for A/B comparison when possible
