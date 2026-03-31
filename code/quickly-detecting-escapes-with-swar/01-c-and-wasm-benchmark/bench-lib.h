#ifndef BENCH_LIB_H
#define BENCH_LIB_H

#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

typedef struct {
  const char *language;
  const char *description;
  double elapsed;
  uint64_t bytes;
  uint64_t operations;
  double mbps;
  double gbps;
} BenchResult;

static BenchResult result = {
  .language = "c",
  .description = NULL,
  .elapsed = 0.0,
  .bytes = 0,
  .operations = 0,
  .mbps = 0.0,
  .gbps = 0.0,
};

static double bench_now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}

static const char *format_number(uint64_t n) {
  static char buffer[4][64];
  static unsigned slot = 0;
  char digits[32];
  size_t len = 0;
  char *out;
  size_t comma_offset;

  slot = (slot + 1) & 3;
  out = buffer[slot];

  snprintf(digits, sizeof(digits), "%" PRIu64, n);
  len = strlen(digits);
  comma_offset = len % 3;

  size_t j = 0;
  for (size_t i = 0; i < len; i++) {
    if (i > 0 && i >= comma_offset && (i - comma_offset) % 3 == 0) out[j++] = ',';
    out[j++] = digits[i];
  }
  out[j] = '\0';
  return out;
}

static void *blackbox(const void *value, size_t size) {
  static unsigned char area[64];
  if (size > sizeof(area)) size = sizeof(area);
  memcpy(area, value, size);
  return area;
}

static uint64_t round_to_u64(double value) {
  if (value <= 0.0) return 0;
  return (uint64_t)(value + 0.5);
}

static void bench(const char *description, void (*routine)(void), uint64_t ops, uint64_t bytes_per_op) {
  uint64_t warmup = ops / 10;
  double start;
  double end;
  double elapsed;
  double ops_per_second;
  double mb_per_sec = 0.0;

  printf(" - Benchmarking %s\n", description);

  while (--warmup) {
    routine();
  }

  start = bench_now_ms();

  {
    uint64_t count = ops;
    while (count--) {
      routine();
    }
  }

  end = bench_now_ms();
  elapsed = end - start;
  if (elapsed < 1.0) elapsed = 1.0;

  ops_per_second = (double)(ops * 1000) / elapsed;

  printf(
    "   Completed benchmark in %sms at %s ops/s",
    format_number(round_to_u64(elapsed)),
    format_number(round_to_u64(ops_per_second))
  );

  if (bytes_per_op > 0) {
    uint64_t total_bytes = bytes_per_op * ops;
    mb_per_sec = (double)total_bytes / (elapsed / 1000.0) / (1000.0 * 1000.0);
    printf(" @ %sMB/s", format_number(round_to_u64(mb_per_sec)));
  }

  putchar('\n');
  putchar('\n');

  result.language = "c";
  result.description = description;
  result.elapsed = elapsed;
  result.bytes = bytes_per_op;
  result.operations = ops;
  result.mbps = mb_per_sec;
  result.gbps = mb_per_sec / 1000.0;
}

#endif
