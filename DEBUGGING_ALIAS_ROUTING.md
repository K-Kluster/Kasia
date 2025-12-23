# Debugging Alias Routing - Logging Added

## Summary

Added comprehensive logging throughout the message sending and receiving pipeline to debug why messages are not being received. This will help identify whether the issue is:
1. Wrong alias being sent
2. Wrong alias being monitored
3. Alias mismatch between sender and receiver

## Critical Bug Fixed

**DirectComposer.tsx - Line 167**
```typescript
// BEFORE (BUG):
await send(conversation.myAlias);  // ❌ WRONG! Sending to our own monitoring alias

// AFTER (FIXED):
await send(conversation.theirAlias);  // ✅ CORRECT! Sending to their monitoring alias
```

**This was the root cause of messages not being received!**

## Logging Added

### 1. Message Sending Flow

#### DirectComposer (UI Component)
**File:** `src/components/MessagesPane/Composing/Directs/DirectComposer.tsx`
**Line:** 161-173

```typescript
console.log('[DirectComposer] Sending message:', {
  myAlias: conversation.myAlias,
  theirAlias: conversation.theirAlias,
  sendingTo: conversation.theirAlias,
  note: 'Sending to theirAlias - recipient should be monitoring this'
});
```

**Shows:**
- Which alias we're monitoring (myAlias)
- Which alias we're sending to (theirAlias)
- Confirms correct alias is being used

#### useMessageComposer Hook
**File:** `src/hooks/MessageComposer/useMessageComposer.ts`
**Line:** 64-72

```typescript
console.log('[useMessageComposer] Sending message:', {
  recipient,
  aliasToSendTo,
  conversationMyAlias: conversationWithContact?.conversation.myAlias,
  conversationTheirAlias: conversationWithContact?.conversation.theirAlias,
  note: 'Should send to theirAlias (recipient monitors this)'
});
```

**Shows:**
- Recipient address
- Alias being sent to
- Full conversation aliases for verification

#### Wallet Store
**File:** `src/store/wallet.store.ts`
**Line:** 394-398

```typescript
console.log('[wallet.store] Sending message:', {
  toAddress: toAddress.toString(),
  aliasToSendTo,
  note: 'This alias will be included in the published message protocol string'
});
```

**Shows:**
- Destination address
- Alias that will be published on-chain

#### Account Service
**File:** `src/service/account-service.ts`
**Lines:** 790-797, 806-810

```typescript
// Before building protocol string
console.log('[account-service] sendMessageWithContext - Alias details:', {
  aliasProvidedToSend: sendMessage.theirAlias,
  conversationMyAlias: conversationWithContact.conversation.myAlias,
  conversationTheirAlias: conversationWithContact.conversation.theirAlias,
  recipientAddress: conversationWithContact.contact.kaspaAddress,
  ourAddress: this.recv.toString(),
  note: 'Publishing message with theirAlias - recipient should be monitoring this'
});

// After building protocol string
console.log('[account-service] Built protocol string:', {
  protocolString: protocolString.substring(0, 50) + '...',
  aliasInMessage: sendMessage.theirAlias,
  note: 'This is what will be published on-chain'
});
```

**Shows:**
- Alias included in the message
- Both conversation aliases
- Protocol string preview
- Verification that correct alias is in message

### 2. Message Receiving Flow

#### Conversation Manager
**File:** `src/service/conversation-manager-service.ts`
**Line:** 839-846

```typescript
console.log('[getMonitoredConversations] Monitoring conversation:', {
  myAlias: conversationAndContact.conversation.myAlias,
  theirAlias: conversationAndContact.conversation.theirAlias,
  partnerAddress: conversationAndContact.contact.kaspaAddress,
  conversationId: conversationAndContact.conversation.id,
  status: conversationAndContact.conversation.status,
  note: 'We monitor myAlias. Partner sends to theirAlias which equals our myAlias'
});
```

**Shows:**
- Which alias we're monitoring (myAlias)
- Partner's send-to alias (theirAlias)
- Conversation status and ID

#### Block Processor - Monitored Aliases Update
**File:** `src/service/block-processor-service.ts`
**Line:** 307-314

```typescript
console.log('[block-processor] Updating monitored aliases:', {
  count: conversations.length,
  aliases: conversations.map(c => ({
    alias: c.alias,
    address: c.address,
    note: 'Monitoring myAlias for incoming messages'
  }))
});
```

**Shows:**
- Total number of monitored conversations
- All aliases we're monitoring
- Associated addresses

#### Block Processor - Incoming Message Check
**File:** `src/service/block-processor-service.ts`
**Line:** 147-155

```typescript
console.log('[block-processor] Incoming message alias check:', {
  targetAlias,
  isMonitored: this.monitoredConversations.has(targetAlias),
  monitoredAliases: Array.from(this.monitoredConversations),
  senderAddress: resolvedSenderAddress,
  note: 'Message is for us if targetAlias matches one of our monitored myAliases'
});
```

