# Server Replies or Server Initiated Messages (X32 Console → Client)

X32/M32 콘솔에서 클라이언트로 전송하는 응답 및 자동 메시지 목록입니다.

## 정보 조회 응답

### Info Request Response

| Operation    | OSC Address | Parameters                                                                                                    | Comments                                                                                                                            |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Info request | `/info`     | `<string server_version>`<br>`<string server_name>`<br>`<string console_model>`<br>`<string console_version>` | Returns names and version numbers, e.g.:<br>`/info~~~,ssss~~~V2.05~~~osc-server~~X32C~~2.08~~~~`<br>(`~` stands for null character) |

**응답 예제:**

```
/info~~~,ssss~~~V2.05~~~osc-server~~X32~2.12~~~~
/info~~~,ssss~~~V2.05~~~osc-server~~X32RACK~2.12~~~~
/info~~~,ssss~~~V2.05~~~osc-server~~X32C~~2.12~~~~
/info~~~,ssss~~~V2.05~~~osc-server~~X32P~2.12~~~~
/info~~~,ssss~~~V2.05~~~osc-server~~M32~2.12~~~~
/info~~~,ssss~~~V2.05~~~osc-server~~M32C~2.12~~~~
```

**파라미터 설명:**

- `server_version`: 서버 버전 (예: "V2.05")
- `server_name`: 서버 이름 (예: "osc-server")
- `console_model`: 콘솔 모델 (예: "X32", "X32C", "M32", "X32RACK")
- `console_version`: 콘솔 펌웨어 버전 (예: "2.12")

### XInfo Request Response

| Operation     | OSC Address | Parameters                                                                                                      | Comments                                                                                             |
| ------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| XInfo request | `/xinfo`    | `<string network_address>`<br>`<string network_name>`<br>`<string console_model>`<br>`<string console_version>` | Returns network information, e.g.:<br>`/xinfo~~,ssss~~~192.168.1.62~~~~X32-02-4A-53~~~~X32~3.04~~~~` |

**응답 예제:**

```
/xinfo~~,ssss~~~192.168.1.62~~~~X32-02-4A-53~~~~X32~3.04~~~~
```

**파라미터 설명:**

- `network_address`: IP 주소 (예: "192.168.1.62")
- `network_name`: 네트워크 이름/호스트명 (예: "X32-02-4A-53")
- `console_model`: 콘솔 모델 (예: "X32")
- `console_version`: 콘솔 버전 (예: "3.04")

### Status Request Response

| Operation      | OSC Address | Parameters                                                          | Comments                                                                                                                          |
| -------------- | ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Status request | `/status`   | `<string state>`<br>`<string IP_address>`<br>`<string server_name>` | Returns console status and IP, e.g.:<br>`/status~,sss~~~~active~~192.168.0.64~~~~osc-server~~`<br>(`~` stands for null character) |

**응답 예제:**

```
/status~,sss~~~~active~~192.168.0.64~~~~osc-server~~
```

**파라미터 설명:**

- `state`: 콘솔 상태 (예: "active")
- `IP_address`: 콘솔 IP 주소 (예: "192.168.0.64")
- `server_name`: 서버 이름 (예: "osc-server")

## 콘솔 변경사항 알림

### Console Changes

| Operation       | OSC Address             | Parameters                 | Comments                                                                                                                                                                                                                                                                |
| --------------- | ----------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console changes | `<OSC Address Pattern>` | `<string \| int \| float>` | **If `/xremote` is active**, the X32 console echoes the value of a console parameter in response to a set command from another client or X32 parameter change, e.g.<br><br>`/-stat/solosw/01~~~~,i~~[1]`<br>`/-stat/solo~,i~~[1]`<br>`/ch/01/mix/01/pan~~~,f~~[1.0000]` |

**중요:**

- `/xremote`가 활성화되어 있어야 자동으로 변경사항을 수신합니다
- 다른 클라이언트의 명령 또는 X32 콘솔에서 직접 변경한 사항을 모두 포함합니다
- 페이더 이동, 뱅크 변경, 화면 업데이트 등 모든 UI 변경사항이 전송됩니다

**예제:**

콘솔에서 Solo 스위치를 켰을 때:

```
/-stat/solosw/01~~~~,i~~[1]
/-stat/solo~,i~~[1]
```

다른 클라이언트가 패닝을 변경했을 때:

```
/ch/01/mix/01/pan~~~,f~~[1.0000]
```

채널 페이더를 움직였을 때:

