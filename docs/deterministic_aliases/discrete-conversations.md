# Discrete Conversations

## Overview

Discrete conversations allow users to start monitoring for messages from another party without requiring an on-chain handshake transaction. This feature leverages the deterministic alias system to enable instant, zero-cost conversation initiation while maintaining privacy and security.

## Key Features

- **Zero Cost**: No blockchain transaction fees required
- **Instant**: Conversations start immediately without waiting for confirmations
- **Private**: No on-chain record of conversation initiation
- **Symmetric**: Both parties have equal capability to initiate
- **Deterministic**: Works reliably even if both parties create the conversation independently

## How It Works

### Deterministic Alias Derivation

Both parties independently derive the same pair of asymmetric aliases using ECDH and HKDF:

```
Alice derives:
  myAlias    = HKDF("chat" || shared_secret || alice_pubkey)[:6]  // Alice monitors this
  theirAlias = HKDF("chat" || shared_secret || bob_pubkey)[:6]    // Alice sends to this

Bob derives:
  myAlias    = HKDF("chat" || shared_secret || bob_pubkey)[:6]    // Bob monitors this
  theirAlias = HKDF("chat" || shared_secret || alice_pubkey)[:6]  // Bob sends to this

Result:
  Alice's theirAlias === Bob's myAlias ✓  (Alice sends to Bob's listening alias)
  Bob's theirAlias === Alice's myAlias ✓  (Bob sends to Alice's listening alias)
  Alice's myAlias !== Bob's myAlias ✓     (Privacy: different aliases each direction)
```

### Message Flow

1. **Alice creates discrete conversation with Bob**
   - No transaction sent
   - Conversation status: `active` (immediately)
   - Alice starts monitoring her `myAlias`
   - Alice can send messages to `theirAlias`

2. **Bob creates discrete conversation with Alice** (independently)
   - No transaction sent
   - Derives identical aliases (deterministic)
   - Bob starts monitoring his `myAlias`
   - Bob can send messages to `theirAlias`

3. **Messages flow seamlessly**
   - Alice sends to `theirAlias` → Bob receives on `myAlias` ✓
   - Bob sends to `theirAlias` → Alice receives on `myAlias` ✓

## User Guide

### Creating a Discrete Conversation

1. Open the "Start New Conversation" modal
2. Enter the recipient's Kaspa address (or KNS domain)
3. **Check the "Discrete Conversation" checkbox**
4. Click "Start Discrete Chat"

The conversation will be created instantly and appear in your conversation list as an active conversation.

### When to Use Discrete Conversations

**Use Discrete Conversations when:**
- You want to start messaging immediately without transaction fees
- You're coordinating with someone off-chain (e.g., via another messaging app)
- You both know each other's addresses and want to start messaging
- You want maximum privacy (no on-chain handshake record)

**Use Traditional Handshake when:**
- The recipient doesn't know your address yet
- You want to send KAS along with the initial contact
- You prefer the formality of an on-chain handshake

## Technical Implementation

### Backend Services

#### ConversationManagerService

```typescript
public async createDiscreteConversation(recipientAddress: string): Promise<{
  conversation: Conversation;
  contact: Contact;
}>
```

**What it does:**
- Validates the recipient address
- Derives deterministic aliases using ECDH + HKDF
- Creates conversation with `status: "active"` (no handshake needed)
- Starts monitoring `myAlias` immediately
- Returns the created conversation and contact

#### MessagingStore

```typescript
createDiscreteConversation: (
  recipientAddress: string
) => Promise<{ conversationId: string; contactId: string }>
```

**What it does:**
- Calls conversation manager's `createDiscreteConversation()`
- Refreshes UI to show new conversation
- Returns conversation and contact IDs

### Frontend Components

#### NewChatForm

The UI includes:
- Checkbox: "Discrete Conversation (no handshake required)"
- Conditional rendering: Handshake amount hidden when discrete mode is on
- Updated submit flow: Skips confirmation for discrete conversations
- Button text changes: "Start Discrete Chat" vs "Start Chat"

### Database Schema

Discrete conversations use the same `Conversation` schema as handshake conversations:

```typescript
{
  id: string;
  myAlias: string;       // Deterministically derived
  theirAlias: string;    // Deterministically derived
  status: "active";      // Immediately active (no pending state)
  initiatedByMe: true;
  contactId: string;
  tenantId: string;
  lastActivityAt: Date;
}
```

## Privacy & Security

### Privacy Benefits