**Shows:**
- Incoming message's target alias
- Whether we're monitoring that alias
- All aliases we're currently monitoring
- Sender address for correlation

## How to Use This Logging

### Testing Message Sending

1. **Open Browser Console** before sending a message
2. **Send a test message** to a contact
3. **Look for these log entries in order:**

```
[DirectComposer] Sending message:
  → Shows: myAlias, theirAlias, sendingTo (should be theirAlias)

[useMessageComposer] Sending message:
  → Confirms: recipient, aliasToSendTo

[wallet.store] Sending message:
  → Shows: toAddress, aliasToSendTo

[account-service] sendMessageWithContext - Alias details:
  → Shows: both aliases, confirms theirAlias is used

[account-service] Built protocol string:
  → Shows: final protocol string with alias
```

### Testing Message Receiving

1. **Open Browser Console** before expecting a message
2. **Wait for block processing**
3. **Look for these log entries:**

```
[getMonitoredConversations] Monitoring conversation:
  → Shows: myAlias (what we monitor), theirAlias (what they send to)

[block-processor] Updating monitored aliases:
  → Shows: all aliases we're monitoring

[block-processor] Incoming message alias check:
  → Shows: targetAlias in message, whether we're monitoring it
```

### Verification Checklist

For **Alice** sending to **Bob**:

- [ ] Alice's log shows `sendingTo: Bob's myAlias` ✓
- [ ] Protocol string includes `Bob's myAlias` ✓
- [ ] Bob's monitored aliases include `Bob's myAlias` ✓
- [ ] Incoming message check on Bob's side shows `isMonitored: true` ✓

For **Bob** replying to **Alice**:

- [ ] Bob's log shows `sendingTo: Alice's myAlias` ✓
- [ ] Protocol string includes `Alice's myAlias` ✓
- [ ] Alice's monitored aliases include `Alice's myAlias` ✓
- [ ] Incoming message check on Alice's side shows `isMonitored: true` ✓

### Expected Alias Relationships

```
Alice's Perspective:
  myAlias:    abc123  (Alice monitors this)
  theirAlias: def456  (Alice sends to this)

Bob's Perspective:
  myAlias:    def456  (Bob monitors this)
  theirAlias: abc123  (Bob sends to this)

Verification:
  Alice's theirAlias === Bob's myAlias    ✓ (Alice → Bob routing)
  Bob's theirAlias === Alice's myAlias    ✓ (Bob → Alice routing)
  Alice's myAlias !== Bob's myAlias       ✓ (Privacy: different aliases)
```

## Common Issues to Look For

### Issue 1: Wrong Alias Being Sent
**Symptom:** `aliasToSendTo` in logs equals `myAlias` instead of `theirAlias`
**Cause:** Component passing wrong alias to send function
**Fix:** Ensure `send(conversation.theirAlias)` not `send(conversation.myAlias)`

### Issue 2: Not Monitoring Correct Alias
**Symptom:** `[block-processor] Incoming message alias check` shows `isMonitored: false`
**Cause:** `getMonitoredConversations` returning wrong alias
**Fix:** Verify function returns `myAlias` not `theirAlias`

### Issue 3: Alias Derivation Mismatch
**Symptom:** Alice's `theirAlias !== Bob's myAlias`
**Cause:** Different addresses used for derivation or crypto bug
**Fix:** Verify both parties use exact same addresses for derivation

### Issue 4: Conversation Not Active
**Symptom:** Alias not in `[block-processor] Updating monitored aliases` list
**Cause:** Conversation status is not "active" or "pending + initiatedByMe"
**Fix:** Check conversation status in database

## Files Modified

1. **src/components/MessagesPane/Composing/Directs/DirectComposer.tsx**
   - Fixed: Send to `theirAlias` instead of `myAlias` (CRITICAL BUG FIX)
   - Added: Logging before sending

2. **src/hooks/MessageComposer/useMessageComposer.ts**
   - Added: Logging with conversation details
   - Renamed parameter: `myAlias` → `aliasToSendTo` for clarity

3. **src/store/wallet.store.ts**
   - Added: Logging in `sendMessageWithContext`
   - Updated type: `myAlias` → `aliasToSendTo` in interface

4. **src/service/account-service.ts**
   - Added: Detailed logging before and after protocol string construction

5. **src/service/conversation-manager-service.ts**
   - Enhanced: Logging in `getMonitoredConversations` to show both aliases

6. **src/service/block-processor-service.ts**
   - Added: Logging when updating monitored aliases
   - Added: Logging when checking incoming message aliases

## Next Steps

1. **Test with logging enabled** - Send messages between two wallets
2. **Verify alias relationships** - Check that Alice's theirAlias === Bob's myAlias
3. **Check blockchain** - Verify correct alias appears in on-chain messages
4. **If still failing** - Compare logged values to identify mismatch

## Cleanup

After debugging is complete, you may want to:
- Reduce log verbosity (keep critical logs, remove verbose details)
- Add log level guards (only log in dev mode)
- Remove redundant logs

But for now, **keep all logging active** to diagnose the issue!
