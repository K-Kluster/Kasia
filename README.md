# How To Run Kasia Locally

## Getting started

Make sure you have the latest version of git downloaded - https://git-scm.com/downloads

Verify your installation by running in your terminal:

```
git version
```

If you see a version number you have installed git successfully.

## Install Rust

  <details>
  <summary>On Linux</summary>

1.  Install general prerequisites

    ```bash
    sudo apt install curl git build-essential libssl-dev pkg-config
    ```

2.  Install Protobuf (required for gRPC)

    ```bash
    sudo apt install protobuf-compiler libprotobuf-dev #Required for gRPC
    ```

3.  Install the clang toolchain (required for RocksDB and WASM secp256k1 builds)

    ```bash
    sudo apt-get install clang-format clang-tidy \
    clang-tools clang clangd libc++-dev \
    libc++1 libc++abi-dev libc++abi1 \
    libclang-dev libclang1 liblldb-dev \
    libllvm-ocaml-dev libomp-dev libomp5 \
    lld lldb llvm-dev llvm-runtime \
    llvm python3-clang
    ```

4.  Install the [rust toolchain](https://rustup.rs/).

          If you do not have a browser but only the command line interface run:

         ```
         curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
         ```

           If you already have rust installed, update it by running:

         ```
         rustup update
         ```

    </details>

<details>
  <summary>On Windows</summary>
  
  
  
1.Install the [rust toolchain](https://rustup.rs/)

2.If you already have rust installed, update it by running:

```
rustup update
```

   </details>

   <details>
  <summary>Building on Mac OS</summary>

1.  Install Protobuf (required for gRPC)
    ```bash
    brew install protobuf
    ```
2.  Install llvm.

          The default XCode installation of `llvm` does not support WASM build targets.

    To build WASM on MacOS you need to install `llvm` from homebrew (at the time of writing, the llvm version for MacOS is 16.0.1).
    `bash
      brew install llvm
      `

          **NOTE:** Homebrew can use different keg installation locations depending on your configuration. For example:
          - `/opt/homebrew/opt/llvm` -> `/opt/homebrew/Cellar/llvm/16.0.1`
          - `/usr/local/Cellar/llvm/16.0.1`

          To determine the installation location you can use `brew list llvm` command and then modify the paths below accordingly:
          ```bash
          % brew list llvm
          /usr/local/Cellar/llvm/16.0.1/bin/FileCheck
          /usr/local/Cellar/llvm/16.0.1/bin/UnicodeNameMappingGenerator
          ...
          ```
          If you have `/opt/homebrew/Cellar`, then you should be able to use `/opt/homebrew/opt/llvm`.

          Add the following to your `~/.zshrc` file:
          ```bash
          export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
          export LDFLAGS="-L/opt/homebrew/opt/llvm/lib"
          export CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
          export AR=/opt/homebrew/opt/llvm/bin/llvm-ar
          ```

          Reload the `~/.zshrc` file
          ```bash
          source ~/.zshrc
          ```

3.  Install the [rust toolchain](https://rustup.rs/)

    If you already have rust installed, update it by running:

    ```
    rustup update
    ```

    </details>

## Install WASM

```
cargo install wasm-pack
```

## Clone the repository

```
git clone https://github.com/K-Kluster/Kasia.git
```

```
cd Kasia
```

## Build the cipher wasm package

```
cd cipher
```

```
wasm-pack build --target web --release -d ../cipher-wasm
```

```
cd ..
```

## Install Node.js

Download Node.js: https://nodejs.org/en/download

## Install Kaspa WASM Files

- Download the latest `kaspa-wasm32-sdk-v1.0.0.zip` or build the [WASM precompiled binaries](https://github.com/kaspanet/rusty-kaspa/releases) yourself.
- Extract the contents of `kaspa-wasm32-sdk/web/kaspa` into the `Kasia/wasm` directory.

## Run Kasia Locally

```
npm install
```

```
npm run dev
```

Additionally, it is possible to configure variables via `.env`, simply copy the environment variable file template from `.env.dist` to `.env` and start modify them.
