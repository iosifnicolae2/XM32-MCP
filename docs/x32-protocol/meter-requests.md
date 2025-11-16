# X32/M32 Meter Requests

## 개요

`/meters` OSC 명령은 미터 데이터를 얻거나 특정 미터 값 세트를 가져오는 데 사용됩니다.

### 기본 정보

- **업데이트 주기**: 50ms (콘솔의 처리 능력에 따라 가변적)
- **타임아웃**: 10초
- **데이터 형식**: OSC blob (binary data)
- **값 범위**: Float [0.0, 1.0] (선형 오디오 레벨, digital 0 = full-scale)
    - 내부 헤드룸: 최대 8.0 (+18 dBfs) 허용

## `/meters` 명령 형식

```
/meters ,siii <meter_request> [time_factor]
```

### 파라미터

| 파라미터          | 타입           | 설명                                         |
| ----------------- | -------------- | -------------------------------------------- |
| `siii`            | Type tags      | String + 2 integers (meter type에 따라 다름) |
| `<meter_request>` | string         | 미터 요청 ID (아래 목록 참조)                |
| `[time_factor]`   | int (optional) | 업데이트 빈도 제어                           |

### Time Factor

`time_factor`는 1~99 사이의 값으로, 연속된 두 미터 메시지 사이의 간격을 설정합니다.

**공식**: 간격 = `50ms × time_factor`

**타임아웃**: 10초 동안 활성

| time_factor | 업데이트 횟수 (10초) | 간격  |
| ----------- | -------------------- | ----- |
| <2 또는 >99 | ~200회               | ~50ms |
| 2           | ~100회               | 100ms |
| 10          | ~20회                | 500ms |
| 40          | ~5회                 | 2초   |
| 80~99       | ~3회                 | 4~5초 |

**참고**: `time_factor`가 [1, 99] 범위를 벗어나면 1과 동일하게 처리됩니다.

## 응답 형식 (OSC Blob)

X32/M32 서버가 `/meters` 요청에 대해 반환하는 데이터는 **OSC-blob** (임의의 이진 데이터 세트) 형식입니다.

### Blob 구조

```
<meter_id> ,b~~<int1><int2><nativefloat>…<nativefloat>
```

**필드 설명:**

- `<meter_id>`: 미터 ID (null bytes로 패딩)
- `,b~~`: Blob 포맷 표시 (null bytes로 패딩)
- `<int1>`: Blob 길이 (bytes), 32-bit big-endian
- `<int2>`: `<nativefloat>` 개수, 32-bit little-endian
- `<nativefloat>`: 미터 값들, 32-bit floats, little-endian

**중요**: Float 값들은 **little-endian**으로 인코딩됩니다 (OSC 표준의 big-endian과 다름).

### 예제

**요청:**

```
/meters~,si~/meters/6~~16
```

16진수:

```
2f6d6574657273002c7369002f6d65746572732f36000000000000010
/  m e t e r s ~ , s i ~ / m e t e r s / 6 ~ ~ ~ [ 16]
```

**응답:**

```
2f6d657465727332f3600000002c6200000000014040000000fd1d2137fdff7f3f000803f6ebbd534
/  m e t e r s / 6 ~ ~ ~ , b ~ ~ [ int1 ][ int2 ][nfloat][nfloat][nfloat][nfloat]
```

10초 동안 약 50ms마다 채널 17의 4채널 스트립 미터 (pre-fade, gate, dyn gain reduction, post-fade) 값을 단일 blob으로 반환합니다.

## 모든 Meter ID 목록

### /meters/0

**설명**: METERS 페이지의 미터 값 반환 (X32-Edit에서는 사용하지 않음)

**포함 내용**:

- 32 input channels
- 8 aux returns
- 4x2 st fx returns
- 16 bus masters
- 6 matrixes

**반환**: 70개의 float 값 (단일 binary blob)

**예제**:

```
/meters ,s meters/0
```

---

### /meters/1

**설명**: METERS/channel 페이지의 미터 값 반환

**포함 내용**:

- 32 input channels
- 32 gate gain reductions
- 32 dynamics gain reductions

**반환**: 96개의 float 값 (단일 OSC blob)

**예제**:

```
/meters ,s meters/1
```

---

### /meters/2

