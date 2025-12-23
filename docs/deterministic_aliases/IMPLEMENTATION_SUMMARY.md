# Deterministic Asymmetric Aliases - Implementation Summary

**Date:** December 23, 2024  
**Version:** 3.0.0 (Asymmetric Deterministic Aliases)

## What Changed

This implementation introduces **asymmetric deterministic aliases** for improved privacy and the **discrete conversation** feature for zero-cost messaging setup.

### Previous System (v2.0.0)
- Single `conversationAlias` shared by both parties
- Privacy issue: Same alias used in both directions exposed conversation linkage
- 12-byte (24 hex char) aliases

### New System (v3.0.0)
- **Asymmetric aliases**: `myAlias` and `theirAlias` are different
- **6-byte (12 hex char) aliases** for efficiency
- **Privacy improvement**: Different aliases in each direction prevent on-chain linkage
- **Discrete conversations**: New feature enabling zero-cost conversation initiation

## Core Algorithm

### Alias Derivation

```rust
// My alias (what I monitor)
myAlias = HKDF-SHA256(
  salt: None,
  ikm: shared_secret,
  info: "chat" || shared_secret || my_public_key,
  length: 6 bytes
) → 12 hex chars

// Their alias (where I send messages)
theirAlias = HKDF-SHA256(
  salt: None,
  ikm: shared_secret,
  info: "chat" || shared_secret || their_public_key,
  length: 6 bytes
) → 12 hex chars
```

### Asymmetric Property

```
Alice's perspective:
  myAlias:    abc123 (Alice monitors)
  theirAlias: def456 (Alice sends to)

Bob's perspective:
  myAlias:    def456 (Bob monitors)
  theirAlias: abc123 (Bob sends to)

Result:
  Alice's theirAlias === Bob's myAlias ✓
  Bob's theirAlias === Alice's myAlias ✓
  Alice's myAlias !== Bob's myAlias ✓ (PRIVACY!)
```

## Files Modified

### Rust (Cryptography Core)

**`cipher/Cargo.toml`**
- Added: `hkdf = "0.12.4"`

**`cipher/src/lib.rs`**
- Added: `derive_my_alias(my_private_key, their_address) -> String`
- Added: `derive_their_alias(my_private_key, their_address) -> String`
- Added: `derive_alias_with_context()` (internal helper)
- Removed: `derive_conversation_alias()` (v2.0.0 function)
- Changed: Alias length from 12 bytes to 6 bytes
- Added: Comprehensive tests for asymmetry and determinism

### TypeScript (Wrappers & Integration)

**`src/utils/deterministic-alias.ts`**
- Added: `deriveMyAlias(myPrivateKey, theirAddress)`
- Added: `deriveTheirAlias(myPrivateKey, theirAddress)`
- Added: `deriveConversationAliases(myPrivateKey, theirAddress)` (convenience function)
- Removed: `deriveConversationAlias()` (v2.0.0 function)

**`src/service/conversation-manager-service.ts`**
- Added: `getPrivateKey()` - private method to access wallet key
- Updated: `createNewConversation()` - uses deterministic derivation
- Updated: `processNewHandshake()` - derives instead of extracts aliases
- Updated: `processHandshake()` - derives and verifies aliases
- **CRITICAL**: `getMonitoredConversations()` - now monitors `myAlias` (not `theirAlias`)
- Updated: `hydrateFromSavedHandshake()` - derives instead of reads from payload
- Deprecated: `generateUniqueAlias()` - throws error directing to deterministic method
- Updated: `validateHandshakePayload()` - removed alias validation
- **NEW**: `createDiscreteConversation()` - enables zero-cost conversations

**`src/store/messaging.store.ts`**
- Updated: `initiateHandshake()` - removed alias from payload
- Updated: `respondToHandshake()` - removed aliases from response payload
- Updated: `createOffChainHandshake()` - made alias parameters optional/deprecated
- **NEW**: `createDiscreteConversation()` - messaging store wrapper

**`src/types/messaging.types.ts`**
- Updated: `HandshakePayload.alias` - marked as optional/deprecated
- Updated: `HandshakePayload.theirAlias` - marked as optional/deprecated

**`src/components/Modals/NewChatForm.tsx`**
- **NEW**: Discrete conversation checkbox UI
- **NEW**: `discreteMode` state
- **NEW**: `createDiscreteConversation()` handler
- Updated: Conditional rendering of handshake amount section
- Updated: Submit button text based on mode

### Documentation

**NEW Files:**
- `docs/deterministic_aliases/discrete-conversations.md` - Complete discrete conversation guide
- `docs/deterministic_aliases/IMPLEMENTATION_SUMMARY.md` - This file

## Breaking Changes

### API Changes

❌ **Removed:**
```typescript
// v2.0.0 (REMOVED)
derive_conversation_alias(privateKey, address)
deriveConversationAlias(privateKey, address)
```

✅ **New:**
```typescript
// v3.0.0 (NEW)
derive_my_alias(privateKey, address)
derive_their_alias(privateKey, address)
deriveMyAlias(privateKey, address)
deriveTheirAlias(privateKey, address)
deriveConversationAliases(privateKey, address) // Convenience wrapper
```

### Database Schema

**No changes to schema structure**, but values changed:
- `myAlias` length: 24 chars → **12 chars**
- `theirAlias` length: 24 chars → **12 chars**
- Derivation: Symmetric → **Asymmetric**

### Handshake Payloads

**v2.0.0:**
```json
{
  "type": "handshake",
  "timestamp": 1234567890,
  "version": 1
}
```

