# X32/M32 OSC Protocol Summary

## 개요

X32 및 M32는 Behringer와 Midas에서 제작한 디지털 믹서 제품군으로, **OSC (Open Sound Control)** 프로토콜을 사용하여 원격 제어가 가능합니다.

이 문서는 "UNOFFICIAL X32-M32 OSC REMOTE PROTOCOL" (version 4.02-01, Jan 12, 2020) 문서를 기반으로 작성되었습니다.

## UDP 통신 규격

### 기본 포트 정보

- **X32/M32 제품군**: UDP 포트 **10023** (기본값)
- **XAir 시리즈**: UDP 포트 **10024**

### 통신 방식

```
Client (앱/태블릿/PC) ──UDP 10023──> X32/M32 Server
Client                <──UDP Reply── X32/M32 Server
```

- **프로토콜**: UDP (User Datagram Protocol)
- **서버 포트**: 10023 (X32/M32가 수신)
- **클라이언트 포트**: 클라이언트가 사용한 포트로 응답 수신
- **신뢰성**: UDP는 데이터 순서 보장이나 재전송을 보장하지 않음
- **네트워크**: 이더넷 연결 권장 (WiFi 사용 시 버퍼 오버플로우 주의)

### UDP 통신 주의사항

1. **버퍼 오버플로우**: UDP는 패킷 손실을 보고하지 않으므로 주의 필요
2. **WiFi 제한**: 54Mbps WiFi는 대량의 데이터 전송 시 패킷 손실 가능
3. **권장 연결**: 100Mbps 유선 이더넷 연결 권장
4. **타임아웃**: 대부분의 구독 명령은 10초 후 자동 만료

## OSC 메시지 포맷

### 기본 구조

OSC 메시지는 다음과 같이 구성됩니다:

```
[OSC Address Pattern (4-byte aligned)] + [Type Tag String (4-byte aligned)] + [Arguments (4-byte aligned)]
```

모든 데이터는:

- **Big-endian** 형식
- **4-byte aligned/padded** (null bytes로 패딩)
- OSC 1.0 스펙 준수

### OSC Type Tags

| Type Tag | 설명                    | 범위/형식              |
| -------- | ----------------------- | ---------------------- |
| `i`      | 32-bit integer (signed) | 정수 값                |
| `f`      | 32-bit float (signed)   | 0.0 ~ 1.0              |
| `s`      | String                  | null-terminated        |
| `b`      | Blob                    | 임의의 바이너리 데이터 |

### 메시지 예제

#### 1. 간단한 요청 (인자 없음)

```
/info~~~,~~~
```

- `~~~`는 null byte (\0)를 나타냄
- Type tag string: `,~~~` (빈 인자)

응답 예제 (X32 Standard):

```
/info~~~,ssss~~~V2.05~~~osc-server~~X32~2.12~~~~
```

#### 2. 단일 인자

```
/ch/01/config/name~~,s~~name~~~~
```

- Address: `/ch/01/config/name`
- Type tag: `,s` (string 1개)
- Argument: `name`

#### 3. 복수 인자

```
/ch/01/eq/1 ,ifff [2] [0.2650] [0.5000] [0.4648]
```

- Address: `/ch/01/eq/1`
- Type tag: `,ifff` (int 1개 + float 3개)
- Arguments: `2, 0.2650, 0.5000, 0.4648`

#### 4. 16진수 표현 예제

```
/ch/01/eq/1/q~~~,f~~[0.4648]
```

16진수:

```
2f63682f30312f65712f312f710000002c6600003eedfa44
```

분해:

- `2f63682f30312f65712f312f71000000`: `/ch/01/eq/1/q` + padding
- `2c660000`: `,f` + padding
- `3eedfa44`: 0.4648 (big-endian float)

### Float 값 인코딩

Float는 0.0 ~ 1.0 범위의 32-bit big-endian 값:

```
0.0 = 0x00000000
0.5 = 0x3f000000
1.0 = 0x3f800000
```

### Enum 타입

Enum은 문자열 또는 정수로 전송 가능:

```
/ch/01/gate/mode~~~~,s~~GATE~~~~
```

또는

```
/ch/01/gate/mode~~~~,i~~[3]
```

## 통신 모드

### 1. Immediate Mode (즉시 모드)

클라이언트가 요청하면 서버가 즉시 응답하는 방식:

```
Client: /ch/01/mix/fader~~~,~~~
Server: /ch/01/mix/fader~~~,f~~[0.8250]
```

