# Multiple Client Management

## 개요

단일 X32/M32는 여러 동시 UDP 클라이언트로부터/로 업데이트를 관리할 수 있습니다.

## 기본 원칙

X32 레벨에서 발생하는 변경사항과 동기화를 유지하기 위해서는, 데스크 자체의 변경이든 다른 원격 클라이언트에 의해 요청된 변경이든, **각 클라이언트는 X32로부터 업데이트를 수신하기 위해 등록**해야 합니다.

이는 `/xremote` 명령을 통해 가능합니다.

## /xremote 명령

### 기본 동작

`/xremote` 명령을 수신한 후, X32는 다음과 같은 변경사항을 클라이언트에 업데이트합니다:

**전송되는 변경사항:**

- Fader movements (페이더 움직임)
- Bank change requests (뱅크 변경 요청)
- Screen updates (화면 업데이트)
- 모든 파라미터 변경사항

**전송되지 않는 변경사항:**

- 연결된 클라이언트에 직접적인 영향을 주지 않는 변경
- X32/M32에 엄격히 로컬인 변경사항
- 예: Standard X32/M32의 view 버튼 중 하나를 누르는 것

### 타임아웃 및 갱신

**중요**: 데스크 업데이트 등록은 `/xremote` 명령 후 **10초 동안만 유지**됩니다.

- **타임아웃**: 10초
- **권장 갱신 간격**: 9초마다 `/xremote` 재전송
- **미갱신 시**: 업데이트 프로세스가 자동으로 중단되고 정보 손실

### 명령 형식

```
/xremote~~~,~~~
```

**파라미터**: 없음

## 사용 예제

### 기본 등록

```javascript
// 초기 등록
send('/xremote');

// 9초마다 갱신
setInterval(() => {
    send('/xremote');
}, 9000);
```

### Python 예제

```python
import socket
import time
from threading import Thread

def keep_xremote_alive(sock, x32_address):
    """X32 연결을 유지하는 함수"""
    while True:
        # /xremote 명령 전송
        message = b'/xremote\x00\x00\x00,\x00\x00\x00'
        sock.sendto(message, x32_address)
        # 9초 대기
        time.sleep(9)

# UDP 소켓 생성
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
x32_address = ('192.168.1.100', 10023)

# 백그라운드 스레드에서 /xremote 유지
thread = Thread(target=keep_xremote_alive, args=(sock, x32_address), daemon=True)
thread.start()

# 메인 루프에서 업데이트 수신
while True:
    data, addr = sock.recvfrom(1024)
    # 업데이트 처리
    print(f"Received: {data}")
```

### Node.js 예제

```javascript
const dgram = require('dgram');
const osc = require('osc-min');

const client = dgram.createSocket('udp4');
const X32_HOST = '192.168.1.100';
const X32_PORT = 10023;

// /xremote 전송 함수
function sendXremote() {
    const buf = osc.toBuffer({
        address: '/xremote',
        args: []
    });
    client.send(buf, 0, buf.length, X32_PORT, X32_HOST);
}

// 초기 등록
sendXremote();

// 9초마다 갱신
setInterval(sendXremote, 9000);

// 업데이트 수신
client.on('message', (msg, rinfo) => {
    try {
        const oscMsg = osc.fromBuffer(msg);
        console.log('Received:', oscMsg.address, oscMsg.args);
    } catch (err) {
        console.error('OSC parse error:', err);
    }
});
```

## 다른 구독 방법

`/xremote` 외에도 다른 명령들이 서버로부터 정기적인 업데이트를 수신할 수 있습니다.

자세한 내용은 **"Subscribing to X32/M32 Updates"** 단락을 참조하세요.

| 명령               | 설명               | 타임아웃 |
| ------------------ | ------------------ | -------- |
| `/subscribe`       | 특정 파라미터 구독 | 10초     |
| `/formatsubscribe` | 포맷 기반 구독     | 10초     |
| `/batchsubscribe`  | 일괄 파라미터 구독 | 10초     |
| `/meters`          | 미터 데이터 구독   | 10초     |

## 다중 클라이언트 시나리오

### 동시 연결

X32/M32는 여러 클라이언트의 동시 연결을 지원합니다.

**시나리오 예시:**

```
Client A (iPad)  ──┐
Client B (PC)    ──┼──> X32/M32 Console
Client C (Phone) ──┘
```

### 변경사항 전파

1. **Client A**가 채널 1의 페이더를 변경

    ```
    Client A → X32: /ch/01/mix/fader ,f 0.75
    ```

2. **X32**가 변경사항을 모든 등록된 클라이언트에 전송

    ```
    X32 → Client A: /ch/01/mix/fader ,f 0.75
    X32 → Client B: /ch/01/mix/fader ,f 0.75
    X32 → Client C: /ch/01/mix/fader ,f 0.75
    ```

3. **물리적 콘솔**에서 변경 시에도 동일
    ```
    [User touches fader on X32]
    X32 → Client A: /ch/01/mix/fader ,f 0.80
    X32 → Client B: /ch/01/mix/fader ,f 0.80
    X32 → Client C: /ch/01/mix/fader ,f 0.80
    ```

### 동기화 유지

모든 클라이언트는 독립적으로 `/xremote`를 유지해야 합니다:

```
Time    Client A        Client B        Client C
0s      /xremote        /xremote        /xremote
9s      /xremote        /xremote        /xremote
18s     /xremote        (timeout!)      /xremote
27s     /xremote        (no updates)    /xremote
```

**Client B**는 18초에 `/xremote`를 재전송하지 않아 업데이트 수신이 중단됩니다.

