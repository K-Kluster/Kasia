# Deterministic Asymmetric Aliases

**Version:** 3.0.0

## Overview

Kasia uses **deterministic asymmetric aliases** for private, off-chain message routing. Each conversation has two different 12-character aliases derived using ECDH + HKDF:

- **`myAlias`** - What you monitor for incoming messages
- **`theirAlias`** - Where you send outgoing messages

This asymmetric design enhances privacy by using different aliases in each direction, making it harder to link conversations on the blockchain.

## Quick Start

### Create a Conversation

**Option A: Traditional Handshake** (on-chain transaction)
```typescript
await messageStore.initiateHandshake(recipientAddress, amountSompi);
// Status: "pending" → "active" when recipient responds
```

**Option B: Discrete Conversation** (no transaction, immediate)
```typescript
await messageStore.createDiscreteConversation(recipientAddress);
// Status: "active" immediately
// Both parties must create independently
```

### Manually Derive Aliases

```typescript
import { deriveConversationAliases } from './utils/deterministic-alias';

const { myAlias, theirAlias } = deriveConversationAliases(
  myPrivateKey,
  theirKaspaAddress
);
```

## Key Concepts

### Asymmetric Derivation

```
Alice (talking to Bob):
  myAlias    = HKDF("chat" + shared_secret + ALICE_pubkey)[:6]   → "abc123"
  theirAlias = HKDF("chat" + shared_secret + BOB_pubkey)[:6]     → "def456"

Bob (talking to Alice):
  myAlias    = HKDF("chat" + shared_secret + BOB_pubkey)[:6]     → "def456"
  theirAlias = HKDF("chat" + shared_secret + ALICE_pubkey)[:6]   → "abc123"

Result:
  Alice's theirAlias === Bob's myAlias     ✓ (Alice → Bob routing works)
  Bob's theirAlias === Alice's myAlias     ✓ (Bob → Alice routing works)
  Alice's myAlias ≠ Bob's myAlias          ✓ (Privacy: different aliases)
```

### Monitoring vs Sending

| Alias | You | Them |
|-------|-----|------|
| **myAlias** | You monitor this | They send to this |
| **theirAlias** | You send to this | They monitor this |

**Remember:** 
- Messages are sent TO `theirAlias` 
- Messages are received ON `myAlias`

## Core Algorithm

### Step 1: ECDH Shared Secret
```rust
shared_secret = ECDH(my_private_key, their_public_key)
```

### Step 2: HKDF Context
```rust
// For myAlias (what I monitor)
context = "chat" || shared_secret || MY_xonly_pubkey

// For theirAlias (where I send)
context = "chat" || shared_secret || THEIR_xonly_pubkey
```

### Step 3: HKDF Expansion
```rust
hkdf = HKDF-SHA256(ikm: shared_secret, salt: none, info: context)
alias_bytes = hkdf.expand(6 bytes)
alias = hex(alias_bytes)  // 12 hex characters
```

**Critical Detail:** Uses **x-only public keys** (32 bytes) to avoid parity ambiguity. Both parties assume Even parity for ECDH computation, ensuring symmetric shared secrets.

## API Reference

### Rust (WASM)

```rust
// Derive my monitoring alias
pub fn derive_my_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError>

// Derive their sending alias
pub fn derive_their_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError>
```

### TypeScript

```typescript
// Individual derivation
function deriveMyAlias(myPrivateKey: string, theirAddress: string): string
function deriveTheirAlias(myPrivateKey: string, theirAddress: string): string

// Recommended: Derive both at once
function deriveConversationAliases(
  myPrivateKey: string,
  theirAddress: string
): { myAlias: string; theirAlias: string }
```

### Conversation Manager

```typescript
// Create discrete conversation (no handshake)
async createDiscreteConversation(recipientAddress: string): Promise<{
  conversation: Conversation;
  contact: Contact;
}>

// Get monitored aliases (returns myAlias for each active conversation)
getMonitoredConversations(): { alias: string; address: string }[]
```

### Messaging Store

```typescript
// Initiate handshake (traditional method)
initiateHandshake: async (recipientAddress: string, amountSompi: bigint) => Promise<void>

// Create discrete conversation (no transaction)
createDiscreteConversation: async (recipientAddress: string) => Promise<{
  conversationId: string;
  contactId: string;
}>
```

## Message Routing

### Sending Messages

