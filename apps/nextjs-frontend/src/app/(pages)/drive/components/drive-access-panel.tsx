'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AccessSubjectType,
  InheritedShareLayer,
  ShareSource,
} from '@sdr/shared/access';
import { shareByEmailSchema } from '@sdr/shared/access';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreatePublicLink } from '@/app/hooks/mutations/use-create-public-link';
import { useRevokeAccess } from '@/app/hooks/mutations/use-revoke-access';
import { useShareByEmail } from '@/app/hooks/mutations/use-share-by-email';
import { useShares } from '@/app/hooks/queries/use-shares';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { CopyIcon, LinkIcon, PeopleIcon } from '@/components/ui/icons';
import { TextField } from '@/components/ui/text-field';
import { UserAvatar } from '@/components/user-avatar';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { useToastStore } from '@/store/toast.store';
import { AccessDurationSelect } from '@/app/components/access-duration-select';
import type { AccessDurationId } from '@/app/lib/access-duration';
import { expiresAtFromPreset } from '@/app/lib/access-duration';
import type { Messages } from '@/app/lib/i18n/en';
import { useT } from '@/app/lib/i18n/use-t';
import { formatAccessUntil } from './drive-format';
import {
  coveredAncestorHint,
  inheritedLabel,
} from './drive-sharing-label';

type DriveAccessPanelProps = {
  type: AccessSubjectType;
  id: string;
  name: string;
  onClose: () => void;
  onOpenSource: (source: ShareSource) => void;
};

const emailFormSchema = shareByEmailSchema.pick({ email: true });

type PendingRevoke =
  | { kind: 'grant' | 'invite'; id: string; label: string }
  | { kind: 'public_link'; id: string };

