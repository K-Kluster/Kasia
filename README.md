# Kasia: Secure, Decentralized, and Fast Messaging

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/K-Kluster/Kasia)

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
   git clone https://github.com/K-Kluster/Kasia.git --recurse-submodules
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

      :warning: Due to a **needed** feature that still isn't included within the official wasm package, you will need to use [this wasm package instead](https://github.com/IzioDev/rusty-kaspa/releases/tag/v1.0.1-beta1).

   - Extract the contents of `kaspa-wasm32-sdk/web/kaspa/*` into the `Kasia/wasm/` directory.

5. **Install Node.js Dependencies and vendors**

   ```bash
   npm run submodule:init
   npm install
   ```

### Refresh submodules
```bash
git submodule update --init --recursive
```

### Running Kasia Locally

To start Kasia locally, run:

```bash
npm run dev
```

You can also configure environment variables by copying the `.env.dist` file to `.env` and modifying the variables as needed. Here are some example configurations:

```bash
# mainnet, testnet-10 or testnet-12
VITE_DEFAULT_KASPA_NETWORK=mainnet
VITE_ALLOWED_KASPA_NETWORKS=mainnet,testnet-10,testnet-12
VITE_DISABLE_PASSWORD_REQUIREMENTS=true
# info, warn, error, silent
VITE_LOG_LEVEL=info

# if unset, the public indexers will be used
VITE_INDEXER_MAINNET_URL=
VITE_INDEXER_TESTNET_URL=
```

### Testnet-12
Note: Running testnet-12 will require downloading the wasm-sdk from a build artifact. If this is something you want to do - contact on discord for help.

## Historical Messages
For UX purposes, Kasia team built [Kasia Indexer](https://github.com/K-Kluster/kasia-indexer), while not required, it offers cross-device synchronization capabilities. In short, it scans the Kaspa network continuously and store the Kasia protocol messages.

For maximum sovergnty, it is recommended to run your own indexer, it has very-few hardware requirements thanks to its well-architectured design, it easily can handle 3,000 transactions per second.

The application itself only use it to retreieve data when a wallet session opens.

## Public Infrastructure
To allow easier on-boarding, Kluster hosts [Kasia Public Infrastructure](https://github.com/K-Kluster/infrastructure), at the time of writing, it contains:
* Kaspa nodes
* Kasia indexers
* A few other plateform utils

## Contributing

We welcome contributions from everyone! If you're interested in contributing to Kasia, please read our [Contributing Guide](CONTRIBUTING.md) for detailed instructions on how to get started.


## Community and Support

- **Discord**: Join our community on [Discord](https://discord.gg/ssB46MXzRU)
- **X (Twitter)**: Follow us on [X](https://x.com/kasiamessaging)

## Donations

Kasia is a Kluster's initiave operated by four individuals at the moment:
- [Ernie](https://github.com/HocusLocusTee)
- [AuzGhosty](https://github.com/AuzGhosty)
- [KaspaSilver](https://github.com/KaspaSilver)
- [IzioDev](https://github.com/IzioDev)

Each one of these members constitued a multisig wallet with a 3/4 signature rule.
This means funds cannot move if there is no supermajority (75%) that agrees on the movement.

Infrastructure costs are published on Kluster's Discord on a monthly basis (invoices given), currently approximating $80 per month.
In addition to that, we've bought an Apple developer environment (~$550) to support the upcoming iOS version.

Currently, all of the costs are supported by Kluster's members. If you appreciate this initiative and you want to help it, please consider donating to this address:
* `kaspa:prx5q93j3m96htms5s4rkhk3awkf86jrrkcl2ssgsqdx4thyqcfmgjpgq2rj9`

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.
