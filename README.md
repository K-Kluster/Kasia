# Getting started

## Build the cipher wasm package

Install Rust locally, and install `wasm-pack` using `cargo install wasm-pack`.

- `cd ./cipher`
- `wasm-pack build --target web --release -d ../cipher-wasm`

Install NodeJs locally.

- Download (or build yourself) [WASM precompiled binaries](https://github.com/kaspanet/rusty-kaspa/releases) from the latest release asset (kaspa-wasm-\*) and uncompress them into `./wasm`
- `npm i`
- `npm run dev`