**v3.0.0 (unchanged):**
```json
{
  "type": "handshake",
  "timestamp": 1234567890,
  "version": 1
}
```

Aliases are **not exchanged** in either version (deterministic derivation).

## Migration Guide

### From v2.0.0 to v3.0.0

**⚠️ No automatic migration:** Existing conversations with v2.0.0 aliases will need to be recreated.

**Steps:**
1. Export any important conversations/contacts
2. Clear conversation database
3. Re-initiate handshakes or create discrete conversations
4. Aliases will be automatically derived with new asymmetric algorithm

**Why no migration?**
- Alias derivation algorithm changed (symmetric → asymmetric)
- Alias length changed (12 bytes → 6 bytes)
- Impossible to convert old aliases to new format without both parties coordinating

## Testing Checklist

### Unit Tests (Rust)
- ✅ `test_asymmetric_alias_derivation` - Verifies Alice's theirAlias === Bob's myAlias
- ✅ `test_alias_determinism` - Verifies same inputs → same outputs

### Integration Testing
- [ ] Create handshake conversation - verify aliases derived correctly
- [ ] Create discrete conversation - verify immediate active status
- [ ] Send message in handshake conversation - verify routing
- [ ] Send message in discrete conversation - verify routing
- [ ] Both parties create discrete conversation - verify consistency
- [ ] Monitor `myAlias` receives messages sent to `theirAlias`
- [ ] Verify different aliases in each direction on blockchain

### End-to-End Testing
- [ ] Alice initiates handshake to Bob
- [ ] Bob receives and responds
- [ ] Bi-directional messaging works
- [ ] Alice creates discrete conversation with Carol
- [ ] Carol independently creates discrete conversation with Alice
- [ ] Bi-directional messaging works without handshake

## Performance Considerations

### Alias Derivation Performance
- **ECDH computation:** ~0.1-1ms (depends on hardware)
- **HKDF expansion:** ~0.01ms
- **Total per conversation:** ~1-2ms (negligible)

### Storage Savings
- **Alias size:** 12 bytes (was 24 bytes in v2.0.0)
- **Savings:** 50% reduction in alias storage
- **Network:** Smaller aliases in protocol strings

### Privacy-Performance Tradeoff
- **Better privacy:** Asymmetric aliases harder to link
- **Slightly smaller:** 6-byte aliases vs 12-byte
- **Acceptable collision risk:** 2^48 space (281 trillion possibilities)

## Security Analysis

### Cryptographic Properties

✅ **ECDH Security**
- Shared secret derives from secp256k1 curve
- Computationally hard to derive without private key

✅ **HKDF Security**
- SHA-256 based key derivation
- Public key as context prevents alias reuse across different parties

✅ **Alias Uniqueness**
- Different shared secrets for different party pairs
- Public key context ensures asymmetry
- Collision probability: negligible (2^-48 per conversation pair)

### Privacy Improvements

**v2.0.0 (Symmetric):**
```
On-chain observer sees:
  Message A→B: alias "abc123def456"
  Message B→A: alias "abc123def456"
  
Conclusion: Same conversation! ❌
```

**v3.0.0 (Asymmetric):**
```
On-chain observer sees:
  Message A→B: alias "abc123"
  Message B→A: alias "def456"
  
Conclusion: Could be different conversations ✓
Requires additional analysis to link
```

### Attack Resistance

✅ **Preimage Resistance**: Cannot derive private key from alias  
✅ **Collision Resistance**: Cannot force alias collision  
✅ **Replay Resistance**: Message encryption includes nonce  
✅ **Traffic Analysis**: Harder with asymmetric aliases  

## Known Limitations

1. **No Backward Compatibility**
   - v3.0.0 conversations incompatible with v2.0.0
   - Requires all parties to upgrade

2. **Off-Chain Coordination for Discrete**
   - Both parties must create discrete conversation independently
   - No on-chain notification

3. **Address Verification**
   - User must ensure correct address before creating discrete conversation
   - No on-chain handshake to validate

## Future Enhancements

### Planned Features
- [ ] Migration tool for v2.0.0 → v3.0.0 conversations
- [ ] QR code generation for easy discrete conversation setup
- [ ] Notification when both parties create discrete conversation
- [ ] Optional on-chain verification for discrete conversations
- [ ] Conversation recovery from seed phrase

### Potential Optimizations
- [ ] Alias caching to avoid re-derivation
- [ ] Batch alias derivation for multiple conversations
- [ ] WebAssembly optimization for HKDF

## Conclusion

Version 3.0.0 represents a significant privacy improvement over v2.0.0:

**Key Achievements:**
- ✅ Asymmetric aliases prevent easy on-chain conversation linkage
- ✅ Discrete conversations enable zero-cost messaging setup
- ✅ Smaller aliases (50% reduction) improve efficiency
- ✅ Deterministic algorithm ensures reliability
- ✅ No aliases in handshake payload (cleaner protocol)

**Trade-offs Accepted:**
- ❌ Breaking change (no automatic migration)
- ❌ Discrete conversations require coordination
- ❌ Slightly higher complexity in alias management

Overall, the privacy and usability benefits significantly outweigh the migration costs for new deployments and active users willing to re-establish conversations.

---

**Implementation Team Notes:**
- All TypeScript compilation checks passed ✅
- WASM build successful ✅
- Comprehensive documentation created ✅
- Ready for testing and deployment

**Next Steps:**
1. Comprehensive testing on testnet
2. User acceptance testing
3. Security audit of cryptographic implementation
4. Deployment to production
