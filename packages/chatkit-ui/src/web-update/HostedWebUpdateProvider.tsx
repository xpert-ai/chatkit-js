import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Toaster } from '../components/ui/sonner';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { getSurfaceThemeStyle } from '../lib/theme-surfaces';
import { useTheme } from '../providers/Theme';
import { HostedWebUpdateContext } from './context';
import {
  createStandaloneWebUpdate,
  prepareWebUpdate,
  readStandaloneRelease,
  reloadWebUpdate,
  watchWebUpdate,
} from './web-update-browser';
import type { WebUpdateController } from './web-update-state';
import { WebUpdateRecoveryBoundary } from './WebUpdateRecoveryBoundary';

export function HostedWebUpdateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [controller] = React.useState(() => {
    const release = readStandaloneRelease();
    return release ? createStandaloneWebUpdate(release) : null;
  });
  return controller ? (
    <EnabledWebUpdate controller={controller}>{children}</EnabledWebUpdate>
  ) : (
    children
  );
}

function EnabledWebUpdate({
  children,
  controller,
}: {
  children: React.ReactNode;
  controller: WebUpdateController;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const state = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [about, setAbout] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const updatingRef = React.useRef(false);
  const mounted = React.useRef(false);
  const leaves = React.useRef(new Set<() => Promise<boolean>>());
  const toasterId = React.useId();
  const available =
    !!state.latest && state.latest.buildId !== controller.current.buildId;
  const surface = getSurfaceThemeStyle(theme);
  const context = React.useMemo(
    () => ({
      openAbout: () => {
        setAbout(true);
        void controller.check();
      },
      registerLeave: (prepare: () => Promise<boolean>) => {
        leaves.current.add(prepare);
        return () => {
          leaves.current.delete(prepare);
        };
      },
    }),
    [controller],
  );

  React.useEffect(() => {
    mounted.current = true;
    const stop = watchWebUpdate(controller);
    return () => {
      mounted.current = false;
      stop();
    };
  }, [controller]);
  const notifiedBuild =
    available && !state.dismissed ? state.latest?.buildId : null;
  React.useEffect(() => {
    if (!notifiedBuild) return;
    const id = toast.info(
      t(state.incomplete ? 'webUpdate.incomplete' : 'webUpdate.notice'),
      {
        toasterId,
        duration: Infinity,
        closeButton: true,
        action: {
          label: t('webUpdate.updateNow'),
          onClick: (event) => {
            event.preventDefault();
            setConfirm(true);
          },
        },
        onDismiss: () => controller.dismiss(notifiedBuild),
      },
    );
    return () => {
      toast.dismiss(id);
    };
  }, [controller, notifiedBuild, state.incomplete, t, toasterId]);

  const update = async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(true);
    try {
      const prepared = await prepareWebUpdate(leaves.current);
      if (!mounted.current) return;
      if (!prepared) {
        toast.error(t('webUpdate.leaveFailed'), { toasterId });
        return;
      }
      await controller.check();
      if (!mounted.current || controller.state.status === 'failed') return;
      reloadWebUpdate(controller);
      setConfirm(false);
    } catch {
      toast.error(t('webUpdate.leaveFailed'), { toasterId });
    } finally {
      updatingRef.current = false;
      if (mounted.current) setUpdating(false);
    }
  };

  const statusKey =
    state.status === 'checking'
      ? 'checking'
      : state.status === 'failed'
        ? 'checkFailed'
        : state.incomplete
          ? 'incomplete'
          : {
              idle: 'notChecked',
              current: 'latest',
              available: 'available',
            }[state.status];
  const checkFailed = state.status === 'failed';
  return (
    <HostedWebUpdateContext.Provider value={context}>
      <WebUpdateRecoveryBoundary
        onError={() => {
          void controller.check();
        }}
        fallback={
          <div
            role="alert"
            className="flex flex-col items-start text-sm text-foreground"
            style={{
              padding: 'calc(1.5rem * var(--chat-density-scale, 1))',
              gap: 'calc(0.75rem * var(--chat-density-scale, 1))',
            }}
          >
            <p>{t('webUpdate.loadFailed')}</p>
            <Button variant="outline" onClick={context.openAbout}>
              {t('webUpdate.about')}
            </Button>
          </div>
        }
      >
        {children}
      </WebUpdateRecoveryBoundary>
      <Toaster
        id={toasterId}
        position="bottom-left"
        closeButton
        containerAriaLabel={t('webUpdate.notifications')}
        toastOptions={{ closeButtonAriaLabel: t('webUpdate.dismiss') }}
      />
      <Dialog open={about} onOpenChange={setAbout}>
        <DialogContent style={surface}>
          <DialogHeader>
            <DialogTitle>{t('webUpdate.about')}</DialogTitle>
            <DialogDescription>
              {t('webUpdate.version', { version: controller.current.version })}
            </DialogDescription>
          </DialogHeader>
          <p role="status" className="text-sm text-muted-foreground">
            {t(`webUpdate.${statusKey}`)}
          </p>
          <div
            className="flex justify-end"
            style={{ gap: 'calc(0.5rem * var(--chat-density-scale, 1))' }}
          >
            <Button
              disabled={updating || state.status === 'checking'}
              onClick={() => {
                if (available && !checkFailed) setConfirm(true);
                else void controller.check();
              }}
            >
              {t(
                checkFailed
                  ? 'webUpdate.retry'
                  : available
                    ? 'webUpdate.updateNow'
                    : 'webUpdate.check',
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!updatingRef.current) setConfirm(open);
        }}
      >
        <DialogContent style={surface}>
          <DialogHeader>
            <DialogTitle>{t('webUpdate.updateNow')}</DialogTitle>
            <DialogDescription>{t('webUpdate.confirmSaved')}</DialogDescription>
          </DialogHeader>
          {checkFailed && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('webUpdate.checkFailed')}
            </p>
          )}
          <div
            className="flex justify-end"
            style={{ gap: 'calc(0.5rem * var(--chat-density-scale, 1))' }}
          >
            <Button
              variant="outline"
              disabled={updating}
              onClick={() => setConfirm(false)}
            >
              {t('webUpdate.cancel')}
            </Button>
            <Button
              disabled={updating}
              onClick={() => {
                void update();
              }}
            >
              {t('webUpdate.updateNow')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </HostedWebUpdateContext.Provider>
  );
}
