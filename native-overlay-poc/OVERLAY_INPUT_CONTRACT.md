# Proposed input contract

The native proof must consume **logical commands**, not raw HID reports.

```json
{"version":1,"type":"overlay","action":"show","context":"game:forza-horizon-6"}
{"version":1,"type":"nav","direction":"right"}
{"version":1,"type":"select"}
{"version":1,"type":"dismiss"}
```

The existing launcher is the sole owner of DualSense discovery, Bluetooth wake, haptics, gesture recognition, and focus state. The final bridge should be a local named pipe. Until then, use a test-only mock sender.

Required state transitions: `Yielded -> Overlay -> Yielded` and `Yielded -> Home`.

The proof must never independently infer console state from focus events.

