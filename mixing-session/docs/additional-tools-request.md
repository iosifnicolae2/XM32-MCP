# Additional Tools Request

This document outlines additional MCP tools that would enhance the mixing session workflow but are not currently available in XM32-MCP.

## Priority 1: Critical Enhancements

### 1. Channel Compressor Configuration

**Tool Name:** `channel_set_compressor`

**Purpose:** Configure the channel compressor with all parameters in a single call.

**Required Parameters:**
- `channel` (number): Channel number 1-16
- `threshold` (number): Threshold in dB (-60 to 0)
- `ratio` (number): Compression ratio (1 to 100, where 100 = limiter)
- `attack` (number): Attack time in ms (0.3 to 120)
- `release` (number): Release time in ms (5 to 4000)
- `makeup` (number): Makeup gain in dB (0 to 24)
- `enabled` (boolean): Enable/disable compressor

**Justification:** Compression is essential for professional mixing. Currently there's no way to configure the channel dynamics processor.

---

### 2. Channel Gate Configuration

**Tool Name:** `channel_set_gate`

**Purpose:** Configure the channel noise gate/expander.

**Required Parameters:**
- `channel` (number): Channel number 1-16
- `threshold` (number): Gate threshold in dB
- `attack` (number): Attack time in ms
- `release` (number): Release time in ms
- `range` (number): Range/depth in dB
- `enabled` (boolean): Enable/disable gate

**Justification:** Gates are critical for drums and noise reduction in live sound.

---

### 3. Channel Get State

**Tool Name:** `channel_get_state`

**Purpose:** Retrieve complete channel configuration including all parameters.

**Returns:**
- Volume level
- Gain setting
- Mute/solo status
- Pan position
- EQ settings (all bands)
- Compressor settings
- Gate settings
- Name, color
- All send levels

**Justification:** Need to read current state before making modifications to understand baseline.

---

## Priority 2: Workflow Enhancements

### 4. Scene Management

**Tool Name:** `scene_save`

**Purpose:** Save current mixer state to a scene slot.

**Parameters:**
- `slot` (number): Scene slot number
- `name` (string): Scene name

---

**Tool Name:** `scene_load`

**Purpose:** Load a previously saved scene.

**Parameters:**
- `slot` (number): Scene slot number

**Justification:** Enables A/B comparison of different mix approaches.

---

### 5. Meter Subscription

**Tool Name:** `meters_subscribe`

**Purpose:** Subscribe to real-time meter data.

**Parameters:**
- `type` (string): Meter type (channel, bus, main)
- `interval` (number): Update interval in ms

**Returns:** Stream of meter values

**Justification:** Real-time level monitoring without recording.

---

### 6. Reference Track Comparison

**Tool Name:** `audio_compare_spectrum`

**Purpose:** Compare two audio files' spectral characteristics.

**Parameters:**
- `file1` (string): Path to first audio file
- `file2` (string): Path to second (reference) file

**Returns:**
- Frequency-by-frequency difference
- Overall similarity score
- Suggested EQ adjustments

**Justification:** Compare mix against professional reference tracks.

---

## Priority 3: Advanced Features

### 7. Auto-EQ Suggestion

**Tool Name:** `audio_suggest_eq`

**Purpose:** Generate EQ curve suggestions based on audio analysis.

**Parameters:**
- `file` (string): Audio file path
- `target` (string): Target profile (vocal, kick, snare, etc.)

**Returns:**
- Suggested EQ band settings
- Confidence scores
- Before/after spectral comparison

**Justification:** Accelerate the mixing process with AI-suggested starting points.

---

### 8. Batch Channel Configuration

**Tool Name:** `channel_set_batch`

**Purpose:** Configure multiple channels simultaneously.

**Parameters:**
- `channels` (array): Array of channel configurations
  - Each with: channel number, volume, pan, mute, eq settings

**Justification:** Speed up initial setup and global adjustments.

---

### 9. FX Preset Management

**Tool Name:** `fx_set_preset`

**Purpose:** Apply a named preset to an FX slot.

**Parameters:**
- `slot` (number): FX slot 1-4
- `preset` (string): Preset name or type

**Justification:** Quickly set up common effects without knowing all parameters.

---

### 10. Real-Time Spectrum Overlay

**Tool Name:** `audio_overlay_spectrum`

**Purpose:** Generate overlaid spectrum comparison of two sources.

**Parameters:**
- `file1` (string): First audio file
- `file2` (string): Second audio file (or reference profile)
- `output` (string): Output image path

**Returns:** Image showing both spectra overlaid

**Justification:** Visual comparison against reference tracks.

---

## Implementation Notes

### Current Workarounds

For compressor/gate: Use `set_parameter` with raw OSC addresses:
- Compressor threshold: `/ch/XX/dyn/thr`
- Compressor ratio: `/ch/XX/dyn/ratio`
- Gate threshold: `/ch/XX/gate/thr`

This is not ideal as it:
- Requires knowing OSC address patterns
- Doesn't validate parameter ranges
- Provides poor discoverability for LLM agents

### Suggested Development Priority

1. `channel_set_compressor` - Essential for any serious mixing
2. `channel_get_state` - Required for intelligent decision-making
3. `scene_save` / `scene_load` - Enables workflow improvements
4. `audio_compare_spectrum` - Professional mixing workflow support
5. Remaining tools as time permits

---

## Contact

For questions about these tool requests or to discuss implementation priorities, please open an issue in the XM32-MCP repository.
