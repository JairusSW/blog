.PHONY: install build build-c build-wasm run run-c run-wasm inspect-c inspect-wasm clean

CFLAGS := -Ofast -march=native -mtune=native -flto -DNDEBUG -fomit-frame-pointer -Wall -Wextra

install:
	@bash ./install-deps.sh

build: build-c build-wasm

build-c:
	@mkdir -p build
	@cc $(CFLAGS) -o build/bench-c bench.c

build-wasm:
	@mkdir -p build
	@npm run build:wasm

run: run-c run-wasm

run-c: build-c
	@./build/bench-c

run-wasm: build-wasm
	@npm run run:wasm:wasmer

inspect-c:
	@mkdir -p build
	@cc $(CFLAGS) -S -o build/bench.s bench.c

inspect-wasm: build-wasm
	@wasm2wat build/wasm-bench.wasm > build/wasm-bench.wat

clean:
	@rm -rf build node_modules package-lock.json
