# Deterministic Asymmetric Aliases - Quick Reference

## TL;DR

**What:** Each conversation has two different aliases - one you monitor (`myAlias`) and one you send to (`theirAlias`).

**Why:** Privacy! Different aliases in each direction make it harder to link messages on the blockchain.

**How:** Both derived deterministically using ECDH + HKDF with your private key and their public key.

## Quick Start

### Create Conversation (Handshake)

```typescript
// Traditional handshake (sends transaction)
await messageStore.initiateHandshake(recipientAddress, amountSompi);
// Aliases derived automatically
// Conversation starts as "pending", becomes "active" when recipient responds
```

### Create Conversation (Discrete)

```typescript
// Discrete conversation (no transaction)
await messageStore.createDiscreteConversation(recipientAddress);
// Aliases derived automatically
// Conversation immediately "active"
// Both parties must create independently
```

### Derive Aliases Manually

```typescript
import { deriveConversationAliases } from '../utils/deterministic-alias';

const { myAlias, theirAlias } = deriveConversationAliases(
  myPrivateKey,
  theirAddress
);

console.log('I monitor:', myAlias);
console.log('I send to:', theirAlias);
```

## Key Concepts

### Asymmetric Derivation

```
You:
  myAlias    = HKDF("chat" + shared_secret + YOUR_pubkey)[:6]
  theirAlias = HKDF("chat" + shared_secret + THEIR_pubkey)[:6]

Them:
  myAlias    = HKDF("chat" + shared_secret + THEIR_pubkey)[:6]
  theirAlias = HKDF("chat" + shared_secret + YOUR_pubkey)[:6]

Magic:
  your.theirAlias === their.myAlias  ✓ Messages route correctly!
  your.myAlias !== their.myAlias     ✓ Privacy preserved!
```

### Monitoring vs Sending

| Alias | You | Them |
|-------|-----|------|
| **myAlias** | You monitor this | They send to this |
| **theirAlias** | You send to this | They monitor this |

## API Reference

### Rust (WASM)

```rust
// Derive your alias (what you monitor)
pub fn derive_my_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError>

// Derive their alias (where you send)
pub fn derive_their_alias(
    my_private_key: WalletPrivateKey,
    their_address: &str,
) -> Result<String, JsError>
```

### TypeScript

```typescript
// Individual functions
function deriveMyAlias(myPrivateKey: string, theirAddress: string): string
function deriveTheirAlias(myPrivateKey: string, theirAddress: string): string

// Convenience function (recommended)
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

// Create handshake conversation (traditional)
async initiateHandshake(recipientAddress: string): Promise<{
  conversation: Conversation;
  contact: Contact;
}>

// Get monitored aliases (returns myAlias for each conversation)
getMonitoredConversations(): { alias: string; address: string }[]
```

## Common Patterns

### Check if Conversation Exists

```typescript
const existingConvId = conversationManager
  .getConversationWithContactByAddress(recipientAddress);

if (existingConvId) {
  console.log('Conversation already exists!');
} else {
  // Create new conversation
}
```

### Send Message

```typescript
// Messages automatically use theirAlias
await accountService.sendMessageWithContext({
  message: encryptedContent,
  theirAlias: conversation.theirAlias, // Send to their listening alias
  priorityFee,
});
```

### Monitor for Incoming Messages

```typescript
// Conversation manager automatically monitors myAlias
const monitored = conversationManager.getMonitoredConversations();
// Returns: [{ alias: myAlias, address: recipientAddress }, ...]

// Block processor checks incoming messages against monitored aliases
if (monitored.some(m => m.alias === incomingMessage.targetAlias)) {
  // Message is for us!
}
```

## Protocol Format

### Message Protocol String

```
ciph_msg:1:comm:{theirAlias}:{encryptedData}
              └─────────────┘
               Their alias (they monitor this)
```

### Handshake Protocol String

```
ciph_msg:1:handshake:{encryptedData}
```

**Note:** Handshakes no longer include aliases in payload. Aliases are derived deterministically by both parties.

## Debugging

### Verify Aliases Match