export function DriveAccessPanel({
  type,
  id,
  name,
  onOpenSource,
}: DriveAccessPanelProps) {
  const t = useT();
  const shareErrorOverrides = {
    forbidden: t.errors.onlyOwnerCanShare,
    not_found: t.errors.fileOrFolderNotFound,
  };
  const sharesQuery = useShares({ type, id });
  const createLink = useCreatePublicLink();
  const shareByEmail = useShareByEmail();
  const revokeAccess = useRevokeAccess();
  const pushToast = useToastStore((state) => state.push);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<PendingRevoke | null>(
    null,
  );
  const [linkDuration, setLinkDuration] = useState<AccessDurationId>('forever');
  const [peopleDuration, setPeopleDuration] =
    useState<AccessDurationId>('forever');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  });

  const shares = sharesQuery.data;
  const isBusy =
    createLink.isPending || shareByEmail.isPending || revokeAccess.isPending;
  const affectsTree = type !== 'file';
  const publicUrl =
    publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/share?${new URLSearchParams({
          token: publicToken,
        }).toString()}`
      : null;

  const clearMessages = () => {
    setErrorMessage(null);
  };

  const runRevoke = (pending: PendingRevoke) => {
    clearMessages();
    revokeAccess.mutate(
      { kind: pending.kind, id: pending.id },
      {
        onSuccess: () => {
          if (pending.kind === 'public_link') {
            setPublicToken(null);
            pushToast(t.access.linkOff, 'info');
          } else {
            pushToast(t.access.accessRemoved, 'info');
          }
          setPendingRevoke(null);
        },
        onError: (error) => {
          setPendingRevoke(null);
          setErrorMessage(shareError(error, shareErrorOverrides));
        },
      },
    );
  };

  const requestRevoke = (pending: PendingRevoke) => {
    if (affectsTree) {
      setPendingRevoke(pending);
      return;
    }

    runRevoke(pending);
  };

  const onCreateLink = () => {
    clearMessages();
    createLink.mutate(
      { type, id, expiresAt: expiresAtFromPreset(linkDuration) },
      {
        onSuccess: (data) => {
          setPublicToken(data.token);
          pushToast(t.access.linkCreated, 'success');
        },
        onError: (error) =>
          setErrorMessage(shareError(error, shareErrorOverrides)),
      },
    );
  };

  const onInvite = handleSubmit((values) => {
    clearMessages();
    shareByEmail.mutate(
      { email: values.email, type, id, role: 'viewer', expiresAt: expiresAtFromPreset(peopleDuration) },
      {
        onSuccess: (result) => {
          reset({ email: '' });
          pushToast(
            result.kind === 'grant'
              ? t.access.granted(result.email)
              : t.access.invited(result.email),
            'success',
          );
        },
        onError: (error) => {
          if (!applyApiIssues(error, setError)) {
            setErrorMessage(
              shareCoveredMessage(
                error,
                values.email,
                shares?.inherited,
                shareErrorOverrides,
              ),
            );
          }
        },
      },
    );
  });

  const onCopy = async () => {
    if (!publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      pushToast(t.access.linkCopied, 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMessage(t.access.copyFailed);
    }
  };

  const loadError =
    sharesQuery.error && sharesQuery.error.statusCode !== 401
      ? sharesQuery.error
      : null;

  return (
    <>
    <div className="flex max-h-[min(70dvh,36rem)] min-h-0 flex-col gap-5 overflow-y-auto">
        {loadError ? (
          <p role="alert" className="text-sm text-danger">
            {shareError(loadError, shareErrorOverrides)}
          </p>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
            <PeopleIcon className="h-4 w-4 text-muted" />
            {t.access.peopleWithAccess}
          </h3>
          <form onSubmit={onInvite} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <TextField
                id="share-email"
                label="Email"
                type="email"
                autoComplete="off"
                placeholder="colleague@company.com"
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
            <AccessDurationSelect
              id="share-people-duration"
              label={t.access.duration}
              value={peopleDuration}
              onChange={setPeopleDuration}
              disabled={isBusy}
            />
            <Button
              type="submit"
              className="w-full sm:mt-7 sm:w-auto"
              isLoading={shareByEmail.isPending}
            >
              {t.common.add}
            </Button>
          </form>
          <p className="text-xs text-muted">{t.access.guestsViewOnly}</p>

          {sharesQuery.isPending ? (
            <p className="text-sm text-muted">{t.common.loading}</p>
          ) : null}

          {shares &&
          shares.grants.length === 0 &&
          shares.invitations.length === 0 ? (
            <p className="text-sm text-muted">{t.access.onlyYou}</p>
          ) : null}

          <ul className="flex flex-col">
            {shares?.grants.map((grant) => (
              <li
                key={grant.id}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 sm:gap-3"
              >
                <UserAvatar name={grant.name} email={grant.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{grant.name}</p>
                  <p className="truncate text-xs text-muted">
                    {grant.email} · {t.access.viewerDot}
                    {grant.expiresAt
                      ? t.access.untilDot(formatAccessUntil(grant.expiresAt))
                      : t.access.foreverDot}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={isBusy}
                  onClick={() =>
                    requestRevoke({
                      kind: 'grant',
                      id: grant.id,
                      label: grant.name,
                    })
                  }
                >
                  {t.access.removeAccess}
                </Button>
              </li>
            ))}
            {shares?.invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 sm:gap-3"
              >
                <UserAvatar email={invite.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{invite.email}</p>
                  <p className="text-xs text-muted">
                    {t.access.inviteSentDot} · {t.access.viewerDot}
                    {invite.accessExpiresAt
                      ? t.access.untilDot(formatAccessUntil(invite.accessExpiresAt))
                      : t.access.foreverDot}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={isBusy}
                  onClick={() =>
                    requestRevoke({
                      kind: 'invite',
                      id: invite.id,
                      label: invite.email,
                    })
                  }
                >
                  {t.access.removeAccess}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
            <LinkIcon className="h-4 w-4 text-muted" />
            {t.access.anyoneWithLink}
          </h3>
          <p className="text-sm text-muted">{t.access.anyoneCanView}</p>
          {shares?.publicLink ? (
            <div className="flex flex-col gap-2">
              {publicUrl ? (
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    readOnly
                    value={publicUrl}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => void onCopy()}
                  >
                    <CopyIcon className="h-4 w-4" />
                    {copied ? t.common.copied : t.common.copy}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted">{t.access.copyOnlyOnCreate}</p>
              )}
              <p className="text-xs text-muted">
                {shares.publicLink.expiresAt
                  ? t.access.activeUntil(formatAccessUntil(shares.publicLink.expiresAt))
                  : t.common.forever}
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={() =>
                  shares.publicLink
                    ? requestRevoke({
                        kind: 'public_link',
                        id: shares.publicLink.id,
                      })
                    : undefined
                }
              >
                {t.access.turnOffLink}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <AccessDurationSelect
                  id="share-link-duration"
                  label={t.access.linkDuration}
                  value={linkDuration}
                  onChange={setLinkDuration}
                  disabled={createLink.isPending}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={onCreateLink}
                isLoading={createLink.isPending}
              >
                {t.access.createLink}
              </Button>
            </div>
          )}
        </section>

        {shares && shares.inherited.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-fg">{t.access.accessFromParent}</h3>
            {shares.inherited.map((layer) => (
              <div
                key={`${layer.source.type}:${layer.source.id}`}
                className="rounded-lg border border-border p-3"
              >
                <p className="text-sm text-fg">
                  {inheritedLabel(layer.source.type, layer.source.name)}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {layer.publicLink ? <li>{t.access.link}</li> : null}
                  {layer.grants.map((grant) => (
                    <li key={grant.id} className="truncate">
                      {grant.name} · {grant.email}
                    </li>
                  ))}
                  {layer.invitations.map((invite) => (
                    <li key={invite.id} className="truncate">
                      {invite.email} · {t.access.inviteSentDot}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3"
                  onClick={() => onOpenSource(layer.source)}
                >
                  {t.common.change}
                </Button>
              </div>
            ))}
          </section>
        ) : null}
      </div>

      {pendingRevoke ? (
        <Dialog
          title={
            pendingRevoke.kind === 'public_link'
              ? t.access.turnOffLinkTitle
              : t.access.removeAccessTitle
          }
          onClose={() => setPendingRevoke(null)}
          closeDisabled={revokeAccess.isPending}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg">
              {pendingRevoke.kind === 'public_link'
                ? treeLinkCopy(t, type, name)
                : treeGrantCopy(t, pendingRevoke.label, type)}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={revokeAccess.isPending}
                onClick={() => setPendingRevoke(null)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={revokeAccess.isPending}
                onClick={() => runRevoke(pendingRevoke)}
              >
                {pendingRevoke.kind === 'public_link'
                  ? t.access.turnOff
                  : t.access.removeAccess}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function DriveAccessDialog(props: DriveAccessPanelProps) {
  const t = useT();

  return (
    <Dialog
      title={props.name}
      subtitle={t.access.subtitle}
      size="lg"
      onClose={props.onClose}
    >
      <DriveAccessPanel {...props} />
    </Dialog>
  );
}

function treeGrantCopy(
  t: Messages,
  who: string,
  type: AccessSubjectType,
): string {
  if (type === 'data_room') {
    return t.access.treeGrantRoom(who);
  }

  if (type === 'folder') {
    return t.access.treeGrantFolder(who);
  }

  return t.access.treeGrantFile(who);
}

function treeLinkCopy(
  t: Messages,
  type: AccessSubjectType,
  name: string,
): string {
  if (type === 'data_room' || type === 'folder') {
    return t.access.treeLinkFolder(name);
  }

  return t.access.treeLinkFile(name);
}

function shareError(
  error: ApiRequestError,
  overrides: { forbidden: string; not_found: string },
): string {
  return apiErrorMessage(error, overrides);
}

function shareCoveredMessage(
  error: ApiRequestError,
  email: string,
  inherited: InheritedShareLayer[] | undefined,
  overrides: { forbidden: string; not_found: string },
): string {
  if (error.code === 'already_covered') {
    return (
      coveredAncestorHint(email, inherited ?? []) ?? shareError(error, overrides)
    );
  }

  return shareError(error, overrides);
}