**설명**: METERS/mix bus 페이지의 미터 값 반환

**포함 내용**:

- 16 bus masters
- 6 matrixes
- 2 main LR
- 1 mono M/C
- 16 bus master dynamics gain reductions
- 6 matrix dynamics gain reductions
- 1 main LR dynamics gain reduction
- 1 mono M/C dynamics gain reduction

**반환**: 49개의 float 값 (단일 OSC blob)

**예제**:

```
/meters ,s meters/2
```

---

### /meters/3

**설명**: METERS/aux/fx 페이지의 미터 값 반환

**포함 내용**:

- 6 aux sends
- 8 aux returns
- 4x2 st fx returns

**반환**: 22개의 float 값 (단일 OSC blob)

**예제**:

```
/meters ,s meters/3
```

---

### /meters/4

**설명**: METERS/in/out 페이지의 미터 값 반환

**포함 내용**:

- 32 input channels
- 8 aux returns
- 16 outputs
- 16 P16 ultranet outputs
- 6 aux sends
- 2 digital AES/EBU out
- 2 monitor outputs

**반환**: 82개의 float 값 (단일 OSC blob)

**예제**:

```
/meters ,s meters/4
```

---

### /meters/5 `<chn_meter_id>` `<grp_meter_id>`

**설명**: Console Surface VU Meters (채널, 그룹 및 메인 미터) 반환

**파라미터**:

- `<chn_meter_id>`: 채널 미터 선택
    - `0`: 채널 1-16
    - `1`: 채널 17-32
    - `2`: aux/fx returns
    - `3`: bus masters
- `<grp_meter_id>`: 그룹 미터 선택
    - `1`: mix bus 1-8
    - `2`: mix bus 9-16
    - `3`: matrixes

**포함 내용**:

- 16 channel meters
- 8 group meters
- 2 main LR
- 1 mono M/C

**반환**: 27개의 float 값 (단일 OSC blob)

**예제**:

```
/meters ,sii meters/5 0 1
/meters ,sii meters/5 1 2
/meters ,sii meters/5 2 3
```

---

### /meters/6 `<channel_id>`

**설명**: Channel Strip Meters (post gain/trim, gate, dyn gain reduction, post-fade) 반환

**파라미터**:

- `<channel_id>`: 채널 번호 (0...71)
    - 0-31: 입력 채널 1-32
    - 32-39: aux returns 1-8
    - 40-47: fx returns 1-8
    - 48-63: bus masters 1-16
    - 64-69: matrixes 1-6
    - 70-71: main LR

**반환**: 4개의 float 값 (단일 OSC blob)

1. Post gain/trim level
2. Gate reduction
3. Dynamics gain reduction
4. Post-fader level

**예제**:

```
/meters ,si meters/6 0      # 채널 1
/meters ,si meters/6 16     # 채널 17
/meters ,si meters/6 32     # Aux return 1
/meters ,si meters/6 48     # Bus master 1
```

---

### /meters/7

**설명**: Bus Send 미터 값 반환

**포함 내용**:

- 16 bus send meters

**반환**: 16개의 float 값 (Bus sends 1-16)

**예제**:

```
/meters ,s meters/7
```

---

### /meters/8

**설명**: Matrix Send 미터 값 반환

**포함 내용**:

- 6 Matrix send meters

**반환**: 6개의 float 값 (Matrix sends 1-6)

**예제**:

```
/meters ,s meters/8
```

---

### /meters/9

**설명**: Effect Send 및 Return 미터 값 반환

**포함 내용**:

- FX 슬롯당 2개의 effects send 미터와 2개의 effects return 미터 (8 슬롯)

**반환**: 32개의 float 값 (4 × FX1, 4 × FX2, ... 4 × FX8)

**예제**:

```
/meters ,s meters/9
```

---

### /meters/10

**설명**: 일부 Effects 전용 미터 (예: Dual DeEsser, Stereo DeEsser, Stereo Fair Compressor)

**반환**: 32개의 float 값

**예제**:

```
/meters ,s meters/10
```

---

### /meters/11

**설명**: Monitor 페이지 미터 값 반환

**포함 내용**:

- Mon Left
- Mon Right
- Talk A/B level
- Threshold/GR
- Osc Tone level