```typescript
// Alice's side
const alice = deriveConversationAliases(alicePrivateKey, bobAddress);
console.log('Alice myAlias:', alice.myAlias);
console.log('Alice theirAlias:', alice.theirAlias);

// Bob's side
const bob = deriveConversationAliases(bobPrivateKey, aliceAddress);
console.log('Bob myAlias:', bob.myAlias);
console.log('Bob theirAlias:', bob.theirAlias);

// Verify
console.assert(alice.theirAlias === bob.myAlias, 'Alice → Bob routing');
console.assert(bob.theirAlias === alice.myAlias, 'Bob → Alice routing');
```

### Common Issues

**Messages not received:**
- Check that you're monitoring `myAlias` (not `theirAlias`)
- Verify both parties derived aliases from correct addresses
- Ensure `getMonitoredConversations()` returns your `myAlias`

**"Conversation already exists" error:**
- A conversation with this address already exists
- Use existing conversation instead of creating new one

**Alias mismatch:**
- Ensure both parties use same address format
- Verify private keys are correct
- Check for typos in addresses

## Database Schema

```typescript
type Conversation = {
  id: string;                    // UUID
  myAlias: string;               // 12 hex chars (6 bytes)
  theirAlias: string;            // 12 hex chars (6 bytes)
  status: "pending" | "active" | "rejected";
  initiatedByMe: boolean;
  contactId: string;
  tenantId: string;
  lastActivityAt: Date;
};
```

## Security Notes

✅ **Deterministic:** Same inputs always produce same outputs  
✅ **Collision-resistant:** 2^48 possible aliases (practically impossible to collide)  
✅ **Private:** Cannot derive private key from alias  
✅ **Asymmetric:** Different aliases prevent easy conversation linkage  

## Migration from v2.0.0

### What Changed

| Feature | v2.0.0 | v3.0.0 |
|---------|--------|--------|
| Alias Type | Symmetric | **Asymmetric** |
| Alias Count | 1 per conversation | **2 per conversation** |
| Alias Length | 24 hex chars | **12 hex chars** |
| Privacy | Lower | **Higher** |
| Discrete Mode | No | **Yes** |

### Code Changes

```typescript
// OLD (v2.0.0)
const alias = deriveConversationAlias(myPrivateKey, theirAddress);
conversation.conversationAlias = alias; // One alias

// NEW (v3.0.0)
const { myAlias, theirAlias } = deriveConversationAliases(myPrivateKey, theirAddress);
conversation.myAlias = myAlias;         // What I monitor
conversation.theirAlias = theirAlias;   // Where I send
```

## Cheat Sheet

```typescript
// ✅ DO: Monitor myAlias
const monitored = conversation.myAlias;
blockProcessor.watchForMessages(monitored);

// ✅ DO: Send to theirAlias  
sendMessage({ targetAlias: conversation.theirAlias });

// ❌ DON'T: Monitor theirAlias
blockProcessor.watchForMessages(conversation.theirAlias); // WRONG!

// ❌ DON'T: Send to myAlias
sendMessage({ targetAlias: conversation.myAlias }); // WRONG!

// ✅ DO: Derive both aliases together
const { myAlias, theirAlias } = deriveConversationAliases(pk, addr);

// ❌ DON'T: Mix up aliases
conversation.myAlias = deriveTheirAlias(pk, addr); // WRONG!
```

## Testing Checklist

- [ ] Derive aliases for two parties
- [ ] Verify `alice.theirAlias === bob.myAlias`
- [ ] Create discrete conversation
- [ ] Send message using `theirAlias`
- [ ] Receive message on `myAlias`
- [ ] Verify different aliases in each direction
- [ ] Check blockchain for privacy (different aliases visible)

## Support & Resources

- **Full Documentation:** `docs/deterministic_aliases/discrete-conversations.md`
- **Implementation Details:** `docs/deterministic_aliases/IMPLEMENTATION_SUMMARY.md`
- **Changelog:** `docs/deterministic_aliases/CHANGELOG.md`

---

**Pro Tip:** When in doubt, remember:
- **MY alias** = what **I** monitor
- **THEIR alias** = where **I** send (what **THEY** monitor)
