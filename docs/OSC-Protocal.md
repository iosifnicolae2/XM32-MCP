# X32/M32 OSC Protocol 핵심 가이드

## UDP 통신 기본 정보

- **포트**: UDP **10023** (X32/M32 기본값), UDP **10024** (XAir 시리즈)
- **프로토콜**: UDP (User Datagram Protocol)
- **통신 방식**: X32/M32가 UDP 10023에서 수신, 클라이언트가 사용한 포트로 응답 전송
- **데이터 형식**: Big-endian, 4-byte aligned/padded (null bytes로 패딩)
- **주의사항**: 
    - UDP는 패킷 손실을 보고하지 않으므로 버퍼 오버플로우 주의
    - WiFi(54Mbps)는 대량 데이터 전송 시 패킷 손실 가능
    - 100Mbps 유선 이더넷 연결 권장

## OSC 메시지 구조

```
[Address Pattern (4-byte aligned)] + [Type Tag String (4-byte aligned)] + [Arguments (4-byte aligned)]
```

### Type Tags

| Type | 설명 | 범위 |
|------|------|------|
| `i` | 32-bit signed integer | 정수 값 |
| `f` | 32-bit signed float | 0.0 ~ 1.0 |
| `s` | String | null-terminated |
| `b` | Blob | 임의의 바이너리 데이터 |

### 메시지 예제

```
/info~~~,~~~                          (인자 없음)
/ch/01/config/name~~,s~~name~~~~     (문자열 1개)
/ch/01/eq/1 ,ifff [2] [0.26] [0.5] [0.46]  (int 1개 + float 3개)
```

## X32/M32 OSC Protocol Parameters

### Type Rules (Get/Set Parameter) 및 데이터 포맷팅

X32/M32는 OSC 1.0 규격을 따르며, 4가지 기본 OSC type tags를 구현합니다: **int32**, **float32**, **string**, **blob**

#### 데이터 형식 규칙

- **모든 파라미터는 big-endian 및 4-byte aligned/padded** (OSC 스펙 준수)
- **패딩은 null bytes(\0)로 수행**
- **Float 파라미터는 0.0 ~ 1.0 범위**여야 함
  ```
  0.0 → 0x00000000 (big-endian)
  0.5 → 0x3f000000 (big-endian)
  1.0 → 0x3f800000 (big-endian)
  ```
- **Integer 및 float 파라미터는 signed 32-bit 값**
- **String은 null-terminated**여야 함
- **Enum 파라미터는 string 또는 integer로 전송 가능**
- **Boolean 파라미터는 enum 타입 {OFF, ON} 또는 OSC integer {0, 1}로 매핑**
- **Blob(임의의 바이너리 데이터)은 섹션별로 특정 규칙을 따름**

#### OSC 명령 구조

OSC 명령은 다음과 같이 구성됩니다:
- **4-byte padded OSC message (Address Pattern)**
- **4-byte padded type tag string**
- **Non-empty type tag string이 있을 경우, 하나 이상의 4-byte aligned/padded arguments**

#### OSC 1.0 호환성

OSC 1.0 스펙은 구형 OSC 구현에서 type tag string을 생략할 수 있다고 언급하며, X32/M32는 이를 지원합니다.

**예제: Type tag 없는 명령 (구형 OSC 형식)**
```
/info~~~              (OSC 1.0 비준수지만 X32/M32에서 허용됨)
/info~~~,~~~          (OSC 1.0 준수 - 권장)
```

#### Float 타입 특별 고려사항

X32/M32는 float 범위 [0.0, 1.0]의 **이산(discrete) 값의 부분집합**만 인식합니다.

- 적용되는 목적지에 따라 "알려진" 값이 결정됨
- 단계 수(steps)가 인식되는 값을 결정
- **예제**: EQ 주파수 - `[20.0, 20k, 201]`
  - 20Hz ~ 20kHz 범위가 201개의 이산 값으로 분할됨
  - 동일하게 [0.0, 1.0] 범위도 201개의 "알려진" float 값으로 분할됨
- **범위를 벗어난 float 값은 가장 가까운 알려진 값으로 반올림됨**