### 2. Deferred Mode (지연 모드)

`/xremote` 명령을 통해 변경사항을 자동으로 수신:

```
Client: /xremote~~~,~~~
Server: (자동으로 변경사항 전송, 10초 타임아웃)
```

- X32/M32에서 변경사항이 발생하면 자동으로 클라이언트에 전송
- 10초마다 `/xremote` 명령을 재전송하여 유지 필요

### 3. Subscription Mode (구독 모드)

특정 파라미터의 변경을 주기적으로 수신:

```
/subscribe ,si /ch/01/mix/on 10
```

- 10초 동안 약 20회 업데이트 수신 (factor가 10일 경우)

## 주요 OSC 명령어

| 명령어           | 설명                        | 예제                             |
| ---------------- | --------------------------- | -------------------------------- |
| `/info`          | X32/M32 버전 정보 조회      | `/info~~~,~~~`                   |
| `/status`        | 현재 상태 조회              | `/status~,~~~`                   |
| `/xremote`       | 자동 업데이트 활성화 (10초) | `/xremote~~~,~~~`                |
| `/subscribe`     | 특정 파라미터 구독          | `/subscribe ,si /ch/01/mix/on 1` |
| `/node`          | X32node 데이터 조회         | `/node~~~,s~~ch/01`              |
| `/meters/[0-16]` | 미터링 데이터 요청          | `/meters/0`                      |
| `/ch/[01-32]/*`  | 채널 관련 명령              | `/ch/01/mix/fader~~~,f~~[0.75]`  |
| `/bus/[01-16]/*` | 버스 관련 명령              | `/bus/01/mix/on~~~,i~~[1]`       |
| `/main/st/*`     | 메인 스테레오 명령          | `/main/st/mix/fader~~~,f~~[0.8]` |

## 다중 클라이언트 관리

- X32/M32는 **여러 UDP 클라이언트를 동시에** 지원
- 각 클라이언트는 독립적으로 `/xremote` 등록 필요
- 한 클라이언트의 변경사항이 모든 등록된 클라이언트에게 전파됨

## Address Pattern 구조

주요 Address Pattern:

```
/ | /-action | /add | /auxin | /batchsubscribe | /bus | /ch | /config |
/copy | /dca | /delete | /formatsubscribe | /fx | /fxrtn | /headamp |
/info | /-insert | /-libs | /load | /main/m | /main/st | /meters | /mtx |
/node | /outputs | /renew | /save | /-show | /-snap | /-stat | /status |
/subscribe | /unsubscribe | /undo | /urec | /xinfo | /xremote | /xremoteinfo
```

### 채널 구조 예제

```
/ch/[01-32]/config/name        - 채널 이름
/ch/[01-32]/mix/fader          - 페이더 레벨
/ch/[01-32]/mix/on             - 채널 On/Off
/ch/[01-32]/mix/pan            - 패닝
/ch/[01-32]/eq/[1-4]/*         - EQ 설정
/ch/[01-32]/gate/*             - Gate 설정
/ch/[01-32]/dyn/*              - Dynamics 설정
```

## 참고 자료

- OSC 스펙: http://opensoundcontrol.org/
- X32_Command 유틸리티: https://sites.google.com/site/patrickmaillot/x32
- GitHub 저장소: https://github.com/pmaillot/X32-Behringer

## 예제 코드 (C/UDP 연결)

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <string.h>

// X32 연결 설정
int Xfd;
struct sockaddr_in Xip;

// X32 IP 및 포트
char Xip_str[] = "192.168.0.64";
char Xport_str[] = "10023";

// UDP 소켓 생성
Xfd = socket(PF_INET, SOCK_DGRAM, IPPROTO_UDP);

// 서버 주소 구조체 설정
memset(&Xip, 0, sizeof(Xip));
Xip.sin_family = AF_INET;
Xip.sin_port = htons(atoi(Xport_str));
inet_pton(AF_INET, Xip_str, &Xip.sin_addr);

// 데이터 전송
sendto(Xfd, buffer, len, 0, (struct sockaddr*)&Xip, sizeof(Xip));

// 데이터 수신
recvfrom(Xfd, buffer, bufsize, 0, NULL, NULL);
```

## 라이선스 및 면책

이 문서는 비공식 문서로, Behringer나 Midas의 공식 지원을 받지 않습니다. 정확성을 위해 노력했으나 오류나 부정확한 내용이 있을 수 있습니다.

원본 문서: Patrick-Gilles Maillot (version 4.02-01, Jan 12, 2020)
