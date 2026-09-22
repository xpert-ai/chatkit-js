import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import { RuntimeResourceInfo } from './RuntimeResourceInfo';
import { ResourceInfoProvider } from './useResourceInfo';
import type { RuntimeResourceCatalogItem } from '@xpert-ai/xpert-sdk';

const locale = vi.hoisted(() => ({ language: 'zh-Hans' }));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key, i18n: locale }),
}));

function Cards({ scope = 'open', names = ['A', 'B', 'C'] }) {
  return (
    <ThemeProvider>
      <ResourceInfoProvider scope={scope}>
        {names.map((name) => (
          <RuntimeResourceInfo
            key={name}
            item={{
              bindingId: name,
              version: '1',
              title: name,
              kind: 'external_xpert',
              status: 'ready',
              components: [],
              diagnostics: [],
            }}
          >
            <button>{name}</button>
          </RuntimeResourceInfo>
        ))}
      </ResourceInfoProvider>
    </ThemeProvider>
  );
}
const tick = (time: number) => act(() => vi.advanceTimersByTime(time));
beforeEach(() => {
  locale.language = 'zh-Hans';
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('resource information hover lifecycle', () => {
  it.each([false, true])(
    'localizes object descriptions, including legacy JSON: %s',
    (serialized) => {
      const description = {
        en_US: 'Visual canvas assistant',
        zh_Hans: '可视化画布助手',
      };
      const item: RuntimeResourceCatalogItem = {
        bindingId: 'canvas',
        version: '1',
        title: 'Canvas Assistant',
        kind: 'middleware',
        status: 'ready',
        components: [],
        diagnostics: [],
        description: serialized ? JSON.stringify(description) : description,
        views: [
          {
            key: 'canvas',
            title: 'Canvas',
            requiredFeatures: [],
            description: { en_US: 'Workspace view', zh_Hans: '工作区视图' },
          },
        ],
      };
      const card = (
        <ThemeProvider>
          <RuntimeResourceInfo item={item}>
            <button>Info</button>
          </RuntimeResourceInfo>
        </ThemeProvider>
      );
      const { rerender } = render(card);
      fireEvent.focus(screen.getByRole('button', { name: 'Info' }));
      expect(screen.getByRole('region')).toHaveTextContent(description.zh_Hans);
      expect(screen.getByRole('region')).toHaveTextContent('工作区视图');
      expect(screen.getByRole('region')).not.toHaveTextContent('en_US');
      locale.language = 'en-US';
      rerender(
        <ThemeProvider>
          <RuntimeResourceInfo item={item}>
            <button>Info</button>
          </RuntimeResourceInfo>
        </ThemeProvider>,
      );
      expect(screen.getByRole('region')).toHaveTextContent(description.en_US);
      expect(screen.getByRole('region')).toHaveTextContent('Workspace view');
      expect(screen.getByRole('region')).not.toHaveTextContent(
        description.zh_Hans,
      );
    },
  );

  it('does not reopen departed cards after rapid pointer and menu-focus events', () => {
    render(<Cards />);
    for (const name of ['A', 'B', 'C']) {
      const button = screen.getByRole('button', { name });
      fireEvent.pointerEnter(button, { pointerType: 'mouse' });
      fireEvent.focus(button);
      tick(25);
      fireEvent.pointerLeave(button, { pointerType: 'mouse' });
      fireEvent.blur(button);
    }
    tick(500);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('shows only the latest card and lets the pointer enter its content', () => {
    render(<Cards />);
    for (const name of ['A', 'B', 'C']) {
      const button = screen.getByRole('button', { name });
      fireEvent.pointerEnter(button, { pointerType: 'mouse' });
      fireEvent.focus(button);
      tick(200);
      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getByRole('region')).toHaveTextContent(name);
      fireEvent.pointerLeave(button, { pointerType: 'mouse' });
      fireEvent.blur(button);
    }
    fireEvent.pointerEnter(screen.getByRole('region'), {
      pointerType: 'mouse',
    });
    tick(300);
    expect(screen.getAllByRole('region')).toHaveLength(1);
    fireEvent.pointerLeave(screen.getByRole('region'), {
      pointerType: 'mouse',
    });
    tick(200);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('supports keyboard focus, blur and Escape without leaving delayed opens', () => {
    render(<Cards />);
    const button = screen.getByRole('button', { name: 'A' });
    fireEvent.focus(button);
    expect(screen.getByRole('region')).toHaveTextContent('A');
    fireEvent.keyDown(button, { key: 'Escape' });
    tick(300);
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.focus(button);
    fireEvent.blur(button);
    tick(200);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('cancels pending opens on menu/category changes and row unmount', () => {
    const { rerender, unmount } = render(<Cards />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A' }));
    rerender(<Cards scope="other-menu" />);
    tick(500);
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    rerender(<Cards scope="other-menu" names={['A', 'C']} />);
    tick(500);
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'C' }));
    unmount();
    tick(500);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