이는 특히 다음 경우에 유용합니다:
- `/node` 명령으로 반환된 텍스트 형식 데이터를 float 값으로 변환할 때
- MIDI Sysex 명령 내에서 OSC 데이터를 텍스트로 전송해야 할 때

#### Enum 타입 특별 고려사항

Enum은 **문자열(string) 또는 정수(integer)로 전송 가능**합니다.

**예제: 채널 01 게이트 모드 설정**

Enum 타입: `{EXP2, EXP3, EXP4, GATE, DUCK}`

"GATE" 설정 방법 1 - 문자열:
```
/ch/01/gate/mode~~~~,s~~GATE~~~~
```
16진수:
```
2f63682f30312f676174652f6d6f6465000000002c7300004741544500000000
```

"GATE" 설정 방법 2 - 정수(인덱스 3):
```
/ch/01/gate/mode~~~~,i~~[3]
```
16진수:
```
2f63682f30312f676174652f6d6f6465000000002c69000000000003
```

**주의**: 이는 "enum" 타입에만 적용됩니다. 예를 들어, dynamics의 key source 설정은 0~64 사이의 "int" 값만 허용합니다:
```
/ch/[01-32]/dyn/keysrc    (int 0~64만 허용, enum 아님)
```

### 명령 예제 모음

#### 간단한 OSC 명령 (인자 없음)

OSC 1.0 준수:
```
/info~~~,~~~
```

구형 형식 (X32/M32에서 허용됨):
```
/info~~~
```

#### 단일 인자를 가진 OSC 명령

```
/ch/01/config/name~~,s~~name~~~~
```

#### 복수 인자를 가진 OSC 명령

```
/ch/01/eq/1 ,ifff [2] [0.2650] [0.5000] [0.4648]
```

이는 다음 4개의 간단한 명령과 동일합니다:
```
/ch/01/eq/1/t~~~,i~~[2]
/ch/01/eq/1/f~~~,f~~[0.2650]
/ch/01/eq/1/g~~~,f~~[0.5000]
/ch/01/eq/1/q~~~,f~~[0.4648]
```

#### 16진수 표현

마지막 명령의 16진수 표현:
```
/  c  h  /  0  1  /  e  q  /  1  /  q  ~  ~  ~  ,  f  ~  ~ [0.4648]
2f 63 68 2f 30 31 2f 65 71 2f 31 2f 71 00 00 00 2c 66 00 00 3eedfa44
```

- `3eedfa44`: 0.4648의 32bit float, big-endian 표현
- `~`: null character (\0)

### X32/M32 응답 예제

#### `/info` 응답

**요청:**
```
/info~~~,~~~
```

**응답 (X32 Standard):**
```
/info~~~,ssss~~~V2.05~~~osc-server~~X32~2.10~~~~
```
48 bytes 응답

**다양한 모델별 응답:**
```
X32 Standard:  /info~~~,ssss~~~V2.05~~~osc-server~~X32~2.12~~~~
X32 Rack:      /info~~~,ssss~~~V2.05~~~osc-server~~X32RACK~2.12~~~~
X32 Compact:   /info~~~,ssss~~~V2.05~~~osc-server~~X32C~~2.12~~~~
X32 Producer:  /info~~~,ssss~~~V2.05~~~osc-server~~X32P~2.12~~~~
X32 Core:      /info~~~,ssss~~~V2.05~~~osc-server~~X32CORE~2.12~~~~
M32 Standard:  /info~~~,ssss~~~V2.05~~~osc-server~~M32~2.12~~~~
M32 Compact:   /info~~~,ssss~~~V2.05~~~osc-server~~M32C~2.12~~~~
M32 Rack:      /info~~~,ssss~~~V2.05~~~osc-server~~M32R~2.12~~~~
```

**XAir 시리즈 (UDP 포트 10024 사용):**
```
XR18: /info~~~,ssss~~~V0.04~~~XR18-1D-DA-B4~~~XR18~~~~1.12~~~~
XR16: /info~~~,ssss~~~V0.04~~~XR16-1D-DA-B4~~~XR16~~~~1.12~~~~
XR12: /info~~~,ssss~~~V0.04~~~XR12-1D-DA-B4~~~XR12~~~~1.12~~~~
```

#### `/status` 응답

