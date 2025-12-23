# Deterministic Asymmetric Aliases Documentation

This directory contains complete documentation for the Deterministic Asymmetric Alias system (v3.0.0) implemented in Kasia.

## 📚 Documentation Files

### Core Documentation

1. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**
   - Complete implementation overview
   - Breaking changes and migration guide
   - Technical details and file changes
   - Security analysis
   - **Start here** for comprehensive understanding

2. **[discrete-conversations.md](./discrete-conversations.md)**
   - Deep dive into the discrete conversation feature
   - User guide and when to use it
   - Technical implementation details
   - Privacy and security considerations
   - Troubleshooting guide

3. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**
   - Quick start examples
   - API reference
   - Common patterns and debugging
   - Cheat sheet
   - **Start here** for practical usage

### Legacy Documentation

4. **[CHANGELOG.md](./CHANGELOG.md)** *(if exists)*
   - Version history
   - Changes from v1.0.0 → v2.0.0 → v3.0.0

5. **[deterministic-aliases.md](./deterministic-aliases.md)** *(if exists)*
   - v2.0.0 unified alias documentation
   - **Deprecated** - kept for historical reference

6. **[deterministic-aliases-quick-ref.md](./deterministic-aliases-quick-ref.md)** *(if exists)*
   - v2.0.0 quick reference
   - **Deprecated** - use QUICK_REFERENCE.md instead

## 🎯 Quick Navigation

### For Users
- **"How do I use discrete conversations?"** → [discrete-conversations.md](./discrete-conversations.md)
- **"What's the difference from handshakes?"** → [discrete-conversations.md#comparison](./discrete-conversations.md#comparison-discrete-vs-handshake)

### For Developers
- **"How do I integrate this?"** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **"What APIs are available?"** → [QUICK_REFERENCE.md#api-reference](./QUICK_REFERENCE.md#api-reference)
- **"What changed from v2.0.0?"** → [IMPLEMENTATION_SUMMARY.md#breaking-changes](./IMPLEMENTATION_SUMMARY.md#breaking-changes)

### For Security Reviewers
- **"How are aliases derived?"** → [IMPLEMENTATION_SUMMARY.md#core-algorithm](./IMPLEMENTATION_SUMMARY.md#core-algorithm)
- **"What are the privacy improvements?"** → [IMPLEMENTATION_SUMMARY.md#security-analysis](./IMPLEMENTATION_SUMMARY.md#security-analysis)

## 🔑 Key Concepts

### Asymmetric Aliases

Each conversation has **two different aliases**:

```
myAlias    → What you monitor for incoming messages (derived with YOUR pubkey)
theirAlias → Where you send messages (derived with THEIR pubkey)
```

**Privacy benefit:** Different aliases in each direction make it harder to link conversations on-chain.

### Deterministic Derivation

Both parties independently derive the **same alias pairs**:

```
Alice derives: { myAlias: "abc123", theirAlias: "def456" }
Bob derives:   { myAlias: "def456", theirAlias: "abc123" }

Result: Alice's theirAlias === Bob's myAlias ✓ (messages route correctly!)
```

### Discrete Conversations (New!)

Start messaging **without a handshake transaction**:

- ✅ Zero cost (no transaction fee)
- ✅ Instant setup
- ✅ No on-chain record
- ✅ Perfect for off-chain coordination

## 📊 Version Comparison

| Feature | v2.0.0 (Unified) | v3.0.0 (Asymmetric) |
|---------|------------------|---------------------|
| Alias Type | Symmetric | **Asymmetric** |
| Alias Count | 1 | **2** |
| Alias Length | 24 hex chars | **12 hex chars** |
| Privacy | Basic | **Enhanced** |
| Discrete Mode | ❌ No | **✅ Yes** |
| Handshake Cost | ~0.2 KAS | ~0.2 KAS or **FREE (discrete)** |

## 🚀 Getting Started

### 1. Create a Conversation

**Option A: Traditional Handshake** (sends transaction)
```typescript
await messageStore.initiateHandshake(recipientAddress, amountSompi);
```

**Option B: Discrete Conversation** (no transaction)
```typescript
await messageStore.createDiscreteConversation(recipientAddress);
```

### 2. Send a Message

```typescript
// Messages automatically use theirAlias
await accountService.sendMessageWithContext({
  message: encryptedContent,
  theirAlias: conversation.theirAlias,
  priorityFee,
});
```

### 3. Receive Messages

```typescript
// Automatic - conversation manager monitors myAlias
// Block processor routes incoming messages to correct conversation
```

## 🔒 Security Features

✅ **ECDH Key Agreement** - Shared secret from secp256k1  
✅ **HKDF Derivation** - SHA-256 based key derivation  
✅ **Asymmetric Privacy** - Different aliases prevent linkage  
✅ **Collision Resistant** - 2^48 alias space  
✅ **Deterministic** - Reproducible from keys  

## 📋 Implementation Checklist

- [x] Rust ECDH + HKDF implementation
- [x] TypeScript wrappers
- [x] Conversation manager integration
- [x] Message routing updates
- [x] Handshake payload updates
- [x] Discrete conversation feature
- [x] UI components (NewChatForm)
- [x] Comprehensive documentation
- [x] TypeScript compilation verified
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Production deployment

## 🐛 Troubleshooting

**Messages not received?**
- Verify both parties created the conversation
- Check that you're monitoring `myAlias` (not `theirAlias`)
- Ensure addresses are correct

**"Conversation already exists"?**
- Use the existing conversation
- Don't create duplicates

**Aliases don't match?**
- Verify both parties use the same address
- Check for typos or wrong network prefix

See [discrete-conversations.md#troubleshooting](./discrete-conversations.md#troubleshooting) for more details.

## 📞 Support

For questions or issues:
1. Check the documentation in this directory
2. Review the [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) cheat sheet
3. Consult the implementation summary for technical details

## 🔄 Migration from v2.0.0

⚠️ **Breaking change:** v3.0.0 is not backward compatible with v2.0.0 conversations.

**Migration path:**
1. Export important conversations (contacts, messages)
2. Upgrade to v3.0.0
3. Re-establish conversations using handshakes or discrete mode
4. Aliases will be automatically derived with new algorithm

See [IMPLEMENTATION_SUMMARY.md#migration-guide](./IMPLEMENTATION_SUMMARY.md#migration-guide) for details.

## 📝 Contributing

When updating this system:

1. **Update Implementation Summary** - Document all code changes
2. **Update Quick Reference** - Keep API examples current
3. **Update Discrete Conversations** - Add new features/troubleshooting
4. **Test Thoroughly** - Verify both handshake and discrete modes
5. **Update This README** - Keep navigation current

## 📜 License

Same as parent project (Kasia).

---

**Last Updated:** December 23, 2024  
**Version:** 3.0.0 (Asymmetric Deterministic Aliases)  
**Status:** ✅ TypeScript compilation verified, ready for testing
