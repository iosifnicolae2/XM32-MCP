# Client Initiated Messages (Client → X32 Console)

X32/M32 콘솔로 클라이언트가 전송하는 메시지 목록입니다.

## 기본 정보 조회

### Info Request

| Operation    | OSC Address | Parameters | Comments                              |
| ------------ | ----------- | ---------- | ------------------------------------- |
| Info request | `/info`     | None       | Server responds with `/info` message  |
|              | `/xinfo`    | None       | Server responds with `/xinfo` message |

### Status Request

| Operation      | OSC Address | Parameters | Comments                               |
| -------------- | ----------- | ---------- | -------------------------------------- |
| Status request | `/status`   | None       | Server responds with `/status` message |

## 파라미터 제어

### Set X32 Parameter

| Operation         | OSC Address             | Parameters                               | Comments                                                                                                                                                   |
| ----------------- | ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set X32 parameter | `<OSC Address Pattern>` | `<string \| int \| float \| blob value>` | Sets the value of a console parameter, e.g.: `/ch/01/mix/fader~~~,f~~<float>`<br>If it exists and value is in range, the new value takes place in the X32. |

**예제:**

```
/ch/01/mix/fader ,f 0.75
/bus/01/mix/on ,i 1
/ch/01/config/name ,s "Vocal"
```

### Get X32 Parameter

| Operation         | OSC Address             | Parameters | Comments                                                                                                                                                                   |
| ----------------- | ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get X32 parameter | `<OSC Address Pattern>` | None       | Requests the value of a console parameter, e.g. `/ch/01/mix/fader~~~~`<br>If it exists, the current value is echoed back by server, e.g.: `/ch/01/mix/fader~~~,f~~<float>` |

**예제:**

```
Request:  /ch/01/mix/fader
Response: /ch/01/mix/fader ,f 0.75
```

## X32node 제어

### Set X32 Node Data

| Operation         | OSC Address | Parameters | Comments                                                                                                                                                                                          |
| ----------------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set X32 node data | `/`         | `<string>` | Updates the values of a set of console parameters. A full set of X32node values can be sent to the server as plain text and matching `/node` formats, e.g.: `/~~~,s~~prefs/iQ/01 none Linear 0~~` |

### Get X32 Node Data

| Operation         | OSC Address | Parameters | Comments                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get X32 node data | `/node`     | `<string>` | Requests the values of a set of console parameters, e.g.: `/node~~~,s~~prefs/iQ/01~~~~`<br>The current values for the full set corresponding to the request are returned by the server in plain text (string of characters, ending with a linefeed), e.g.: `node~~~,s~~/-prefs/iQ/01 none Linear 0\n~~~~` |

## 미터링

### Get X32 Meters

| Operation      | OSC Address | Parameters                                                                                                   | Comments                                                                                                                                                                                                                                                                  |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get X32 meters | `/meters`   | `<string>`<br>`<optional int: chn_meter_id>`<br>`<optional int: grp_meter_id>`<br>`<optional int: priority>` | Results in regular updates meter values as a single binary blob. Timeout is 10 seconds, e.g. `/meters ,s meters/1` will return bursts of 96 float meter values (32 input, 32 gate and 32 dynamic gain reductions) for 10s.<br>See "Meter requests" for additional details |

**예제:**

```
/meters ,s meters/0    # 기본 미터링
/meters ,s meters/1    # 입력/게이트/다이나믹 미터링 (96 floats)
```

## 구독 (Subscription)

### Subscribe to Data

| Operation                  | OSC Address  | Parameters                | Comments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscribe to data from X32 | `/subscribe` | `<string> <optional int>` | Client describes to X32 server what information it is interested in receiving, and at which frequency the update is reported, until a timeout of 10 seconds is reached.<br><br>**예제:**<br>`/subscribe ,s /-stat/solosw/01`<br>또는<br>`/subscribe ,si /-stat/solosw/01 1`<br>Will report about 200 updates of the state of solo switch for channel 01 over the span of 10s.<br><br>`/subscribe ,si /-stat/solosw/01 50`<br>Will report about 4 updates of the state of solo switch for channel 01 |

**Time Factor 표:**

| Factor | Updates (10초 동안) |
| ------ | ------------------- |
| 0      | ~200회              |
| 1      | ~200회              |
| 10     | ~20회               |
| 50     | ~4회                |

