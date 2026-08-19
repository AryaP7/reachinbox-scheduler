import { prisma } from '../lib/prisma';
import { createEtherealAccount } from '../lib/mailer';
import { config } from '../config';

/**
 * Auto-provision Ethereal sender accounts on first boot so the system
 * always has multiple senders to rotate through.
 */
export async function ensureSenders(): Promise<void> {
  const existing = await prisma.sender.count();
  if (existing >= config.senderCount) return;

  const toCreate = config.senderCount - existing;
  console.log(`[senders] provisioning ${toCreate} Ethereal account(s)...`);
  for (let i = existing + 1; i <= config.senderCount; i++) {
    const account = await createEtherealAccount(i);
    // upsert keeps boot idempotent if Ethereal ever hands back a duplicate.
    await prisma.sender.upsert({
      where: { email: account.email },
      update: {},
      create: account,
    });
    console.log(`[senders] created ${account.email}`);
  }
}
