# Kasia: Secure, Decentralized, and Fast Messaging

<div align="center">
  <img src="public/kasia-logo-512.png" alt="Kasia Logo" width="200"/>
</div>

Kasia is an encrypted, decentralized, and fast peer-to-peer (P2P) messaging protocol and application. Built on top of Kaspa, Kasia ensures secure, private, and efficient communication without the need for a central server.

## Features

- **Encryption**: All messages are encrypted to ensure privacy and security.
- **Decentralization**: No central server controls the network, making it resistant to censorship and outages.
- **Speed**: Fast message delivery thanks to the underlying Kaspa technology.
- **Open Source**: The project is open-source, allowing anyone to review, modify, and contribute to the codebase.

## Getting Started

Follow these steps to run Kasia locally on your machine.

### Prerequisites

- **Git**: Make sure you have the latest version of Git installed. [Download Git](https://git-scm.com/downloads)
- **Rust**: Install the Rust toolchain. [Install Rust](https://www.rust-lang.org/tools/install)
- **Node.js**: Download and install Node.js. [Download Node.js](https://nodejs.org/en/download)

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/K-Kluster/Kasia.git
   cd Kasia
   ```

2. **Install WASM Pack**

   ```bash
   cargo install wasm-pack
   ```

3. **Build the Cipher WASM Package**

   ```bash
   npm run wasm:build
   ```

4. **Install Kaspa WASM Files**

   - Download the [latest `kaspa-wasm32-sdk-v1.0.0.zip`](https://github.com/kaspanet/rusty-kaspa/releases) or build the WASM modules yourself.
   - Extract the contents of `kaspa-wasm32-sdk/web/kaspa/*` into the `Kasia/wasm/` directory.

5. **Install Node.js Dependencies**

   ```bash
   npm install
   ```

### Running Kasia Locally

To start Kasia locally, run:

```bash
npm run dev
```

You can also configure environment variables by copying the `.env.dist` file to `.env` and modifying the variables as needed. Here are some example configurations:

```bash
# mainnet or testnet-10
VITE_DEFAULT_KASPA_NETWORK=mainnet
VITE_ALLOWED_KASPA_NETWORKS=mainnet,testnet-10
VITE_DISABLE_PASSWORD_REQUIREMENTS=true
# info, warn, error, silent
VITE_LOG_LEVEL=info
```

## Contributing

We welcome contributions from everyone! If you're interested in contributing to Kasia, please read our [Contributing Guide](CONTRIBUTING.md) for detailed instructions on how to get started.


## Community and Support

- **Discord**: Join our community on [Discord](https://discord.gg/ssB46MXzRU)
- **X (Twitter)**: Follow us on [X](https://x.com/kasiamessaging)

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.