## 구현 권장사항

### 1. 견고한 타이머 구현

```typescript
class X32Connection {
    private xremoteTimer?: NodeJS.Timeout;

    startXremote() {
        this.sendXremote();
        this.xremoteTimer = setInterval(() => {
            this.sendXremote();
        }, 9000); // 9초마다
    }

    stopXremote() {
        if (this.xremoteTimer) {
            clearInterval(this.xremoteTimer);
            this.xremoteTimer = undefined;
        }
    }

    sendXremote() {
        const msg = osc.toBuffer({ address: '/xremote', args: [] });
        this.socket.send(msg, X32_PORT, X32_HOST);
    }
}
```

### 2. 연결 상태 모니터링

```typescript
class X32Connection {
    private lastUpdateTime: number = 0;

    onMessage(msg: Buffer) {
        this.lastUpdateTime = Date.now();
        // 메시지 처리
    }

    checkConnection() {
        const now = Date.now();
        if (now - this.lastUpdateTime > 15000) {
            // 15초
            console.warn('No updates received - connection may be lost');
            // 재연결 로직
        }
    }
}
```

### 3. 재연결 로직

```typescript
class X32Connection {
    reconnect() {
        console.log('Reconnecting to X32...');
        this.stopXremote();

        // 잠시 대기 후 재시작
        setTimeout(() => {
            this.startXremote();
            console.log('Reconnected to X32');
        }, 1000);
    }
}
```

### 4. 에러 핸들링

```typescript
class X32Connection {
    sendXremote() {
        try {
            const msg = osc.toBuffer({ address: '/xremote', args: [] });
            this.socket.send(msg, X32_PORT, X32_HOST, err => {
                if (err) {
                    console.error('Failed to send /xremote:', err);
                    this.reconnect();
                }
            });
        } catch (error) {
            console.error('Error creating /xremote message:', error);
        }
    }
}
```

## 클라이언트 애플리케이션 예제

### X32Saver (Linux/Windows)

실제 사용 예제는 다음 애플리케이션들을 참조하세요:

1. **X32Saver.c** (Linux 또는 Windows)
    - `/xremote`를 사용한 연결 유지
    - 주기적인 갱신 구현

2. **X32 data echo in Go**
    - Go 언어 구현
    - 동시성 처리 예제

자세한 내용은 문서 끝부분의 예제 섹션을 참조하세요.

## 네트워크 고려사항

### UDP 특성

- **비연결성**: 연결 상태를 추적하지 않음
- **신뢰성 없음**: 패킷 손실 가능
- **순서 보장 없음**: 메시지가 순서대로 도착하지 않을 수 있음

### 권장 사항

1. **유선 연결 사용**
    - WiFi보다 100Mbps 이더넷 권장
    - 패킷 손실 최소화

2. **버퍼 관리**
    - UDP 수신 버퍼 크기 충분히 설정
    - 오버플로우 방지

3. **타임아웃 처리**
    - 9초보다 약간 짧은 간격으로 `/xremote` 전송
    - 네트워크 지연 고려

4. **에러 복구**
    - 연결 끊김 감지
    - 자동 재연결 구현

## 디버깅 팁

### 로깅

```typescript
class X32Connection {
    private debug = true;

    sendXremote() {
        if (this.debug) {
            console.log(`[${new Date().toISOString()}] Sending /xremote`);
        }
        // 전송 로직
    }

    onMessage(msg: Buffer) {
        if (this.debug) {
            console.log(`[${new Date().toISOString()}] Received:`, msg);
        }
        // 처리 로직
    }
}
```

### 연결 테스트

```bash
# /xremote 전송 테스트 (OSC 유틸리티 사용)
oscsend 192.168.1.100 10023 /xremote

# 응답 모니터링
oscdump 10023
```

### Wireshark 분석

1. UDP 포트 10023 필터: `udp.port == 10023`
2. `/xremote` 메시지 확인
3. 9초 간격 확인
4. 응답 메시지 패턴 분석

## 성능 최적화

### 선택적 구독

모든 변경사항을 받는 대신 필요한 것만 구독:

```typescript
// 전체 업데이트 대신
// send("/xremote");

// 특정 채널만 구독
send('/subscribe ,si /ch/01/mix/fader 10');
send('/subscribe ,si /ch/02/mix/fader 10');
```

### 배치 처리

```typescript
class X32Connection {
    private updateQueue: Array<OSCMessage> = [];

    onMessage(msg: OSCMessage) {
        this.updateQueue.push(msg);
    }

    processBatch() {
        // 100ms마다 배치 처리
        setInterval(() => {
            if (this.updateQueue.length > 0) {
                const batch = this.updateQueue.splice(0);
                this.processMessages(batch);
            }
        }, 100);
    }
}
```

## 참고 자료

- [client-initiated-messages.md](./client-initiated-messages.md) - `/xremote` 상세 정보
- [server-replies.md](./server-replies.md) - 서버 응답 형식
- [examples.md](./examples.md) - 구현 예제
- [OSC-Protocal.md](../OSC-Protocal.md) - OSC 프로토콜 가이드

## 요약

- **등록**: 모든 클라이언트는 `/xremote` 명령으로 업데이트 수신 등록
- **타임아웃**: 10초 (9초마다 재전송 권장)
- **동시 연결**: 여러 클라이언트 동시 지원
- **변경 전파**: 모든 등록된 클라이언트에게 자동 전송
- **로컬 변경**: 콘솔에서의 직접 변경도 전송됨
- **네트워크**: 유선 연결 권장, UDP 특성 고려