**요청:**
```
/status~,~~~
```

**응답:**
```
/status~,sss~~~~active~~192.168.0.64~~~~osc-server~~
```
52 bytes 응답

#### 파라미터 Get 응답

**요청:**
```
/fx/4/par/23~~~~,~~~
```

**응답:**
```
/fx/4/par/23~~~~,f~~[float 0.5]
```
24 bytes 응답

16진수:
```
2f66782f342f7061722f3233000000002c6600003f000000
```

## 통신 모드

#### 즉시형 (Immediate) & 지연형 (Deferred) 업데이트 모드

- **즉시형 (Immediate)**은 클라이언트가 특정 OSC 주소로 명령을 보내면 콘솔이 **즉시 응답하거나 즉시 값을 반영**하는 방식이며, 단일 요청에 대해 **여러 개의 응답 메시지가 반환될 수 있음**
    - 예: `/showdump` 는 한 번만 요청해도 설정 정보가 **여러 패킷으로 연속 반환**됨
- **지연형 (Deferred)**은 `/xremote`, `/subscribe`, `/batchsubscribe` 와 같이 **10초 동안 상태 변화를 푸시**하는 모드를 의미하며, 클라이언트는 **10초 이내에 갱신 명령을 재전송**해야 푸시가 유지됨
    - 서버 UI 또는 다른 클라이언트에서 변경이 발생하면 자동으로 알림 전송
    - 이 방식은 **값 그 자체보다 이벤트 스트림**이 중요할 때 사용됨 (예: 페이더 이동, 뮤트 상태 변경 등)
- 즉, 네트워크에서 **대역폭을 점유하는 요소는 데이터 크기 자체가 아니라** **연속 이벤트 발생 빈도와 클라이언트 연결 유지 방식이며**, 전송되는 값은 대부분 **단순 float 또는 enum**이므로 데이터 무게는 매우 가벼움

#### Connection (세션 유지 개념)

##### 다중 클라이언트 관리

- X32/M32는 **여러 UDP 클라이언트를 동시에** 지원
- 각 클라이언트는 독립적으로 `/xremote` 또는 `/subscribe` 등록 필요
- 한 클라이언트의 변경사항이 모든 등록된 클라이언트에게 전파됨

##### `/xremote`

- **서버(콘솔)에서 발생하는 모든 상태 변화**를 **클라이언트로 푸시**하는 모드
- **10초 타임아웃**이 있기 때문에 **9초 간격 정도로 재전송**해야 지속됨
- 페이더 이동, 뱅크 변경, 화면 업데이트 등 전체 UI 변화를 스트리밍
- 용도: **전체 UI 변화 스트림** 수신

```
Client: /xremote~~~,~~~  (파라미터 없음)
Server: (변경사항 자동 푸시, 10초 동안)
```

##### `/subscribe`

- **특정 OSC 주소**를 지정하여 **해당 파라미터 변경 이벤트만** 푸시받는 모드
- `time_factor` 인자를 통해 **업데이트 빈도(분해능)**를 조절 가능
    - `0` → 약 200회 업데이트 (10초 동안)
    - `1` → 약 100회 업데이트
    - `10` → 약 20회 업데이트
    - `50` → 약 4회 업데이트
- 용도: **선택적·타겟 변화 스트림** 수신

```
/subscribe ,si /ch/01/mix/on 10
(채널 1의 On/Off 상태를 10초 동안 약 20회 업데이트 수신)
```

##### `/batchsubscribe`

- 여러 파라미터를 한 번에 구독하며, 와일드카드(`*`) 사용 가능
- 예: `/ch/**/mix/on` (모든 채널의 On/Off 상태)

#### 읽기 (Read) Vs 쓰기 (Write)

- OSC 주소에 **인자를 포함하지 않으면** → 해당 파라미터를 **읽기 (Read) 요청**
- 동일한 OSC 주소에 **인자를 포함하면** → 해당 파라미터에 **값 쓰기 (Write)**
    - 예:
        - 읽기: `/ch/01/mix/fader`
        - 쓰기: `/ch/01/mix/fader ,f 0.75`

#### Message Address Pattern

