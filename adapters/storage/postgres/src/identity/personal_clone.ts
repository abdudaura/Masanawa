import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import {
  createPostgresIdentityRepository,
  loadCharacter,
  loadCharacterVersion,
} from "./repository.js";

export function createPostgresPersonalCloneProvisioningRepository(
  pool: Pool,
): PersonalCloneProvisioningRepository {
  return Object.freeze<PersonalCloneProvisioningRepository>({
    async readPersonalClone(input) {
      return withTransaction(
        pool,
        async (client) =>
          createPostgresIdentityRepository(client).readPersonalCloneForUser(input),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async getOrCreatePersonalClone(input) {
      return withTransaction(
        pool,
        async (client) => {
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtext($1))",
            [`identity:personal-clone:${input.tenantId}:${input.userId}`],
          );

          const identity = createPostgresIdentityRepository(client);
          const existing = await identity.readPersonalCloneForUser({
            tenantId: input.tenantId,
            userId: input.userId,
          });

          if (existing) {
            const character = await loadCharacter(
              client,
              input.tenantId,
              existing.characterId,
            );
            if (!character.activeCharacterVersionId) {
              throw new Error("Existing personal clone has no active CharacterVersion");
            }
            const version = await loadCharacterVersion(
              client,
              input.tenantId,
              character.activeCharacterVersionId,
            );
            const relationship = await identity.getOrCreateRelationship({
              tenantId: input.tenantId,
              relationshipId: input.relationshipId,
              userId: input.userId,
              characterId: existing.characterId,
              createdAt: input.createdAt,
            });
            return Object.freeze({
              character,
              version,
              ownership: existing,
              relationship,
              created: false,
            });
          }

          await identity.createCharacter({
            tenantId: input.tenantId,
            characterId: input.characterId,
            createdAt: input.createdAt,
          });
          const ownership = await identity.assignCharacterOwnership({
            tenantId: input.tenantId,
            characterId: input.characterId,
            kind: "personal-clone",
            ownerUserId: input.userId,
            createdAt: input.createdAt,
          });
          await identity.createCharacterVersion({
            tenantId: input.tenantId,
            characterVersionId: input.characterVersionId,
            characterId: input.characterId,
            versionNumber: 1,
            constitution: input.constitution,
            createdAt: input.createdAt,
          });
          const version = await identity.publishCharacterVersion({
            tenantId: input.tenantId,
            characterVersionId: input.characterVersionId,
            publishedAt: input.createdAt,
          });
          const character = await identity.activateCharacterVersion({
            tenantId: input.tenantId,
            characterId: input.characterId,
            characterVersionId: input.characterVersionId,
            expectedCharacterRevision: 1,
            activatedAt: input.createdAt,
          });
          const relationship = await identity.getOrCreateRelationship({
            tenantId: input.tenantId,
            relationshipId: input.relationshipId,
            userId: input.userId,
            characterId: input.characterId,
            createdAt: input.createdAt,
          });

          return Object.freeze({
            character,
            version,
            ownership,
            relationship,
            created: true,
          });
        },
        { isolation: "serializable" },
      );
    },
  });
}
