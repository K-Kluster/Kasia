import { Repositories } from "../store/repository/db";
import { Group, GroupMember } from "../store/repository/group.repository";
import {
  generate_random_bytes,
  derive_group_id,
  derive_group_root_epoch,
  derive_blinding_key,
  derive_blinded_group_id,
  derive_sender_id,
  sign_message,
  verify_signature,
  get_xonly_pubkey,
} from "cipher";
import { bytesToHex, hexToBytes } from "../utils/payload-encoding";
import { UnlockedWallet } from "../types/wallet.type";
import { ConversationManagerService } from "./conversation-manager-service";
import { WalletStorageService } from "./wallet-storage-service";
import { Address } from "kaspa-wasm";
import { useWalletStore } from "../store/wallet.store";

/**
 * group control payload for distributing group_root_epoch to members
 * sent via encrypted COMM channel, not on-chain
 */
export interface GroupControlPayload {
  type: "gctl_root";
  v: number;
  group_id: string;
  epoch: number;
  group_root_epoch: string; // the derived root for this epoch (32 bytes hex)
  blinding_key: string; // 32 bytes hex, used to derive per-user blinded_group_ids
  admin_signing_pub: string; // admin's signing public key (32 bytes x-only hex for schnorr)
  members?: string[]; // list of member addresses (for initial group setup)
  name?: string; // group display name (set by admin)
  sig?: string; // signature over payload
}

/**
 * epoch change notification payload
 * tells members to expect new group_root_epoch
 */
export interface GroupEpochPayload {
  type: "gctl_epoch";
  v: number;
  group_id: string;
  epoch: number;
  reason: "add" | "remove" | "rotate";
  sig?: string; // signature over payload
}

/**
 * service for managing group lifecycle operations
 *
 * key hierarchy:
 * - admin holds group_seed (32 bytes, secret)
 * - group_id = SHA256("ciph_msg:groupid" || group_seed)
 * - group_root_epoch_N = HKDF(group_seed, salt=group_id||N, info="kasia:groot")
 * - admin distributes group_root_epoch_N to members via COMM
 * - all members derive sender keys from the same group_root_epoch_N
 */
export class GroupManagerService {
  constructor(
    private readonly repositories: Repositories,
    private readonly currentAddress: string,
    private readonly unlockedWallet: UnlockedWallet,
    private readonly conversationManager: ConversationManagerService
  ) {}

