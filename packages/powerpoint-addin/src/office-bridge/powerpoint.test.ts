import { afterEach, describe, expect, it, vi } from 'vitest';
import { PowerPointOfficeAdapter, powerPointInternalTestUtils } from './powerpoint';

type AsyncCallback = (result: {
  status: Office.AsyncResultStatus;
  value?: unknown;
  error?: { message: string };
}) => void;

function stubOffice(selectedSlides: Array<{ index: number; id?: string }> = []) {
  vi.stubGlobal('Office', {
    AsyncResultStatus: {
      Succeeded: 'succeeded',
      Failed: 'failed',
    },
    CoercionType: {
      SlideRange: 'slideRange',
      Image: 'image',
    },
    GoToType: {
      Index: 'index',
    },
    SelectionMode: {
      None: 'none',
    },
    context: {
      host: 'PowerPoint',
      platform: 'PC',
      requirements: {
        isSetSupported: vi.fn(() => true),
      },
      document: {
        getSelectedDataAsync: vi.fn((_coercionType, callback: AsyncCallback) => {
          callback({
            status: 'succeeded' as unknown as Office.AsyncResultStatus,
            value: {
              slides: selectedSlides,
            },
          });
        }),
        goToByIdAsync: vi.fn((_id, _type, _options, callback: AsyncCallback) => {
          callback({
            status: 'succeeded' as unknown as Office.AsyncResultStatus,
          });
        }),
        setSelectedDataAsync: vi.fn((_data, _options, callback: AsyncCallback) => {
          callback({
            status: 'succeeded' as unknown as Office.AsyncResultStatus,
          });
        }),
      },
    },
  });
}

function stubPowerPointRun(context: unknown) {
  const run = vi.fn(async (callback: (ctx: unknown) => Promise<unknown>) =>
    callback(context),
  );
  vi.stubGlobal('PowerPoint', {
    run,
    GeometricShapeType: {
      rectangle: 'Rectangle',
    },
  });
  return run;
}

describe('PowerPointOfficeAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts user-facing slide indexes to Office zero-based indexes', () => {
    expect(powerPointInternalTestUtils.toZeroBasedSlideIndex(1)).toBe(0);
    expect(powerPointInternalTestUtils.toZeroBasedSlideIndex(7)).toBe(6);
  });

  it('deletes the requested 1-based slide index', async () => {
    stubOffice();
    const deleteSlide = vi.fn();
    const getItemAt = vi.fn(() => ({
      delete: deleteSlide,
    }));
    const context = {
      presentation: {
        slides: {
          getItemAt,
        },
      },
      sync: vi.fn(),
    };
    stubPowerPointRun(context);

    const adapter = new PowerPointOfficeAdapter();
    const result = await adapter.execute('office_powerpoint_delete_slide', {
      slideIndex: 3,
      confirm: true,
    });

    expect(getItemAt).toHaveBeenCalledWith(2);
    expect(deleteSlide).toHaveBeenCalled();
    expect(result).toEqual({
      slideIndex: 3,
      deleted: true,
    });
  });

  it('requires explicit confirmation before deleting a slide', async () => {
    stubOffice();
    const adapter = new PowerPointOfficeAdapter();

    await expect(
      adapter.execute('office_powerpoint_delete_slide', {
        slideIndex: 1,
      }),
    ).rejects.toThrow('confirm: true');
  });

  it('inserts images through Office setSelectedDataAsync', async () => {
    stubOffice([{ index: 2, id: 'slide-2' }]);
    const adapter = new PowerPointOfficeAdapter();

    const result = await adapter.execute('office_powerpoint_insert_image', {
      dataUrl: 'data:image/png;base64,abc123',
      left: 50,
      top: 60,
      width: 320,
    });

    expect(Office.context.document.goToByIdAsync).toHaveBeenCalledWith(
      2,
      Office.GoToType.Index,
      { selectionMode: Office.SelectionMode.None },
      expect.any(Function),
    );
    expect(Office.context.document.setSelectedDataAsync).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({
        coercionType: Office.CoercionType.Image,
        imageLeft: 50,
        imageTop: 60,
        imageWidth: 320,
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      slideIndex: 2,
      inserted: true,
      width: 320,
      height: undefined,
    });
  });
});