```typescript
// Direct composer component automatically uses theirAlias
await send(conversation.theirAlias);

// In account service
await accountService.sendMessageWithContext({
  message: encryptedMessage,
  theirAlias: conversation.theirAlias,  // Recipient monitors this
  priorityFee,
});
```

**Protocol format:**
```
ciph_msg:1:comm:{theirAlias}:{base64_encrypted_data}
```

### Receiving Messages

```typescript
// Block processor checks incoming messages
const monitored = conversationManager.getMonitoredConversations();
// Returns: [{ alias: myAlias, address: recipientAddress }, ...]

// If incoming message targetAlias matches one of our myAliases
if (monitoredAliases.has(incomingMessage.targetAlias)) {
  // Process message for this conversation
}
```

## Discrete Conversations

### What Are They?

Discrete conversations allow two parties to communicate **without an on-chain handshake transaction**. Both parties independently create the conversation using the same deterministic aliases.

### When to Use

✅ **Use discrete conversations when:**
- You want zero-cost setup (no transaction fees)
- You need instant conversation activation
- You want no on-chain record of the handshake
- You've coordinated off-chain (e.g., shared addresses via QR code)

❌ **Don't use discrete conversations when:**
- You want to send initial KAS to enable recipient's first reply
- You prefer automatic conversation establishment
- The recipient doesn't know your address yet

### How They Work

1. **Alice creates discrete conversation:**
   ```typescript
   await messageStore.createDiscreteConversation(bobAddress);
   // Alice: myAlias = "abc123", theirAlias = "def456"
   ```

2. **Bob creates discrete conversation:**
   ```typescript
   await messageStore.createDiscreteConversation(aliceAddress);
   // Bob: myAlias = "def456", theirAlias = "abc123"
   ```

3. **Aliases match automatically:**
   - Alice sends to "def456" → Bob monitors "def456" ✓
   - Bob sends to "abc123" → Alice monitors "abc123" ✓

### UI Integration

In NewChatForm:
```tsx
<input
  type="checkbox"
  checked={discreteMode}
  onChange={(e) => setDiscreteMode(e.target.checked)}
/>
Discrete Conversation (no handshake required)

// When checked:
// - Handshake amount fields become disabled and grayed out
// - Conversation created via createDiscreteConversation()
// - Status immediately set to "active"
```

## Database Schema

```typescript
type Conversation = {
  id: string;                    // UUID
  myAlias: string;               // 12 hex chars - what I monitor
  theirAlias: string | null;     // 12 hex chars - where I send (null if pending)
  status: "pending" | "active" | "rejected";
  initiatedByMe: boolean;
  contactId: string;
  tenantId: string;
  lastActivityAt: Date;
};
```

## Common Patterns

### ✅ Correct Usage

```typescript
// Monitor myAlias
const monitored = conversation.myAlias;
blockProcessor.watchForMessages(monitored);

// Send to theirAlias
sendMessage({ targetAlias: conversation.theirAlias });

// Derive both aliases together
const { myAlias, theirAlias } = deriveConversationAliases(pk, addr);
```

### ❌ Common Mistakes

```typescript
// DON'T monitor theirAlias
blockProcessor.watchForMessages(conversation.theirAlias); // WRONG!

// DON'T send to myAlias
sendMessage({ targetAlias: conversation.myAlias }); // WRONG!

// DON'T mix up aliases
conversation.myAlias = deriveTheirAlias(pk, addr); // WRONG!
```

## Troubleshooting

### Messages Not Received

**Check:**
1. Both parties created the conversation (for discrete mode)
2. You're monitoring `myAlias` not `theirAlias`
3. Sender is using `theirAlias` for sending
4. Addresses are correct and on same network

**Debug with logging:**
```typescript
console.log('[Send] Using alias:', conversation.theirAlias);
console.log('[Monitor] Watching alias:', conversation.myAlias);
console.log('[Incoming] Message alias:', incomingMessage.targetAlias);
```

### Aliases Don't Match

**Common causes:**
1. Different addresses used (typo, wrong network prefix)
2. Wrong private key used for derivation

**Verify:**
```typescript
// Alice's side
const alice = deriveConversationAliases(alicePrivateKey, bobAddress);

// Bob's side  
const bob = deriveConversationAliases(bobPrivateKey, aliceAddress);

// Should be true
console.assert(alice.theirAlias === bob.myAlias);
console.assert(bob.theirAlias === alice.myAlias);
```

