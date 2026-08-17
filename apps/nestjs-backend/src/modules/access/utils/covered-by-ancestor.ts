import { ConflictException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import type { AccessSubject } from '../access.types';
import { ancestorCoveringQuery } from './sharing-coverage';

export async function assertNotCoveredByAncestor(
  accessRepository: Pick<
    AccessRepository,
    'hasCoveringAncestorGrant' | 'hasCoveringAncestorInvite'
  >,
  input: {
    subject: AccessSubject;
    userId?: string;
    email?: string;
  },
): Promise<void> {
  const ancestor = ancestorCoveringQuery(input.subject);
  if (!ancestor) {
    return;
  }

  const checks: Promise<boolean>[] = [];

  if (input.userId) {
    checks.push(
      accessRepository.hasCoveringAncestorGrant({
        userId: input.userId,
        ...ancestor,
      }),
    );
  }

  if (input.email) {
    checks.push(
      accessRepository.hasCoveringAncestorInvite({
        email: input.email,
        ...ancestor,
      }),
    );
  }

  const covered = (await Promise.all(checks)).some(Boolean);
  if (covered) {
    throw new ConflictException('already_covered');
  }
}