- X32/M32에서는 OSC 주소 문자열(Address String)이 **기능(API 엔드포인트)** 역할을 하며, 아래와 같은 **주소 패밀리(카테고리)**를 통해 믹서의 모든 파라미터에 접근한다
    - 이 목록은 "OSC가 지원해야 하는 주소 체계"가 아니라 **X32가 제공하는 제어 가능 명령 집합**이다
- 따라서 **OSC = 메시지 포맷**, **Address Pattern = X32 제어 명령 API**로 이해한다

```
<OSC Address Pattern> ::=
/ | /-action | /add | /auxin | /batchsubscribe | /bus | /ch | /config |
/copy | /dca | /delete | /formatsubscribe | /fx | /fxrtn | /headamp |
/info | /-insert | /-libs | /load | /main/m | /main/st | /meters | /mtx |
/node | /outputs | /-prefs | /rename | /renew | /save | /-show | /showdump |
/-snap | /-stat | /status | /subscribe | /-undo | /unsubscribe | /-urec |
/-usb | /xinfo | /xremote | /xremoteinfo
```

### 주요 명령어

| 명령어 | 설명 | 예제 |
|--------|------|------|
| `/info` | X32/M32 버전 정보 조회 | `/info~~~,~~~` |
| `/status` | 현재 상태 조회 | `/status~,~~~` |
| `/xremote` | 자동 업데이트 활성화 (10초) | `/xremote~~~,~~~` |
| `/subscribe` | 특정 파라미터 구독 | `/subscribe ,si /ch/01/mix/on 1` |
| `/batchsubscribe` | 여러 파라미터 일괄 구독 | `/batchsubscribe ,ssiii /ch/**/mix/on 0 31 1` |
| `/renew` | 구독 갱신 | `/renew ,s /meters/5` |
| `/unsubscribe` | 구독 해제 | `/unsubscribe` |
| `/node` | X32node 데이터 조회 | `/node~~~,s~~ch/01` |
| `/` | X32node 데이터 쓰기 | `/~~~,s~~ch/01 newname 10 CY 1` |
| `/meters/[0-16]` | 미터링 데이터 요청 | `/meters/0` |

### Address Pattern 구조 예제

- 위 Address Pattern은 **각 섹션별로 하위 경로(Sub-address)와 파라미터 구조를 가짐**
- Address Pattern은 믹서 내부 파라미터 구조를 그대로 **트리 형태로 노출한 제어 API**라고 볼 수 있다

#### 채널(Channel) 제어

```
/ch/[01-32]/config/name        - 채널 이름
/ch/[01-32]/config/icon        - 채널 아이콘
/ch/[01-32]/config/color       - 채널 색상
/ch/[01-32]/mix/fader          - 페이더 레벨
/ch/[01-32]/mix/on             - 채널 On/Off (Mute)
/ch/[01-32]/mix/pan            - 패닝
/ch/[01-32]/eq/[1-4]/*         - EQ 설정 (4밴드)
/ch/[01-32]/gate/*             - Gate 설정
/ch/[01-32]/dyn/*              - Dynamics/Compressor 설정
```

#### 버스(Bus) 제어

```
/bus/[01-16]/mix/fader         - 버스 페이더
/bus/[01-16]/mix/on            - 버스 On/Off
/bus/[01-16]/mix/pan           - 버스 패닝
```

#### 메인 출력

```
/main/st/mix/fader             - 메인 스테레오 페이더
/main/st/mix/on                - 메인 스테레오 On/Off
/main/m/mix/fader              - 메인 모노 페이더
/main/m/mix/on                 - 메인 모노 On/Off
```

### 명령 형식 표현

문서 및 CLI상에서 명령은 두 가지 형식으로 표현될 수 있다:

#### 사람이 읽는 형식
```
<command> <format> <parameters>
/ch/01/mix/fader ,f [0.7]
```

#### 실제 전송되는 네트워크 패킷 형식 (OSC 4-byte padding 포함)
```
<command>~~~<format>~~~<parameter> <parameter> …
/ch/01/mix/fader~~~ ,f~~~ [0.7]
```
- 여기서 `~~~`는 **OSC 문자열 padding(\0)에 의해 생기는 바이트 단위 정렬 공간**을 나타내는 개념적 표현