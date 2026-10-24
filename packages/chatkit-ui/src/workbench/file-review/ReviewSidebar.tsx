import * as React from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { ResizableFileSidebar } from '../ResizableFileSidebar';
export { clampFileSidebarWidth as clampReviewSidebarWidth } from '../ResizableFileSidebar';

export function ReviewSidebar(props: {
  children: React.ReactNode;
  containerWidth: number;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <ResizableFileSidebar
      {...props}
      label={t('workbench.review.resizeFiles')}
      className="review-sidebar"
      contentClassName="review-sidebar-content"
      resizerClassName="review-sidebar-resizer"
      overlayClassName="review-sidebar-overlay"
    />
  );
}