### Conversation Already Exists

This is expected behavior - you can only have one conversation per contact address. Use the existing conversation instead of creating a new one.

```typescript
const existing = conversationManager.getConversationWithContactByAddress(address);
if (existing) {
  // Use existing conversation
} else {
  // Create new conversation
}
```

## Security Analysis

### Cryptographic Strength

✅ **ECDH (secp256k1)** - Industry standard elliptic curve  
✅ **HKDF (SHA-256)** - NIST approved key derivation  
✅ **48-bit alias space** - 2^48 = 281 trillion possible aliases  
✅ **Collision resistance** - Practically impossible to collide  
✅ **One-way derivation** - Cannot reverse alias to discover keys  

### Privacy Benefits

**Asymmetric aliases prevent conversation linkage:**
```
On-chain observer sees:
  Message 1: alias "abc123" 
  Message 2: alias "def456"

Cannot determine these are from the same conversation!
```

**Comparison with symmetric:**
```
Symmetric (v2.0.0):  Both directions use "xyz789"  → Easy to link
Asymmetric (v3.0.0): Use "abc123" and "def456"    → Hard to link
```

### Known Limitations

- **Parity assumption:** Assumes Even parity for ECDH (both parties must agree)
- **No migration support:** Incompatible with v2.0.0 conversations
- **Discrete mode coordination:** Both parties must create independently

## Migration from v2.0.0

### Breaking Changes

| Feature | v2.0.0 | v3.0.0 |
|---------|--------|--------|
| Alias Type | Symmetric | Asymmetric |
| Alias Count | 1 | 2 |
| Alias Length | 24 hex chars | 12 hex chars |
| Database Field | `conversationAlias` | `myAlias`, `theirAlias` |
| Context String | "receive" or "send" | PUBLIC_KEY |

### Migration Path

⚠️ **No automatic migration** - v3.0.0 is incompatible with v2.0.0

**Steps:**
1. Export important messages/contacts
2. Upgrade to v3.0.0
3. Re-establish conversations using handshakes or discrete mode
4. New deterministic aliases will be automatically derived

### Code Changes Required

```typescript
// OLD (v2.0.0)
const alias = deriveConversationAlias(privateKey, address);
conversation.conversationAlias = alias;
await send(conversation.conversationAlias);

// NEW (v3.0.0)
const { myAlias, theirAlias } = deriveConversationAliases(privateKey, address);
conversation.myAlias = myAlias;
conversation.theirAlias = theirAlias;
await send(conversation.theirAlias);
```

## Implementation Files

### Core Cryptography
- `cipher/src/lib.rs` - Rust ECDH + HKDF implementation
- `cipher-wasm/` - Compiled WASM module

### TypeScript Wrappers
- `src/utils/deterministic-alias.ts` - TypeScript API

### Conversation Management
- `src/service/conversation-manager-service.ts` - Conversation logic
- `src/store/repository/conversation.repository.ts` - Database operations

### Message Routing
- `src/service/account-service.ts` - Message sending
- `src/service/block-processor-service.ts` - Message receiving

### UI Components
- `src/components/Modals/NewChatForm.tsx` - Create conversation UI
- `src/components/MessagesPane/Composing/Directs/DirectComposer.tsx` - Send messages

## Testing Checklist

- [ ] Derive aliases for two parties
- [ ] Verify `alice.theirAlias === bob.myAlias`
- [ ] Create discrete conversation
- [ ] Send message using `theirAlias`
- [ ] Receive message on `myAlias`
- [ ] Verify different aliases in each direction
- [ ] Check on-chain messages show different aliases

## Quick Reference

### Derivation Formula
```
myAlias    = hex(HKDF-SHA256(ECDH(my_sk, their_pk), "chat" + secret + MY_pk_xonly)[:6])
theirAlias = hex(HKDF-SHA256(ECDH(my_sk, their_pk), "chat" + secret + THEIR_pk_xonly)[:6])
```

### Remember
- **MY** alias = what **I** monitor
- **THEIR** alias = where **I** send = what **THEY** monitor
- Messages flow FROM `theirAlias` TO `myAlias`
- Always use x-only pubkeys (32 bytes) to avoid parity issues

---

**Status:** ✅ Implementation complete  
**Version:** 3.0.0 - Asymmetric Deterministic Aliases  
**Features:** Discrete conversations (no-handshake mode), deterministic alias derivation