**반환**: 5개의 float 값

**예제**:

```
/meters ,s meters/11
```

---

### /meters/12

**설명**: Recorder 페이지 미터 값 반환

**포함 내용**:

- RecInput L
- RecInput R
- Playback L
- Playback R

**반환**: 4개의 float 값

**예제**:

```
/meters ,s meters/12
```

---

### /meters/13

**설명**: METERS 페이지 미터 값 반환 (간소화 버전)

**포함 내용**:

- 32 input channels
- 8 aux returns
- 4x2 st fx returns

**반환**: 48개의 float 값

**예제**:

```
/meters ,s meters/13
```

---

### /meters/14

**설명**: 일부 Effects 전용 (예: Precision Limiter, Combinator, Stereo Fair Compressor)

**반환**: 80개의 float 값

**예제**:

```
/meters ,s meters/14
```

---

### /meters/15

**설명**: RTA 및 일부 Effects 전용 (예: Dual GEQ, Stereo GEQ)

**반환**: 50개의 32-bit 값 (단일 OSC blob)

**특수 형식**: **Little-endian coded short integers**

**데이터 포맷**:

- 100개의 연속된 little-endian short ints 반환
- 범위: `[0x8000, 0x0000]`
- 각 short int 값은 RTA dB 레벨을 나타냄 (범위: [-128.0, 0.0])
- **변환 공식**: `float_value = short_int / 256.0`

**예제 값**:

- `0x08000c0` (short int) → 두 개의 값:
    - `0x8000` → -128.0 dB (변환 후)
    - `0xc000` → -64.0 dB (변환 후)
- `0x40e0ffff` (short int) → 두 개의 연속 RTA 값:
    - `-31.75dB`
    - `-0.004dB`

**클리핑 표시**: Short int 값 `0x0000` (또는 `0.0db`) → 신호 클리핑 발생

**주파수 대응표** (100개 short ints → 100개 주파수):

| Hz     | Hz     | Hz     | Hz     | Hz     | Hz     | Hz     | Hz     | Hz     | Hz     |
| ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| 20     | 21     | 22     | 24     | 26     | 28     | 30     | 32     | 34     | 36     |
| 39     | 42     | 45     | 48     | 52     | 55     | 59     | 63     | 68     | 73     |
| 78     | 84     | 90     | 96     | 103    | 110    | 118    | 127    | 136    | 146    |
| 156    | 167    | 179    | 192    | 206    | 221    | 237    | 254    | 272    | 292    |
| 313    | 335    | 359    | 385    | 412    | 442    | 474    | 508    | 544    | 583    |
| 625    | 670    | 718    | 769    | 825    | 884    | 947    | 1.02K  | 1.09K  | 1.17K  |
| 1.25K  | 1.34K  | 1.44K  | 1.54K  | 1.65K  | 1.77K  | 1.89K  | 2.03K  | 2.18K  | 2.33K  |
| 2.50K  | 2.68K  | 2.87K  | 3.08K  | 3.30K  | 3.54K  | 3.79K  | 4.06K  | 4.35K  | 4.67K  |
| 5.00K  | 5.36K  | 5.74K  | 6.16K  | 6.60K  | 7.07K  | 7.58K  | 8.12K  | 8.71K  | 9.33K  |
| 10.00K | 10.72K | 11.49K | 12.31K | 13.20K | 14.14K | 15.16K | 16.25K | 17.41K | 18.66K |

**예제**:

```
/meters ,s meters/15
```

---

### /meters/16

**설명**: Comp 및 Automix 전용

**반환**: 48개의 32-bit 값 (단일 OSC blob)

**특수 형식**: **Little-endian coded short integers**

**데이터 구성**:

**첫 44개 값** (32-bit 값들):

- 32 channel gate gains
- 32 channel comp gains
- 16 bus comp gains
- 6 matrix comp gains
- 2 (L/R and Mono) comp gains

**데이터 포맷**:

- Little-endian coded short ints
- 각 short int 값은 floating-point 레벨 나타냄
- 범위: `[0, 1.0]`
- **변환 공식**: `float_value = short_int / 32767.0`

**마지막 4개 float 값**:

- 8 automix (채널 01...08) gains
- Log₂(value) × 256으로 인코딩된 연속 shorts