  /**
   * create a new group with initial members (admin only)
   *
   * flow:
   * 1. generate group_seed (32 random bytes) - admin keeps this
   * 2. derive group_id = SHA256("ciph_msg:groupid" || group_seed)
   * 3. set epoch = 0
   * 4. derive group_root_epoch_0 = HKDF(group_seed, ...)
   * 5. generate device_id (16 random bytes)
   * 6. distribute group_root_epoch_0 to members via COMM
   */
  async createGroup(
    name: string,
    initialMemberAddresses: string[]
  ): Promise<{ groupId: string; group: Group }> {
    // generate group_seed (32 random bytes) - admin only secret
    const groupSeedBytes = generate_random_bytes(32);
    const groupSeed = bytesToHex(groupSeedBytes);

    // derive group_id = SHA256("ciph_msg:groupid" || group_seed)
    const groupIdBytes = derive_group_id(groupSeedBytes);
    const groupId = bytesToHex(groupIdBytes);

    // set initial epoch
    const epoch = 0;

    // derive group_root_epoch_0 from group_seed
    const groupRootEpochBytes = derive_group_root_epoch(
      groupSeedBytes,
      groupIdBytes,
      BigInt(epoch)
    );
    const groupRootEpoch = bytesToHex(groupRootEpochBytes);

    // derive blinding_key for per-user blinded group IDs
    const blindingKeyBytes = derive_blinding_key(groupSeedBytes, groupIdBytes);
    const blindingKey = bytesToHex(blindingKeyBytes);

    // generate device_id for deterministic msg_id
    const deviceIdBytes = generate_random_bytes(16);
    const deviceId = bytesToHex(deviceIdBytes);

    // get my signing public key from wallet
    const privateKey = WalletStorageService.getPrivateKey(this.unlockedWallet);
    const mySigningPubKeyBytes = get_xonly_pubkey(
      hexToBytes(privateKey.toString())
    );
    const mySigningPubKey = bytesToHex(mySigningPubKeyBytes);

    // create group members (including myself aka admin)
    const allAddresses = [this.currentAddress, ...initialMemberAddresses];
    const uniqueAddresses = Array.from(new Set(allAddresses));

    const members: GroupMember[] = uniqueAddresses.map((address) => ({
      address,
      signingPubKey: address === this.currentAddress ? mySigningPubKey : "",
      joinedAtEpoch: 0,
    }));

    // create the group (i am the admin, so i have the seed)
    const group: Group = {
      id: groupId,
      tenantId: this.repositories.tenantId,
      name,
      adminAddress: this.currentAddress,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: "active",
      groupSeed, // admin only - used to derive new group_root_epoch on epoch change
      groupRootEpoch, // current epoch's root
      blindingKey, // shared among members for blinded group ID derivation
      currentEpoch: epoch,
      members,
      deviceId,
      msgCounter: 0,
    };

    // save the group
    await this.repositories.groupRepository.saveGroup(group);

    // distribute group_root_epoch to initial members (except myself)
    try {
      await this.distributeRootToAllMembers(groupId);
    } catch (error) {
      console.error("Error distributing root to initial members:", error);
      // group is still created, but root distribution failed
    }

    return { groupId, group };
  }

  /**
   * add a member to an existing group (admin only)
   */
  async addMember(groupId: string, memberAddress: string): Promise<void> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    // check if i am the admin
    if (group.adminAddress !== this.currentAddress) {
      throw new Error("Only the group admin can add members");
    }

    // check if member is already in the group
    if (group.members.some((m) => m.address === memberAddress)) {
      throw new Error("Member is already in the group");
    }

