// Minimal AssemblyScript module for inspecting emitted Wasm text.
// Compile this with asc and inspect the output using wasm2wat or --textFile.

import {
  detect_escapable_u64_swar_safe,
  detect_escapable_u64_swar_unsafe,
} from "../../../../json-as/assembly/serialize/swar/string";

export function safe(block: u64): u64 {
  return detect_escapable_u64_swar_safe(block);
}

export function unsafe(block: u64): u64 {
  return detect_escapable_u64_swar_unsafe(block);
}
