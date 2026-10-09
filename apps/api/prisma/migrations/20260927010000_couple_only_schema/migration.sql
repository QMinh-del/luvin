-- Replace group-oriented couple persistence with the approved couple-only schema.

DELETE FROM "connection_members"
WHERE "connection_id" IN (SELECT "id" FROM "connections" WHERE "type" <> 'COUPLE');
DELETE FROM "connections" WHERE "type" <> 'COUPLE';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "connections" WHERE "type" <> 'COUPLE') THEN
    RAISE EXCEPTION 'C01_NON_COUPLE_CONNECTION_PRESENT';
  END IF;
END $$;

DROP TRIGGER IF EXISTS connection_members_group_invariants ON "connection_members";
DROP FUNCTION IF EXISTS enforce_group_membership_invariants();

ALTER TABLE "connection_members" DROP CONSTRAINT IF EXISTS "connection_members_invited_by_user_id_fkey";
DROP INDEX IF EXISTS "connection_members_connection_id_state_role_idx";
ALTER TABLE "connection_members" DROP COLUMN IF EXISTS "invited_by_user_id";
ALTER TABLE "connection_members" DROP COLUMN IF EXISTS "role";
ALTER TABLE "connection_members" DROP COLUMN IF EXISTS "removed_at";

UPDATE "connection_members" SET "state" = 'LEFT' WHERE "state" = 'REMOVED';

CREATE TYPE "CouplePartnerState" AS ENUM ('INVITED', 'ACTIVE', 'LEFT');
ALTER TABLE "connection_members" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "connection_members"
  ALTER COLUMN "state" TYPE "CouplePartnerState"
  USING ("state"::text::"CouplePartnerState");

ALTER TABLE "connection_members" RENAME TO "connection_partners";
ALTER TABLE "connection_partners" RENAME CONSTRAINT "connection_members_pkey" TO "connection_partners_pkey";
ALTER TABLE "connection_partners" RENAME CONSTRAINT "connection_members_connection_id_fkey" TO "connection_partners_connection_id_fkey";
ALTER TABLE "connection_partners" RENAME CONSTRAINT "connection_members_user_id_fkey" TO "connection_partners_user_id_fkey";
ALTER INDEX "connection_members_user_id_state_idx" RENAME TO "connection_partners_user_id_state_idx";
ALTER INDEX "connection_members_connection_id_user_id_key" RENAME TO "connection_partners_connection_id_user_id_key";
CREATE INDEX "connection_partners_connection_id_state_idx" ON "connection_partners"("connection_id", "state");

ALTER TABLE "connections" DROP CONSTRAINT "connections_created_by_user_id_fkey";
ALTER TABLE "connections" RENAME COLUMN "created_by_user_id" TO "requested_by_user_id";
ALTER TABLE "connections"
  ADD CONSTRAINT "connections_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "connections_type_state_idx";
ALTER INDEX "connections_created_by_user_id_state_idx" RENAME TO "connections_requested_by_user_id_state_idx";
ALTER TABLE "connections" DROP COLUMN "type";
ALTER TABLE "connections" DROP COLUMN "name";

ALTER TABLE "conversations" DROP COLUMN "type";

DROP TYPE "ConnectionType";
DROP TYPE "MembershipRole";
DROP TYPE "MembershipState";
DROP TYPE "ConversationType";

ALTER TABLE "users" ADD CONSTRAINT "users_deletion_state_check" CHECK (
  (
    "account_state" = 'PENDING_DELETION'
    AND "deletion_requested_at" IS NOT NULL
    AND "deletion_execute_at" IS NOT NULL
    AND "deleted_at" IS NULL
  )
  OR (
    "account_state" = 'DELETED'
    AND "deleted_at" IS NOT NULL
  )
  OR (
    "account_state" NOT IN ('PENDING_DELETION', 'DELETED')
    AND "deletion_requested_at" IS NULL
    AND "deletion_execute_at" IS NULL
    AND "deleted_at" IS NULL
  )
);

CREATE OR REPLACE FUNCTION enforce_couple_partner_invariants() RETURNS trigger AS $$
DECLARE
  partner_count integer;
  open_count integer;
  conn_state "ConnectionState";
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('couple-connection:' || NEW."connection_id"::text));
  PERFORM pg_advisory_xact_lock(hashtext('couple-user:' || NEW."user_id"::text));

  SELECT COUNT(*) INTO partner_count
  FROM "connection_partners"
  WHERE "connection_id" = NEW."connection_id"
    AND "id" IS DISTINCT FROM NEW."id";
  IF partner_count + 1 > 2 THEN
    RAISE EXCEPTION 'COUPLE_THIRD_PARTNER';
  END IF;

  SELECT "state" INTO conn_state FROM "connections" WHERE "id" = NEW."connection_id";
  IF NEW."state" IN ('INVITED', 'ACTIVE') AND conn_state IN ('PENDING', 'ACTIVE') THEN
    SELECT COUNT(*) INTO open_count
    FROM "connection_partners" p
    JOIN "connections" c ON c."id" = p."connection_id"
    WHERE p."user_id" = NEW."user_id"
      AND p."state" IN ('INVITED', 'ACTIVE')
      AND c."state" IN ('PENDING', 'ACTIVE')
      AND p."id" IS DISTINCT FROM NEW."id";
    IF open_count >= 1 THEN
      RAISE EXCEPTION 'COUPLE_ALREADY_OPEN';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connection_partners_couple_invariants
  BEFORE INSERT OR UPDATE ON "connection_partners"
  FOR EACH ROW EXECUTE FUNCTION enforce_couple_partner_invariants();

CREATE OR REPLACE FUNCTION enforce_connection_state_invariants() RETURNS trigger AS $$
BEGIN
  IF NEW."state" IN ('PENDING', 'ACTIVE')
     AND OLD."state" IN ('DISCONNECTED', 'DELETED') THEN
    RAISE EXCEPTION 'COUPLE_CANNOT_REACTIVATE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connections_state_invariants
  BEFORE UPDATE ON "connections"
  FOR EACH ROW EXECUTE FUNCTION enforce_connection_state_invariants();
