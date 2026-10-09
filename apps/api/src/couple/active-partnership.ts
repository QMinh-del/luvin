import { CouplePartnerState, ConnectionState } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type ActivePartnership = {
  partnerUserId: string;
  blocked: boolean;
};

export async function loadActivePartnership(
  prisma: PrismaClient,
  actorUserId: string,
  connectionId: string,
): Promise<ActivePartnership | null> {
  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      state: ConnectionState.ACTIVE,
      partners: {
        some: { userId: actorUserId, state: CouplePartnerState.ACTIVE },
      },
    },
    select: {
      partners: {
        where: { state: CouplePartnerState.ACTIVE },
        select: { userId: true },
      },
    },
  });
  if (!connection) {
    return null;
  }
  const partner = connection.partners.find(
    (member) => member.userId !== actorUserId,
  );
  if (!partner || connection.partners.length !== 2) {
    return null;
  }
  const block = await prisma.userBlock.findFirst({
    where: {
      revokedAt: null,
      OR: [
        { blockerUserId: actorUserId, blockedUserId: partner.userId },
        { blockerUserId: partner.userId, blockedUserId: actorUserId },
      ],
    },
    select: { id: true },
  });
  return { partnerUserId: partner.userId, blocked: block !== null };
}