**예제**:

```
/meters ,s meters/16
```

## 실제 사용 예제

### 기본 미터링

```bash
# 모든 입력 채널 미터링
/meters ,s meters/0

# 채널별 상세 미터링 (게이트, 다이나믹스 포함)
/meters ,s meters/1

# 믹스 버스 미터링
/meters ,s meters/2
```

### 특정 채널 스트립 미터링

```bash
# 채널 1의 4가지 미터 값
/meters ,si meters/6 0

# 채널 17의 4가지 미터 값
/meters ,si meters/6 16

# Bus master 1의 미터 값
/meters ,si meters/6 48
```

### 콘솔 VU 미터

```bash
# 채널 1-16 + mix bus 1-8
/meters ,sii meters/5 0 1

# 채널 17-32 + mix bus 9-16
/meters ,sii meters/5 1 2

# aux/fx returns + matrixes
/meters ,sii meters/5 2 3
```

### 업데이트 빈도 조절

```bash
# 빠른 업데이트 (50ms 간격, 약 200회/10초)
/meters ,si meters/6 0 1

# 중간 속도 (500ms 간격, 약 20회/10초)
/meters ,si meters/6 0 10

# 느린 업데이트 (4초 간격, 약 3회/10초)
/meters ,si meters/6 0 80
```

### RTA 분석

```bash
# RTA 데이터 수신 (100개 주파수 밴드)
/meters ,s meters/15
```

## 미터 값 해석

### 일반 Float 미터 (meters/0~14)

- **범위**: `[0.0, 1.0]`
- **의미**: 선형 오디오 레벨
- **0.0**: 무음 또는 -∞ dB
- **1.0**: Full-scale (0 dBFS)
- **>1.0**: 클리핑 (최대 8.0 = +18 dBfs, 내부 헤드룸)

**dB 변환 예시**:

```
float_to_db(value) = 20 × log₁₀(value)

0.001 → -60 dB
0.01  → -40 dB
0.1   → -20 dB
0.5   → -6 dB
0.75  → -2.5 dB
1.0   → 0 dBFS
```

### RTA Short Int 값 (meters/15)

- **범위**: `[0x8000, 0x0000]` (little-endian short)
- **의미**: RTA dB 레벨
- **변환**: `dB = short_int / 256.0`
- **결과 범위**: `[-128.0 dB, 0.0 dB]`
- **클리핑**: `0x0000` = 0.0 dB → 신호 클리핑

### Comp/Automix Short Int 값 (meters/16)

- **범위**: `[0, 0x7FFF]` (little-endian short)
- **의미**: Gain reduction 또는 level
- **변환**: `float = short_int / 32767.0`
- **결과 범위**: `[0.0, 1.0]`

## 주의사항

1. **Little-endian vs Big-endian**
    - OSC 표준: Big-endian
    - Meter blob floats: **Little-endian**
    - RTA/Comp shorts: **Little-endian**

2. **타임아웃 관리**
    - 모든 `/meters` 명령은 10초 후 자동 만료
    - 지속적인 미터링을 위해 9초마다 재전송 권장

3. **버퍼 오버플로우**
    - 50ms 업데이트 주기는 매우 빠름
    - WiFi 연결에서는 패킷 손실 가능
    - `time_factor`를 높여 업데이트 빈도 조절

4. **데이터 크기**
    - `/meters/1`: 96 floats × 4 bytes = 384 bytes
    - `/meters/4`: 82 floats × 4 bytes = 328 bytes
    - `/meters/15`: 50 shorts × 2 bytes = 100 bytes (100개 RTA 값)

5. **채널 ID 매핑** (`/meters/6`):
    ```
    0-31:   Input channels 1-32
    32-39:  Aux returns 1-8
    40-47:  FX returns 1-8
    48-63:  Bus masters 1-16
    64-69:  Matrixes 1-6
    70-71:  Main LR
    ```

## 참고 자료

- [client-initiated-messages.md](./client-initiated-messages.md) - 클라이언트 메시지 목록
- [server-replies.md](./server-replies.md) - 서버 응답 목록
- [examples.md](./examples.md) - 실제 예제 모음
- [OSC-Protocal.md](../OSC-Protocal.md) - OSC 프로토콜 핵심 가이드