```
/ch/01/mix/fader~~~,f~~[0.7500]
```

채널 뮤트를 토글했을 때:

```
/ch/01/mix/on~~~,i~~[0]
```

## 파라미터 Get 응답

클라이언트가 파라미터를 조회(Get)하면, 서버는 같은 주소로 현재 값을 응답합니다.

**요청:**

```
/ch/01/mix/fader~~~,~~~
```

**응답:**

```
/ch/01/mix/fader~~~,f~~[0.8250]
```

**요청:**

```
/bus/05/mix/on~~~,~~~
```

**응답:**

```
/bus/05/mix/on~~~,i~~[1]
```

## 구독 데이터 응답

### Subscribe 응답

`/subscribe` 명령으로 특정 파라미터를 구독하면, 해당 파라미터가 변경될 때마다 자동으로 전송됩니다.

**구독 요청:**

```
/subscribe ,si /-stat/solosw/01 10
```

**응답 (10초 동안 약 20회):**

```
/-stat/solosw/01~~~~,i~~[0]
/-stat/solosw/01~~~~,i~~[1]
/-stat/solosw/01~~~~,i~~[0]
...
```

### BatchSubscribe 응답

`/batchsubscribe` 명령으로 여러 파라미터를 한 번에 구독하면, blob 형식으로 데이터가 전송됩니다.

**구독 요청:**

```
/batchsubscribe ,ssiii /x_meters_0 /meters/0 0 69 1
```

**응답:**

- 70개의 float 값을 포함하는 blob (약 10초 동안 전송)

### Meters 응답

`/meters` 명령으로 미터링 데이터를 요청하면, 정기적으로 blob 형식의 미터 값이 전송됩니다.

**요청:**

```
/meters ,s meters/1
```

**응답:**

- 96개의 float 미터 값 (32 input, 32 gate, 32 dynamic gain reductions)
- 약 10초 동안 bursts 형태로 전송

## X32node 응답

### Node 데이터 응답

`/node` 명령으로 X32node 데이터를 요청하면, 해당 노드의 전체 파라미터 세트가 문자열로 반환됩니다.

**요청:**

```
/node~~~,s~~ch/01~~~~
```

**응답:**

```
node~~~,s~~ch/01 "Vocal" 10 CY 1~~~~
```

응답은 plain text (string of characters, ending with linefeed) 형식입니다.

## 에코백 (Echo Back)

X32/M32는 수신한 명령을 에코백하여 데이터 흐름 제어를 지원합니다.

**클라이언트 전송:**

```
/ch/01/mix/fader ,f 0.75
```

**서버 에코백:**

```
/ch/01/mix/fader ,f 0.75
```

이를 통해 애플리케이션은:

1. 명령이 성공적으로 전송되었는지 확인
2. UDP 버퍼를 읽은 후 다음 명령 전송 (오버런 방지)
3. 데이터 흐름 제어

## 타임아웃 및 자동 만료

모든 구독 명령은 10초 후 자동으로 만료됩니다:

| 명령               | 타임아웃 | 갱신 방법                                         |
| ------------------ | -------- | ------------------------------------------------- |
| `/xremote`         | 10초     | 9초마다 `/xremote` 재전송                         |
| `/subscribe`       | 10초     | `/renew ,s <address>` 또는 `/subscribe` 재전송    |
| `/formatsubscribe` | 10초     | `/renew ,s <name>` 또는 `/formatsubscribe` 재전송 |
| `/batchsubscribe`  | 10초     | `/renew ,s <name>` 또는 `/batchsubscribe` 재전송  |
| `/meters`          | 10초     | `/meters` 재전송                                  |

## 응답 형식 요약

| 데이터 타입 | 형식                               | 예제                             |
| ----------- | ---------------------------------- | -------------------------------- |
| String      | null-terminated, 4-byte padded     | `"Vocal"~~~~`                    |
| Integer     | 32-bit signed, big-endian          | `[1]`, `[0]`                     |
| Float       | 32-bit signed, big-endian, 0.0~1.0 | `[0.7500]`, `[1.0000]`           |
| Blob        | Binary data, length-prefixed       | Meter data, batch subscribe data |

## 참고 자료

- [client-initiated-messages.md](./client-initiated-messages.md) - 클라이언트 → 서버 메시지
- [multiple-client-management.md](./multiple-client-management.md) - 다중 클라이언트 관리
- [OSC-Protocal.md](../OSC-Protocal.md) - OSC 프로토콜 핵심 가이드