    await this.advanceEpochAndDistribute(group, "add", (updatedGroup) => {
      const newMember: GroupMember = {
        address: memberAddress,
        signingPubKey: "", // will be filled when they send messages
        joinedAtEpoch: updatedGroup.currentEpoch,
      };

      updatedGroup.members.push(newMember);
    });
  }

  /**
   * remove a member from the group (admin only)
   * removing member requires epoch change
   */
  async removeMember(groupId: string, memberAddress: string): Promise<void> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    // check if i am the admin
    if (group.adminAddress !== this.currentAddress) {
      throw new Error("Only the group admin can remove members");
    }

    // check if member exists
    if (!group.members.some((m) => m.address === memberAddress)) {
      throw new Error("Member is not in the group");
    }

    // remove the member first
    group.members = group.members.filter((m) => m.address !== memberAddress);

    await this.advanceEpochAndDistribute(group, "remove");

    console.log(
      `Removed member ${memberAddress} from group ${groupId}, rotated to epoch ${group.currentEpoch}`
    );
  }

  /**
   * leave a group (remove myself)
   */
  async leaveGroup(groupId: string): Promise<void> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    // if i'm the admin, i can't leave unless i transfer admin first
    if (group.adminAddress === this.currentAddress) {
      throw new Error("Admin must transfer ownership before leaving the group");
    }

    // mark the group as left
    group.status = "left";
    group.lastActivityAt = new Date();

    await this.repositories.groupRepository.saveGroup(group);

    console.log(`Left group ${groupId}`);
  }

  /**
   * manual key rotation (admin only)
   * same as member removal, without membership change
   */
  async rotateRoot(groupId: string): Promise<void> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    // check if i am the admin
    if (group.adminAddress !== this.currentAddress) {
      throw new Error("Only the group admin can rotate roots");
    }

    await this.advanceEpochAndDistribute(group, "rotate");

    console.log(
      `Rotated root for group ${groupId} to epoch ${group.currentEpoch}`
    );
  }

  private async advanceEpochAndDistribute(
    group: Group,
    reason: GroupEpochPayload["reason"],
    mutateGroup?: (group: Group) => void
  ): Promise<void> {
    group.currentEpoch += 1;

    if (!group.groupSeed) {
      throw new Error("Admin must have group_seed to derive new epoch root");
    }

    const groupRootEpochBytes = derive_group_root_epoch(
      hexToBytes(group.groupSeed),
      hexToBytes(group.id),
      BigInt(group.currentEpoch)
    );
    group.groupRootEpoch = bytesToHex(groupRootEpochBytes);

    group.msgCounter = 0;

    if (mutateGroup) {
      mutateGroup(group);
    }

    group.lastActivityAt = new Date();

    await this.repositories.groupRepository.saveGroup(group);

    try {
      await this.sendEpochChangeNotification(group.id, reason);
    } catch (error) {
      console.error("Error sending epoch change notification:", error);
    }

    try {
      await this.distributeRootToAllMembers(group.id);
    } catch (error) {
      console.error("Error distributing root to members:", error);
    }
  }

  /**
   * process a received group_root_epoch from admin
   * called when we receive a gctl_root message
   */
  async processReceivedRoot(
    groupId: string,
    adminAddress: string,
    groupRootEpoch: string,
    blindingKey: string,
    epoch: number,
    adminSigningPubKey: string,
    memberAddresses?: string[],
    groupName?: string
  ): Promise<void> {
    let group: Group;

    try {
      group = await this.repositories.groupRepository.getGroup(groupId);
    } catch {
      // group doesn't exist yet - create it
      // this happens when we're invited to a group
      console.log(
        `Group ${groupId} doesn't exist, creating it from root distribution`
      );

      // get my signing public key (x-only for schnorr)
      const privateKey = WalletStorageService.getPrivateKey(
        this.unlockedWallet
      );
      const mySigningPubKeyBytes = get_xonly_pubkey(
        hexToBytes(privateKey.toString())
      );
      const mySigningPubKey = bytesToHex(mySigningPubKeyBytes);

      // generate my device_id for deterministic msg_id
      const deviceIdBytes = generate_random_bytes(16);
      const deviceId = bytesToHex(deviceIdBytes);

      // create group members list
      const membersSet = new Set<string>();
      if (memberAddresses && memberAddresses.length > 0) {
        memberAddresses.forEach((addr) => membersSet.add(addr));
      } else {
        membersSet.add(adminAddress);
        membersSet.add(this.currentAddress);
      }

      // build members array with signing pub keys where known
      const members: GroupMember[] = Array.from(membersSet).map((address) => {
        if (address === this.currentAddress) {
          return {
            address,
            signingPubKey: mySigningPubKey,
            joinedAtEpoch: epoch,
          };
        } else if (address === adminAddress) {
          return {
            address,
            signingPubKey: adminSigningPubKey,
            joinedAtEpoch: epoch,
          };
        } else {
          return {
            address,
            signingPubKey: "",
            joinedAtEpoch: epoch,
          };
        }
      });

      group = {
        id: groupId,
        tenantId: this.repositories.tenantId,
        name: groupName || `Group ${groupId.substring(0, 8)}`,
        adminAddress, // admin is the one who invited us
        createdAt: new Date(),
        lastActivityAt: new Date(),
        status: "active",
        groupSeed: null, // only admin has seed, we just receive the derived root
        groupRootEpoch,
        blindingKey, // for deriving per-user blinded group IDs
        currentEpoch: epoch,
        members,
        deviceId,
        msgCounter: 0,
      };

      await this.repositories.groupRepository.saveGroup(group);
      console.log(
        `Created new group ${groupId} from root distribution with ${members.length} members`
      );
      return;
    }

    // existing group - update the root
    // verify sender is admin
    if (group.adminAddress !== adminAddress) {
      throw new Error("Root distribution must come from admin");
    }

    // update admin's signing pub key if needed
    const adminMember = group.members.find((m) => m.address === adminAddress);
    if (adminMember && !adminMember.signingPubKey) {
      adminMember.signingPubKey = adminSigningPubKey;
    }

    // update epoch and root
    if (epoch > group.currentEpoch) {
      group.currentEpoch = epoch;
      group.groupRootEpoch = groupRootEpoch;
      group.msgCounter = 0; // reset counter for new epoch
    } else if (epoch === group.currentEpoch) {
      // same epoch, just update root (might be initial distribution)
      group.groupRootEpoch = groupRootEpoch;
    } else {
      console.warn(
        `Received root for old epoch ${epoch}, current is ${group.currentEpoch}`
      );
      return;
    }

    // update blinding key if provided (should be stable but sync in case)
    if (blindingKey && !group.blindingKey) {
      group.blindingKey = blindingKey;
    }

    // update member list if provided
    if (memberAddresses && memberAddresses.length > 0) {
      const existingAddresses = new Set(group.members.map((m) => m.address));
      for (const addr of memberAddresses) {
        if (!existingAddresses.has(addr)) {
          group.members.push({
            address: addr,
            signingPubKey: "",
            joinedAtEpoch: epoch,
          });
        }
      }
    }

    // update name if provided (admin may have changed it)
    if (groupName && group.name !== groupName) {
      group.name = groupName;
    }

    group.lastActivityAt = new Date();
    await this.repositories.groupRepository.saveGroup(group);

    console.log(`Updated group ${groupId} with root for epoch ${epoch}`);
  }

  /**
   * get group by ID
   */
  async getGroup(groupId: string): Promise<Group> {
    return this.repositories.groupRepository.getGroup(groupId);
  }

  /**
   * get all active groups
   */
  async getActiveGroups(): Promise<Group[]> {
    return this.repositories.groupRepository.getActiveGroups();
  }

  /**
   * get the current group_root_epoch for encryption/decryption
   * all members use the same root
   */
  getGroupRootEpoch(group: Group): string {
    return group.groupRootEpoch;
  }

  /**
   * get and increment msg_counter for deterministic msg_id
   * persists the updated counter and returns the allocated value
   */
  async getNextMsgCounter(groupId: string): Promise<{
    counter: number;
    deviceId: string;
  }> {
    const group = await this.repositories.groupRepository.getGroup(groupId);
    const deviceId = group.deviceId;

    // increment and save, then return the allocated counter value
    group.msgCounter += 1;
    await this.repositories.groupRepository.saveGroup(group);

    return { counter: group.msgCounter, deviceId };
  }

  /**
   * check if we have the current epoch's root (can decrypt messages)
   */
  canDecryptMessages(group: Group): boolean {
    return !!group.groupRootEpoch;
  }

  /**
   * check if we are the admin (can manage group)
   */
  isAdmin(group: Group): boolean {
    return group.adminAddress === this.currentAddress;
  }

  /**
   * build group control payload for root distribution
   */
  private buildRootPayload(
    groupId: string,
    epoch: number,
    groupRootEpoch: string,
    blindingKey: string,
    adminSigningPubKey: string,
    memberAddresses?: string[],
    groupName?: string
  ): GroupControlPayload {
    return {
      type: "gctl_root",
      v: 1,
      group_id: groupId,
      epoch,
      group_root_epoch: groupRootEpoch,
      blinding_key: blindingKey,
      admin_signing_pub: adminSigningPubKey,
      members: memberAddresses,
      name: groupName,
    };
  }

  /**
   * build epoch change notification payload
   */
  private buildEpochPayload(
    groupId: string,
    epoch: number,
    reason: "add" | "remove" | "rotate"
  ): GroupEpochPayload {
    return {
      type: "gctl_epoch",
      v: 1,
      group_id: groupId,
      epoch,
      reason,
    };
  }

  /**
   * distribute group_root_epoch to a single member via COMM channel
   */
  private async distributeRootToMember(
    groupId: string,
    memberAddress: string,
    groupRootEpoch: string,
    epoch: number
  ): Promise<void> {
    console.log(
      `[distributeRootToMember] Starting for ${memberAddress} at epoch ${epoch}`
    );

    // ensure we have a 1:1 conversation with this member
    let conversationWithContact =
      this.conversationManager.getConversationWithContactByAddress(
        memberAddress
      );

    if (!conversationWithContact) {
      console.log(
        `[distributeRootToMember] No conversation found, creating one for ${memberAddress}`
      );
      const result =
        await this.conversationManager.createDiscreteConversation(
          memberAddress
        );
      conversationWithContact = {
        conversation: result.conversation,
        contact: result.contact,
      };
      console.log(
        `[distributeRootToMember] Created conversation for ${memberAddress}, status: ${conversationWithContact.conversation.status}`
      );
    } else {
      console.log(
        `[distributeRootToMember] Found existing conversation for ${memberAddress}, status: ${conversationWithContact.conversation.status}`
      );
    }

    // check conversation status
    const convStatus = conversationWithContact.conversation.status;
    if (convStatus !== "active") {
      console.warn(
        `[distributeRootToMember] Conversation with ${memberAddress} is not active (status: ${convStatus})`
      );
    }

    // get my signing public key (x-only for schnorr, i am admin)
    const privateKey = WalletStorageService.getPrivateKey(this.unlockedWallet);
    const mySigningPubKeyBytes = get_xonly_pubkey(
      hexToBytes(privateKey.toString())
    );
    const mySigningPubKey = bytesToHex(mySigningPubKeyBytes);

    // get group to include member list and name
    const group = await this.repositories.groupRepository.getGroup(groupId);
    const memberAddresses = group.members.map((m) => m.address);

    // build the root payload (include name and blinding_key so members get them)
    const rootPayload = this.buildRootPayload(
      groupId,
      epoch,
      groupRootEpoch,
      group.blindingKey,
      mySigningPubKey,
      memberAddresses,
      group.name
    );

    // sign the payload (reuse privateKey from above)
    const messageToSign = this.serializeRootForSigning(rootPayload);
    const signatureBytes = sign_message(
      hexToBytes(privateKey.toString()),
      new TextEncoder().encode(messageToSign)
    );

    if (!signatureBytes) {
      throw new Error("Failed to sign root payload");
    }

    rootPayload.sig = bytesToHex(signatureBytes);

    // send via COMM channel
    const payloadJson = JSON.stringify(rootPayload);

    const walletStore = useWalletStore.getState();
    if (!walletStore.sendMessageWithContext) {
      throw new Error("Wallet send function not available");
    }

    const aliasToUse = conversationWithContact.conversation.theirAlias;
    if (!aliasToUse) {
      throw new Error(
        `No alias available for ${memberAddress}. Conversation status: ${convStatus}, theirAlias: ${aliasToUse}, myAlias: ${conversationWithContact.conversation.myAlias}`
      );
    }

    console.log(
      `[distributeRootToMember] Sending root to ${memberAddress} via alias ${aliasToUse.substring(0, 20)}...`
    );

    const txId = await walletStore.sendMessageWithContext({
      message: payloadJson,
      toAddress: new Address(memberAddress),
      aliasToSendTo: aliasToUse,
      priorityFee: undefined,
    });

    console.log(
      `[distributeRootToMember] Success! Distributed root to ${memberAddress} via COMM, txId: ${txId}`
    );
  }

  /**
   * distribute group_root_epoch to all members (admin only)
   * returns a report of which distributions succeeded/failed
   */
  async distributeRootToAllMembers(groupId: string): Promise<{
    success: string[];
    failed: { address: string; error: string }[];
  }> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    // only the admin can distribute roots
    if (group.adminAddress !== this.currentAddress) {
      throw new Error("Only the group admin can distribute roots");
    }

    // distribute to all members except myself
    const otherMembers = group.members.filter(
      (m) => m.address !== this.currentAddress
    );

    // Check: ensure we have enough mature balance for all sends
    const walletStore = useWalletStore.getState();
    const requiredAmount = BigInt(otherMembers.length) * BigInt(20000000); // 0.2 KAS each in sompi
    if (!walletStore.balance || walletStore.balance.mature < requiredAmount) {
      const available = walletStore.balance?.mature ?? 0n;
      throw new Error(
        `Insufficient mature balance for distribution. Need ${Number(requiredAmount) / 100000000} KAS, have ${Number(available) / 100000000} KAS`
      );
    }

    const success: string[] = [];
    const failed: { address: string; error: string }[] = [];

    console.log(
      `[distributeRootToAllMembers] Starting distribution to ${otherMembers.length} members for group ${groupId} at epoch ${group.currentEpoch}`
    );

    for (const member of otherMembers) {
      try {
        console.log(
          `[distributeRootToAllMembers] Distributing to ${member.address}...`
        );
        await this.distributeRootToMember(
          groupId,
          member.address,
          group.groupRootEpoch,
          group.currentEpoch
        );
        success.push(member.address);
        console.log(
          `[distributeRootToAllMembers] Success for ${member.address}`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[distributeRootToAllMembers] FAILED for ${member.address}:`,
          errorMsg
        );
        failed.push({ address: member.address, error: errorMsg });
        // continue with other members
      }
    }

    console.log(
      `[distributeRootToAllMembers] Distribution complete: ${success.length} success, ${failed.length} failed`
    );

    if (failed.length > 0) {
      console.warn(
        `[distributeRootToAllMembers] Failed distributions:`,
        failed
      );
    }

    return { success, failed };
  }

  /**
   * process a received root distribution message
   */
  async processRootDistribution(
    payload: GroupControlPayload,
    senderAddress: string
  ): Promise<void> {
    // verify signature first
    if (!this.verifyRootPayloadSignature(payload)) {
      throw new Error("Invalid signature on root payload");
    }

    await this.processReceivedRoot(
      payload.group_id,
      senderAddress,
      payload.group_root_epoch,
      payload.blinding_key,
      payload.epoch,
      payload.admin_signing_pub,
      payload.members,
      payload.name
    );

    console.log(
      `Processed root distribution from ${senderAddress} for group ${payload.group_id}`
    );
  }

  /**
   * process a received epoch change notification
   * this is an informational message - the actual epoch/root update happens
   * when we receive gctl_root (which contains both epoch AND root atomically)
   *
   * IMPORTANT: we do NOT update the epoch here to avoid a race condition where
   * we have the new epoch number but the old root, causing encryption failures
   */
  async processEpochChange(
    payload: GroupEpochPayload,
    senderAddress: string
  ): Promise<void> {
    if (!payload.sig) {
      throw new Error("Missing signature on epoch payload");
    }

    let group: Group;
    try {
      group = await this.repositories.groupRepository.getGroup(
        payload.group_id
      );
    } catch {
      console.error(
        `Received epoch change for unknown group ${payload.group_id}`
      );
      return;
    }

    // verify sender is admin
    if (group.adminAddress !== senderAddress) {
      throw new Error("Epoch change notification must come from admin");
    }

    // verify signature using admin's signing pub key
    const adminMember = group.members.find((m) => m.address === senderAddress);
    if (!adminMember || !adminMember.signingPubKey) {
      throw new Error(
        "Cannot verify epoch signature: admin signing key not found"
      );
    }

    const messageToVerify = this.serializeEpochForSigning(payload);
    const signatureBytes = hexToBytes(payload.sig);
    const pubKeyBytes = hexToBytes(adminMember.signingPubKey);

    const signatureValid = verify_signature(
      pubKeyBytes,
      new TextEncoder().encode(messageToVerify),
      signatureBytes
    );

    if (!signatureValid) {
      throw new Error("Invalid signature on epoch payload");
    }

    // just log - we'll update epoch and root atomically when gctl_root arrives
    // this avoids race condition where epoch is updated but root is stale
    console.log(
      `Received epoch change notification for group ${payload.group_id}: current=${group.currentEpoch}, incoming=${payload.epoch} (reason: ${payload.reason}) - waiting for gctl_root`
    );
  }

  /**
   * send epoch change notification to all members (admin only)
   */
  private async sendEpochChangeNotification(
    groupId: string,
    reason: "add" | "remove" | "rotate"
  ): Promise<void> {
    const group = await this.repositories.groupRepository.getGroup(groupId);

    if (group.adminAddress !== this.currentAddress) {
      throw new Error("Only the group admin can send epoch notifications");
    }

    const epochPayload = this.buildEpochPayload(
      groupId,
      group.currentEpoch,
      reason
    );

    // sign the payload
    const privateKey = WalletStorageService.getPrivateKey(this.unlockedWallet);
    const messageToSign = this.serializeEpochForSigning(epochPayload);
    const signatureBytes = sign_message(
      hexToBytes(privateKey.toString()),
      new TextEncoder().encode(messageToSign)
    );

    if (!signatureBytes) {
      throw new Error("Failed to sign epoch payload");
    }

    epochPayload.sig = bytesToHex(signatureBytes);

    // send to all members except myself
    const otherMembers = group.members.filter(
      (m) => m.address !== this.currentAddress
    );

    for (const member of otherMembers) {
      try {
        let conversationWithContact =
          this.conversationManager.getConversationWithContactByAddress(
            member.address
          );

        if (!conversationWithContact) {
          const result =
            await this.conversationManager.createDiscreteConversation(
              member.address
            );
          conversationWithContact = {
            conversation: result.conversation,
            contact: result.contact,
          };
        }

        const payloadJson = JSON.stringify(epochPayload);

        const walletStore = useWalletStore.getState();
        if (!walletStore.sendMessageWithContext) {
          throw new Error("Wallet send function not available");
        }

        const aliasToUse = conversationWithContact.conversation.theirAlias;
        if (!aliasToUse) {
          throw new Error("No alias available for communication");
        }

        await walletStore.sendMessageWithContext({
          message: payloadJson,
          toAddress: new Address(member.address),
          aliasToSendTo: aliasToUse,
          priorityFee: undefined,
        });

        console.log(
          `Sent epoch change notification to ${member.address} for group ${groupId}`
        );
      } catch (error) {
        console.error(
          `Failed to send epoch change notification to ${member.address}:`,
          error
        );
      }
    }
  }

  /**
   * serialize root payload for signing
   */
  private serializeRootForSigning(
    payload: Omit<GroupControlPayload, "sig">
  ): string {
    return `${payload.v}${payload.type}${payload.group_id}${payload.epoch}${payload.group_root_epoch}${payload.blinding_key}${payload.admin_signing_pub}`;
  }

  /**
   * serialize epoch payload for signing
   */
  private serializeEpochForSigning(
    payload: Omit<GroupEpochPayload, "sig">
  ): string {
    return `${payload.v}${payload.type}${payload.group_id}${payload.epoch}${payload.reason}`;
  }

  /**
   * verify signature on root payload
   */
  private verifyRootPayloadSignature(payload: GroupControlPayload): boolean {
    if (!payload.sig) {
      return false;
    }

    try {
      const messageToVerify = this.serializeRootForSigning(payload);
      const signatureBytes = hexToBytes(payload.sig);
      const pubKeyBytes = hexToBytes(payload.admin_signing_pub);

      return verify_signature(
        pubKeyBytes,
        new TextEncoder().encode(messageToVerify),
        signatureBytes
      );
    } catch (error) {
      console.error("Error verifying signature:", error);
      return false;
    }
  }

  /**
   * derive sender_id for the current user
   * sender_id = SHA256(sender_address_bytes)
   */
  deriveMySenderId(): Uint8Array {
    return derive_sender_id(this.currentAddress);
  }
}
