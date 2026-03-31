#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bench-lib.h"

enum {
  PAYLOAD_BYTES = 512 * 1024,
  PAYLOAD_CODE_UNITS = PAYLOAD_BYTES / 2,
  ITERATIONS = 60000,
  WARMUP_ITERATIONS = ITERATIONS / 10,
};

static inline uint64_t detect_escapable_u64_swar_safe(uint64_t block) {
  uint64_t lo = block & UINT64_C(0x00ff00ff00ff00ff);
  uint64_t ascii_mask =
    ((lo - UINT64_C(0x0020002000200020))
      | ((lo ^ UINT64_C(0x0022002200220022)) - UINT64_C(0x0001000100010001))
      | ((lo ^ UINT64_C(0x005c005c005c005c)) - UINT64_C(0x0001000100010001)))
    & (UINT64_C(0x0080008000800080) & ~lo);

  uint64_t hi_mask =
    ((block - UINT64_C(0x0100010001000100)) & ~block & UINT64_C(0x8000800080008000))
    ^ UINT64_C(0x8000800080008000);

  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}

static inline uint64_t detect_escapable_u64_swar_unsafe(uint64_t block) {
  uint64_t lo = block & UINT64_C(0x00ff00ff00ff00ff);
  uint64_t ascii_mask =
    ((lo - UINT64_C(0x0020002000200020))
      | ((lo ^ UINT64_C(0x0022002200220022)) - UINT64_C(0x0001000100010001))
      | ((lo ^ UINT64_C(0x005c005c005c005c)) - UINT64_C(0x0001000100010001)))
    & (UINT64_C(0x0080008000800080) & ~lo);

  return ascii_mask | (block & UINT64_C(0xff00ff00ff00ff00));
}

typedef uint64_t (*detect_fn)(uint64_t);

static int is_special(uint16_t code) {
  return code == 34 || code == 92 || code < 32 || code > 0x7f;
}

static uint32_t scan_escapes(const uint16_t *src, detect_fn detect) {
  const uint64_t *blocks = (const uint64_t *)src;
  const size_t block_count = PAYLOAD_CODE_UNITS / 4;
  uint32_t hits = 0;

  for (size_t i = 0; i < block_count; i++) {
    hits += (uint32_t)__builtin_popcountll(detect(blocks[i]));
  }

  for (size_t i = block_count * 4; i < PAYLOAD_CODE_UNITS; i++) {
    hits += (uint32_t)is_special(src[i]);
  }

  return hits;
}

static uint32_t scanEscapesSafe(const uint16_t *src) {
  return scan_escapes(src, detect_escapable_u64_swar_safe);
}

static uint32_t scanEscapesUnsafe(const uint16_t *src) {
  return scan_escapes(src, detect_escapable_u64_swar_unsafe);
}

static uint16_t *makePlainPayload(void) {
  static const char base[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-+=/., ";
  const size_t n = sizeof(base) - 1;
  uint16_t *dst = malloc(PAYLOAD_CODE_UNITS * sizeof(uint16_t));
  if (!dst) return NULL;

  for (size_t i = 0; i < PAYLOAD_CODE_UNITS; i++) {
    dst[i] = (uint16_t)base[i % n];
  }

  return dst;
}

static const uint16_t *currentPayload = NULL;
static uint32_t (*currentScan)(const uint16_t *) = NULL;

static void routine(void) {
  uint32_t sink = currentScan(currentPayload);
  (void)blackbox(&sink, sizeof(sink));
}

static uint16_t *makeEscapedPayload(void) {
  static const uint16_t base[] = {
    'a','b','c','d','e','f','g','h','"', 'i','j','k','l','m','n','o','p',
    '\\','q','r','s','t','u','v','w','x','\n','y','z','\t','\b','\f','\r',
    0x0001, 0x001f
  };
  const size_t n = sizeof(base) / sizeof(base[0]);
  uint16_t *dst = malloc(PAYLOAD_CODE_UNITS * sizeof(uint16_t));
  if (!dst) return NULL;

  for (size_t i = 0; i < PAYLOAD_CODE_UNITS; i++) {
    dst[i] = base[i % n];
  }

  return dst;
}

int main(void) {
  uint16_t *plain = makePlainPayload();
  uint16_t *escaped = makeEscapedPayload();
  if (!plain || !escaped) {
    fprintf(stderr, "allocation failed\n");
    free(plain);
    free(escaped);
    return 1;
  }

  puts("Native C SWAR detector throughput");

  currentPayload = plain;
  currentScan = scanEscapesSafe;
  bench("safe / plain", routine, ITERATIONS, PAYLOAD_BYTES);

  currentPayload = plain;
  currentScan = scanEscapesUnsafe;
  bench("unsafe / plain", routine, ITERATIONS, PAYLOAD_BYTES);

  currentPayload = escaped;
  currentScan = scanEscapesSafe;
  bench("safe / escaped", routine, ITERATIONS, PAYLOAD_BYTES);

  currentPayload = escaped;
  currentScan = scanEscapesUnsafe;
  bench("unsafe / escaped", routine, ITERATIONS, PAYLOAD_BYTES);

  free(plain);
  free(escaped);
  return 0;
}
