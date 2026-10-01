import * as React from 'react';
import type { MessagePresentationMode } from '../../lib/message-presentation';

type Snapshot = {
  viewport: HTMLElement;
  atBottom: boolean;
  targets: Array<{ id: string; offset: number }>;
  scrollTop: number;
} | null;

/** Capture before DOM mutation; layout effects run too late to measure the old mode. */
export class PresentationScrollAnchor extends React.Component<
  {
    mode: MessagePresentationMode;
    children: React.ReactNode;
  },
  object,
  Snapshot
> {
  private root = React.createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(
    previous: Readonly<{ mode: MessagePresentationMode }>,
  ): Snapshot {
    if (previous.mode === this.props.mode) return null;
    let viewport = this.root.current?.parentElement;
    while (
      viewport &&
      !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)
    ) {
      viewport = viewport.parentElement;
    }
    if (!viewport) return null;
    const top = viewport.getBoundingClientRect().top;
    const targets = Array.from(
      this.root.current?.querySelectorAll<HTMLElement>(
        '[data-message-navigation-id]',
      ) ?? [],
    )
      .filter(
        (node) =>
          node.getClientRects().length &&
          node.getBoundingClientRect().bottom >= top,
      )
      .flatMap((node) => {
        const id = node.dataset.messageNavigationId;
        return id ? [{ id, offset: node.getBoundingClientRect().top - top }] : [];
      });
    return {
      viewport,
      targets,
      scrollTop: viewport.scrollTop,
      atBottom:
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 32,
    };
  }

  componentDidUpdate(
    _previous: Readonly<{ mode: MessagePresentationMode }>,
    _state: object,
    snapshot: Snapshot,
  ) {
    if (!snapshot) return;
    const { viewport } = snapshot;
    if (snapshot.atBottom) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    const nodes = Array.from(
      this.root.current?.querySelectorAll<HTMLElement>(
        '[data-message-navigation-id]',
      ) ?? [],
    );
    for (const target of snapshot.targets) {
      const node = nodes.find(
        (item) =>
          item.dataset.messageNavigationId === target.id &&
          item.getClientRects().length,
      );
      if (!node) continue;
      viewport.scrollTop +=
        node.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        target.offset;
      return;
    }
    viewport.scrollTop = snapshot.scrollTop;
  }

  render() {
    return (
      <div ref={this.root} className="contents">
        {this.props.children}
      </div>
    );
  }
}