### Subscribe to Data Formats

| Operation                 | OSC Address        | Parameters                         | Comments                                                                                                                                                                                                                                                |
| ------------------------- | ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscribe to data formats | `/formatsubscribe` | `<string>...<string><int>...<int>` | Client describes to X32 server what information it is interested in receiving, e.g.:<br>`/formatsubscribe ,ssiii /mfm_c /dca/*/on 1 8 8`<br>Reports a blob of 36 bytes for about 10s.<br>The last `<int>` specifies the frequency factor of the report. |

### Subscribe to Batch Data

| Operation                           | OSC Address       | Parameters                         | Comments                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscribe to batch data from server | `/batchsubscribe` | `<string>...<string><int>...<int>` | Client request from X32 server data to receive, e.g.:<br>`/batchsubscribe ,ssiii /x_meters_0 /meters/0 0 69 1`<br>Reports a blob of 70 floats for about 10s.<br><br>`/batchsubscribe ,ssiii /x_meters_8 /meters/8 0 5 1`<br>Reports a blob of 6 floats for about 10s.<br><br>`/batchsubscribe ,ssiii /mfm_a /mix/on 0 63 8`<br>Reports a blob of 276 bytes for about 10s.<br><br>The last `<int>` specifies the frequency factor of the report. |

## 구독 관리

### Renew Data Request

| Operation          | OSC Address | Parameters | Comments                                                                                                                |
| ------------------ | ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Renew data request | `/renew`    | `<string>` | Requests renewing of data described in `<string>`, e.g.<br>`/renew~~,s~~meters/5~~~~`<br>`/renew~~,s~~hidden/states~~~` |

### Register for Updates

| Operation            | OSC Address | Parameters | Comments                                                                                                                                                                                                                         |
| -------------------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register for updates | `/xremote`  | None       | **Triggers X32 to send all parameter changes to maximum four active clients.** Timeout is 10 seconds, e.g. the `/xremote` command has to be renewed before this delay in order to avoid losing information from The X32 console. |

**중요:**

- `/xremote`는 **최대 4개의 활성 클라이언트**를 지원합니다
- 10초 타임아웃이 있으므로 9초마다 재전송 권장
- X32/M32에서 발생하는 모든 파라미터 변경사항을 수신합니다

## 메시지 포맷 예제

### 읽기 (Get) 요청

```
/ch/01/mix/fader          # 파라미터 없음
/bus/05/mix/on            # 파라미터 없음
/main/st/mix/fader        # 파라미터 없음
```

### 쓰기 (Set) 요청

```
/ch/01/mix/fader ,f 0.75        # float 값
/ch/01/mix/on ,i 1              # integer 값
/ch/01/config/name ,s "Vocal"   # string 값
/ch/01/eq/1 ,ifff 2 0.265 0.5 0.465  # 복수 값
```

### 구독 (Subscribe) 요청

```
/subscribe ,s /-stat/solosw/01          # 기본 (약 200회)
/subscribe ,si /-stat/solosw/01 1       # 약 200회
/subscribe ,si /-stat/solosw/01 10      # 약 20회
/subscribe ,si /-stat/solosw/01 50      # 약 4회
```

### X32node 요청

```
# 읽기
/node ,s ch/01

# 쓰기
/ ,s ch/01 newname 10 CY 1
```

## 주의사항

1. **타임아웃**: 모든 구독 명령(`/subscribe`, `/formatsubscribe`, `/batchsubscribe`, `/xremote`)은 10초 후 자동 만료
2. **갱신**: 10초 이내에 `/renew` 또는 같은 명령을 재전송하여 구독 유지
3. **클라이언트 제한**: `/xremote`는 최대 4개의 동시 클라이언트 지원
4. **응답 형식**: 서버는 요청받은 명령을 에코백하여 데이터 흐름 제어 지원
5. **파라미터 검증**: 범위를 벗어난 값은 거부되거나 가장 가까운 유효값으로 반올림

## 참고 자료

- [OSC-Protocal.md](../OSC-Protocal.md) - OSC 프로토콜 핵심 가이드
- [X32-OSC-Protocol-Summary.md](../X32-OSC-Protocol-Summary.md) - 전체 프로토콜 요약