1. **No On-Chain Footprint**
   - No handshake transaction = no public record of conversation initiation
   - Observer cannot see when two parties started communicating

2. **Asymmetric Aliases**
   - Different aliases in each direction
   - Blockchain observer cannot link messages by alias alone
   - Harder to determine conversation partners through traffic analysis

3. **Deterministic but Unlinkable**
   - Aliases are derived from shared secret
   - Cannot be predicted without both private keys
   - No central registry of aliases

### Security Considerations

1. **Requires Off-Chain Coordination**
   - Both parties must create the conversation independently
   - Typically coordinated via secure side channel

2. **No Recipient Validation**
   - Unlike handshakes, there's no on-chain confirmation
   - Ensure you have the correct address before creating conversation

3. **Alias Collision (Extremely Unlikely)**
   - 6-byte aliases = 2^48 possible values
   - ECDH ensures different shared secrets for different parties
   - Collision probability: negligible for practical use

## API Reference

### Create Discrete Conversation

```typescript
// From ConversationManagerService
await conversationManager.createDiscreteConversation(recipientAddress);

// From MessagingStore (React)
const { conversationId, contactId } = await createDiscreteConversation(recipientAddress);
```

**Parameters:**
- `recipientAddress` (string): Valid Kaspa address (with `kaspa:` or `kaspatest:` prefix)

**Returns:**
- `conversationId` (string): UUID of created conversation
- `contactId` (string): UUID of contact (created if doesn't exist)

**Throws:**
- Error if address is invalid
- Error if conversation already exists with this address
- Error if wallet is not unlocked

### Example Usage

```typescript
import { useMessagingStore } from '../store/messaging.store';

const messageStore = useMessagingStore();

// Create discrete conversation
const result = await messageStore.createDiscreteConversation(
  'kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjceef60sd'
);

console.log('Conversation created:', result.conversationId);

// Conversation is now active and monitoring
// You can immediately send messages
```

## Comparison: Discrete vs Handshake

| Feature | Discrete Conversation | Handshake Conversation |
|---------|----------------------|------------------------|
| **Cost** | Free (no transaction) | ~0.2 KAS minimum |
| **Speed** | Instant | Wait for confirmation (~1 sec) |
| **Privacy** | No on-chain record | Handshake visible on-chain |
| **Setup** | Both parties create independently | One party initiates |
| **Coordination** | Requires off-chain coordination | Self-contained (includes address) |
| **Status** | Immediately `active` | Starts `pending`, becomes `active` |
| **Alias Derivation** | Same deterministic algorithm | Same deterministic algorithm |
| **Message Encryption** | Same (ECDH + ChaCha20Poly1305) | Same (ECDH + ChaCha20Poly1305) |

## Migration from Legacy Handshakes

Discrete conversations are a **new feature** enabled by deterministic aliases. They complement traditional handshakes and don't replace them.

**No migration needed:** Existing conversations continue to work as before.

**Future conversations:** Users can choose discrete or handshake based on their needs.

## Troubleshooting

### Conversation Created but Messages Not Received

**Possible causes:**
1. Recipient hasn't created their side of the conversation yet
2. Recipient is monitoring wrong alias (shouldn't happen with deterministic derivation)
3. Network connectivity issues

**Solution:**
- Ensure both parties have created the discrete conversation
- Verify both parties are using the same recipient address
- Check that both parties' wallets are unlocked and running

### "Conversation Already Exists" Error

**Cause:** A conversation with this address already exists (either discrete or handshake-based).

**Solution:** Use the existing conversation instead of creating a new one.

### Invalid Address Error

**Cause:** Address format is incorrect or doesn't include the `kaspa:` prefix.

**Solution:** Ensure the address is a valid Kaspa address with the proper prefix.

## Future Enhancements

Potential improvements for discrete conversations:

1. **QR Code Sharing**: Generate QR code with your address to simplify discrete conversation setup
2. **Conversation Discovery**: Notification when recipient also creates discrete conversation
3. **Batch Creation**: Create multiple discrete conversations at once
4. **Import/Export**: Share conversation settings securely
5. **Verification**: Optional on-chain verification after discrete conversation established

## Conclusion

Discrete conversations provide a powerful, privacy-preserving alternative to traditional handshakes. By leveraging deterministic alias derivation, two parties can establish encrypted communication without any on-chain transaction, making Kasia more accessible and private.

The feature maintains the same security guarantees as handshake conversations while offering zero-cost, instant setup—ideal for users who coordinate off-chain and value privacy.
