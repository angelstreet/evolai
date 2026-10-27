'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { supportedLocales, type SupportedLocale } from '@evolai/i18n';
import { setLocaleAction } from '@/lib/localeAction';
import { AppIcon } from '@evolai/ui';
import { THEME_COOKIE } from '@/lib/themeChoice';
import { useI18n } from '../I18nProvider';
import { QUIET_HEADER_SX, ViewAsForm, viewAsMenuItems, type ViewAsMenu } from './ViewAsMenuSection';

const YEAR = 31536000;

/** Same icon column and text start on every account menu row, links and buttons alike. */
const MENU_ITEM_SX = {
  minHeight: 44,
  gap: 0,
  '& .MuiListItemIcon-root': { minWidth: 36 },
} as const;

/** One standard "FR | EN" toggle group (docs/UI_RULES.md §0); codes as text, same in every locale. */
export function LanguageToggle() {
  const { locale, t } = useI18n();
  const [, startTransition] = useTransition();
  const choose = (_e: MouseEvent<HTMLElement>, next: SupportedLocale | null) => {
    // An exclusive group reports null when the active button is pressed again: ignore it.
    if (!next || next === locale) return;
    // Server action: sets the cookie and re-renders on the server in one round trip (no flash).
    startTransition(() => setLocaleAction(next));
  };
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={locale}
      onChange={choose}
      aria-label={t('common.language.switcherAria')}
      data-testid="language-toggle"
      sx={{ '& .MuiToggleButton-root': { minWidth: 44, minHeight: 44, px: 2, fontWeight: 600 } }}
    >
      {supportedLocales.map((l) => (
        <ToggleButton key={l} value={l} lang={l} data-testid={`switch-${l}`}>
          {l.toUpperCase()}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** Sun/moon icon button; the choice is a cookie so the server renders it without a flash. */
export function ThemeToggle() {
  const { t } = useI18n();
  const { mode, systemMode, setMode } = useColorScheme();
  // Before mount the resolved scheme is unknown on the server; keep a stable icon and label.
  const scheme = (mode === 'system' ? systemMode : mode) ?? 'light';
  const next = scheme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('common.theme.toDark') : t('common.theme.toLight');
  const toggle = () => {
    setMode(next);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  };
  return (
    <Tooltip title={label}>
      <IconButton data-testid="theme-button" aria-label={label} onClick={toggle}>
        <AppIcon name={scheme === 'dark' ? 'themeLight' : 'themeDark'} />
      </IconButton>
    </Tooltip>
  );
}

export interface Identity {
  readonly name: string;
  readonly email: string | null;
  readonly role: string;
  readonly organisation: string | null;
  readonly organisationCount: number;
  /** Organisations the session may work on, current first (staff only). */
  readonly organisations?: ReadonlyArray<{ id: string; label: string }>;
  readonly organisationId?: string | null;
  readonly homeHref?: string;
  /** Where "Workspace" leads: the admin area, or the team space for a client view. */
  readonly workspaceHref?: string;
  /** Account menu "Settings": workspace Settings for staff (TASK-AD2); the client home otherwise. */
  readonly settingsHref?: string;
  /** Owner only: the "View as" section (TASK-P). */
  readonly viewAs?: ViewAsMenu | null;
}

const initialsOf = (name: string): string =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Account control (docs/UI_RULES.md §11). Signed out: a sign-in icon button. Signed in: the
 * initials avatar plus name (name hidden on phones), opening a menu with name, email, role,
 * organisation, switch organisation and sign out. A signed-in screen is never anonymous.
 */
export function AccountMenu({ identity }: { identity: Identity | null }) {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const roleLine = identity
    ? `${identity.role}${identity.organisation ? ` · ${identity.organisation}` : ''}`
    : '';
  if (!identity) {
    return (
      <Tooltip title={t('common.account.signIn')}>
        <IconButton
          data-testid="sign-in-button"
          href="/login"
          aria-label={t('common.account.signIn')}
        >
          <AppIcon name="signIn" />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <>
      <Button
        data-testid="account-button"
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? 'account-menu' : undefined}
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        color="inherit"
        sx={{ px: 1.5, gap: 2, minWidth: 44, color: 'text.primary' }}
      >
        <Avatar
          aria-hidden
          sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {initialsOf(identity.name)}
          </Typography>
        </Avatar>
        {/* The name is the button's accessible name; on phones it is visually hidden, not removed. */}
        <Box
          component="span"
          className="account-name"
          sx={(theme) => ({
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            [theme.breakpoints.down('md')]: {
              position: 'absolute',
              width: 1,
              height: 1,
              clip: 'rect(0 0 0 0)',
            },
          })}
        >
          {identity.name}
        </Box>
        <AppIcon name="expand" size={16} sx={{ display: { xs: 'none', md: 'block' } }} />
      </Button>
      <Menu
        id="account-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260, width: 320, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Box sx={{ px: 4, py: 3 }} data-testid="account-identity">
          <Typography variant="cardTitle" component="p" noWrap title={identity.name} sx={{ m: 0 }}>
            {identity.name}
          </Typography>
          {identity.email ? (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              title={identity.email}
              sx={{ m: 0 }}
            >
              {identity.email}
            </Typography>
          ) : null}
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            title={roleLine}
            sx={{ m: 0, mt: 2 }}
          >
            {roleLine}
          </Typography>
        </Box>
        <Divider />
        {identity.viewAs ? viewAsMenuItems(identity.viewAs, t) : null}
        {(identity.organisations?.length ?? 0) > 1
          ? [
              <ListSubheader key="org-head" component="div" sx={QUIET_HEADER_SX}>
                {t('common.account.switchOrganisation')}
              </ListSubheader>,
              ...(identity.organisations ?? []).map((o) => {
                const current = o.id === identity.organisationId;
                return (
                  <MenuItem
                    key={o.id}
                    component="a"
                    href={`${identity.homeHref ?? '/admin/engagements'}?tenant=${encodeURIComponent(o.id)}`}
                    selected={current}
                    aria-current={current ? 'true' : undefined}
                    sx={MENU_ITEM_SX}
                    data-testid="switch-organisation"
                  >
                    <ListItemIcon sx={{ visibility: current ? 'visible' : 'hidden' }}>
                      <AppIcon name="success" />
                    </ListItemIcon>
                    <ListItemText
                      slotProps={{ primary: { noWrap: true } }}
                      sx={{ minWidth: 0 }}
                      title={o.label}
                    >
                      {o.label}
                    </ListItemText>
                  </MenuItem>
                );
              }),
              <Divider key="org-div" />,
            ]
          : null}
        <MenuItem
          component="a"
          href={identity.settingsHref ?? identity.workspaceHref ?? '/admin/engagements'}
          sx={MENU_ITEM_SX}
        >
          <ListItemIcon>
            <AppIcon name="settings" />
          </ListItemIcon>
          <ListItemText>{t('common.account.workspace')}</ListItemText>
        </MenuItem>
        {/* The forms live outside the menu (below); a form inside role="menu" breaks its ARIA structure. */}
        <MenuItem
          component="button"
          type="submit"
          form="account-sign-out-form"
          sx={{ ...MENU_ITEM_SX, width: '100%', font: 'inherit', textAlign: 'left' }}
          data-testid="sign-out"
        >
          <ListItemIcon>
            <AppIcon name="signOut" />
          </ListItemIcon>
          <ListItemText>{t('common.account.signOut')}</ListItemText>
        </MenuItem>
      </Menu>
      <form id="account-sign-out-form" method="post" action="/api/auth/logout" hidden />
      {identity.viewAs ? <ViewAsForm /> : null}
    </>
  );
}
