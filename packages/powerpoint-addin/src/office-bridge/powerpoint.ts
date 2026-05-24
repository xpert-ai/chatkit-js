import { isPowerPointToolName, type PowerPointToolName } from './tools';
import type {
  OfficeHostAdapter,
  PowerPointShapeGeometry,
  PowerPointShapeStyle,
  PowerPointShapeTarget,
} from './types';

type SelectedSlideInfo = {
  id?: string | number;
  index: number;
  title?: string;
};

type OfficeReadyInfo = {
  host?: Office.HostType;
  platform?: Office.PlatformType;
};

type ShapeSummary = {
  id?: string;
  name?: string;
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type PowerPointAdapterOptions = {
  maxSnapshotShapes?: number;
};

type MutableShape = PowerPoint.Shape & {
  fill?: {
    setSolidColor?: (color: string) => void;
  };
  lineFormat?: {
    color?: string;
  };
};

const DEFAULT_MAX_SNAPSHOT_SHAPES = 80;

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readString(value: unknown, field: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return normalized;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readNumber(value: unknown, field: string): number {
  const normalized = readOptionalNumber(value);
  if (normalized === undefined) {
    throw new Error(`${field} must be a finite number.`);
  }
  return normalized;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function readPositiveInteger(value: unknown, field: string): number {
  const normalized = readOptionalPositiveInteger(value);
  if (normalized === undefined) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return normalized;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function requireConfirm(value: unknown, action: string): void {
  if (value !== true) {
    throw new Error(`${action} requires confirm: true.`);
  }
}

function toZeroBasedSlideIndex(slideIndex: number): number {
  return slideIndex - 1;
}

function readSlideIndex(
  params: Record<string, unknown>,
  fallbackSlideIndex?: number,
): number {
  return (
    readOptionalPositiveInteger(params.slideIndex) ??
    fallbackSlideIndex ??
    1
  );
}

function readShapeGeometry(params: Record<string, unknown>): PowerPointShapeGeometry {
  return {
    left: readOptionalNumber(params.left),
    top: readOptionalNumber(params.top),
    width: readOptionalNumber(params.width),
    height: readOptionalNumber(params.height),
  };
}

function readShapeStyle(params: Record<string, unknown>): PowerPointShapeStyle {
  return {
    fillColor: readOptionalString(params.fillColor),
    lineColor: readOptionalString(params.lineColor),
    text: readOptionalString(params.text),
    name: readOptionalString(params.name),
  };
}

function readShapeTarget(params: Record<string, unknown>): PowerPointShapeTarget {
  return {
    slideIndex: readOptionalPositiveInteger(params.slideIndex),
    shapeId: readOptionalString(params.shapeId),
    shapeName: readOptionalString(params.shapeName),
  };
}

function readShapeAddOptions(
  geometry: PowerPointShapeGeometry,
): PowerPoint.ShapeAddOptions {
  return Object.fromEntries(
    Object.entries(geometry).filter((entry): entry is [string, number] => entry[1] !== undefined),
  ) as PowerPoint.ShapeAddOptions;
}

function setShapeGeometry(shape: PowerPoint.Shape, geometry: PowerPointShapeGeometry): void {
  if (geometry.left !== undefined) shape.left = geometry.left;
  if (geometry.top !== undefined) shape.top = geometry.top;
  if (geometry.width !== undefined) shape.width = geometry.width;
  if (geometry.height !== undefined) shape.height = geometry.height;
}

function setShapeStyle(shape: PowerPoint.Shape, style: PowerPointShapeStyle): void {
  const mutableShape = shape as MutableShape;
  if (style.name) shape.name = style.name;
  if (style.fillColor) mutableShape.fill?.setSolidColor?.(style.fillColor);
  if (style.lineColor && mutableShape.lineFormat) {
    mutableShape.lineFormat.color = style.lineColor;
  }
  if (style.text !== undefined) {
    shape.textFrame.textRange.text = style.text;
  }
}

function serializeShape(shape: PowerPoint.Shape): ShapeSummary {
  return {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    left: shape.left,
    top: shape.top,
    width: shape.width,
    height: shape.height,
  };
}

function loadShapeSummary(shape: PowerPoint.Shape): void {
  shape.load('id,name,type,left,top,width,height');
}

async function getSelectedSlides(): Promise<SelectedSlideInfo[]> {
  if (!globalThis.Office?.context?.document) {
    return [];
  }

  return new Promise((resolve) => {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.SlideRange,
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          resolve([]);
          return;
        }

        const value = result.value as unknown as { slides?: SelectedSlideInfo[] };
        resolve(Array.isArray(value.slides) ? value.slides : []);
      },
    );
  });
}

async function goToSlide(slideIndex: number): Promise<void> {
  if (!globalThis.Office?.context?.document) {
    throw new Error('Office.context.document is unavailable.');
  }

  await new Promise<void>((resolve, reject) => {
    Office.context.document.goToByIdAsync(
      slideIndex,
      Office.GoToType.Index,
      { selectionMode: Office.SelectionMode.None },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(new Error(result.error?.message || 'Failed to select slide.'));
        }
      },
    );
  });
}

async function setSelectedImage(
  base64: string,
  options: Office.SetSelectedDataOptions,
): Promise<void> {
  if (!globalThis.Office?.context?.document) {
    throw new Error('Office.context.document is unavailable.');
  }

  await new Promise<void>((resolve, reject) => {
    Office.context.document.setSelectedDataAsync(base64, options, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve();
      } else {
        reject(new Error(result.error?.message || 'Failed to insert image.'));
      }
    });
  });
}

function stripDataUrlPrefix(value: string): string {
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  return markerIndex === -1 ? value : value.slice(markerIndex + marker.length);
}

function readOfficeReadyInfo(): OfficeReadyInfo {
  return {
    host: globalThis.Office?.context?.host,
    platform: globalThis.Office?.context?.platform,
  };
}

function readRequirementSupport() {
  const requirements = globalThis.Office?.context?.requirements;
  return {
    powerpointApi: {
      '1.1': Boolean(requirements?.isSetSupported('PowerPointApi', '1.1')),
      '1.3': Boolean(requirements?.isSetSupported('PowerPointApi', '1.3')),
      '1.4': Boolean(requirements?.isSetSupported('PowerPointApi', '1.4')),
      '1.6': Boolean(requirements?.isSetSupported('PowerPointApi', '1.6')),
    },
    imageCoercion: {
      '1.1': Boolean(requirements?.isSetSupported('ImageCoercion', '1.1')),
    },
  };
}

function getSlides(context: PowerPoint.RequestContext) {
  return context.presentation.slides;
}

async function getSlideByIndex(
  context: PowerPoint.RequestContext,
  slideIndex: number,
) {
  return getSlides(context).getItemAt(toZeroBasedSlideIndex(slideIndex));
}

async function getShapeByTarget(
  context: PowerPoint.RequestContext,
  target: PowerPointShapeTarget,
) {
  const slide = await getSlideByIndex(context, target.slideIndex ?? 1);

  if (target.shapeId) {
    return slide.shapes.getItem(target.shapeId);
  }

  const shapeName = target.shapeName;
  if (!shapeName) {
    throw new Error('shapeId or shapeName is required.');
  }

  const shapes = slide.shapes;
  shapes.load('items/id,items/name');
  await context.sync();
  const found = shapes.items.find((shape) => shape.name === shapeName);
  if (!found) {
    throw new Error(`Shape not found: ${shapeName}`);
  }

  return shapes.getItem(found.id);
}

export class PowerPointOfficeAdapter
  implements OfficeHostAdapter<PowerPointToolName>
{
  readonly host = 'PowerPoint';

  readonly #maxSnapshotShapes: number;

  constructor(options: PowerPointAdapterOptions = {}) {
    this.#maxSnapshotShapes =
      options.maxSnapshotShapes ?? DEFAULT_MAX_SNAPSHOT_SHAPES;
  }

  supports(toolName: string): toolName is PowerPointToolName {
    return isPowerPointToolName(toolName);
  }

  async execute(
    toolName: PowerPointToolName,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'office_powerpoint_snapshot':
        return this.snapshot(params);
      case 'office_powerpoint_select_slide':
        return this.selectSlide(params);
      case 'office_powerpoint_add_slide':
        return this.addSlide(params);
      case 'office_powerpoint_delete_slide':
        return this.deleteSlide(params);
      case 'office_powerpoint_add_text_box':
        return this.addTextBox(params);
      case 'office_powerpoint_add_shape':
        return this.addShape(params);
      case 'office_powerpoint_update_shape':
        return this.updateShape(params);
      case 'office_powerpoint_delete_shape':
        return this.deleteShape(params);
      case 'office_powerpoint_insert_image':
        return this.insertImage(params);
    }
  }

  private async snapshot(params: Record<string, unknown>) {
    const selectedSlides = await getSelectedSlides();
    const selectedSlideIndex = selectedSlides[0]?.index;
    const slideIndex = readSlideIndex(params, selectedSlideIndex);
    const maxShapes =
      readOptionalPositiveInteger(params.maxShapes) ?? this.#maxSnapshotShapes;

    return PowerPoint.run(async (context) => {
      const slides = getSlides(context);
      slides.load('items/id');
      const slide = await getSlideByIndex(context, slideIndex);
      slide.load('id');
      slide.shapes.load('items');
      await context.sync();

      const shapes = slide.shapes.items.slice(0, maxShapes);
      shapes.forEach(loadShapeSummary);
      await context.sync();

      return {
        host: readOfficeReadyInfo(),
        requirements: readRequirementSupport(),
        slideCount: slides.items.length,
        selectedSlides,
        slide: {
          index: slideIndex,
          id: slide.id,
          shapeCount: slide.shapes.items.length,
          shapes: shapes.map(serializeShape),
          truncated: slide.shapes.items.length > shapes.length,
        },
      };
    });
  }

  private async selectSlide(params: Record<string, unknown>) {
    const slideIndex = readPositiveInteger(params.slideIndex, 'slideIndex');
    await goToSlide(slideIndex);
    return { slideIndex };
  }

  private async addSlide(params: Record<string, unknown>) {
    const slideMasterId = readOptionalString(params.slideMasterId);
    const layoutId = readOptionalString(params.layoutId);
    const options: PowerPoint.AddSlideOptions = {
      ...(slideMasterId ? { slideMasterId } : {}),
      ...(layoutId ? { layoutId } : {}),
    };

    return PowerPoint.run(async (context) => {
      const slides = getSlides(context);
      if (Object.keys(options).length) {
        slides.add(options);
      } else {
        slides.add();
      }
      slides.load('items/id');
      await context.sync();

      return {
        slideIndex: slides.items.length,
        slideCount: slides.items.length,
      };
    });
  }

  private async deleteSlide(params: Record<string, unknown>) {
    requireConfirm(params.confirm, 'Deleting a slide');
    const slideIndex = readPositiveInteger(params.slideIndex, 'slideIndex');

    return PowerPoint.run(async (context) => {
      const slide = await getSlideByIndex(context, slideIndex);
      slide.delete();
      await context.sync();
      return { slideIndex, deleted: true };
    });
  }

  private async addTextBox(params: Record<string, unknown>) {
    const selectedSlides = await getSelectedSlides();
    const slideIndex = readSlideIndex(params, selectedSlides[0]?.index);
    const text = readString(params.text, 'text');
    const geometry = readShapeGeometry(params);
    const style = readShapeStyle(params);

    return PowerPoint.run(async (context) => {
      const slide = await getSlideByIndex(context, slideIndex);
      const shape = slide.shapes.addTextBox(text, readShapeAddOptions(geometry));
      setShapeStyle(shape, style);
      loadShapeSummary(shape);
      await context.sync();

      return {
        slideIndex,
        shape: serializeShape(shape),
      };
    });
  }

  private async addShape(params: Record<string, unknown>) {
    const selectedSlides = await getSelectedSlides();
    const slideIndex = readSlideIndex(params, selectedSlides[0]?.index);
    const shapeType = readOptionalString(params.shapeType) ?? 'Rectangle';
    const geometry = readShapeGeometry(params);
    const style = readShapeStyle(params);

    return PowerPoint.run(async (context) => {
      const slide = await getSlideByIndex(context, slideIndex);
      const shape = slide.shapes.addGeometricShape(
        shapeType as PowerPoint.GeometricShapeType,
        readShapeAddOptions(geometry),
      );
      setShapeStyle(shape, style);
      loadShapeSummary(shape);
      await context.sync();

      return {
        slideIndex,
        shape: serializeShape(shape),
      };
    });
  }

  private async updateShape(params: Record<string, unknown>) {
    const target = readShapeTarget(params);
    const selectedSlides = await getSelectedSlides();
    target.slideIndex = target.slideIndex ?? selectedSlides[0]?.index ?? 1;
    const geometry = readShapeGeometry(params);
    const style = readShapeStyle(params);

    return PowerPoint.run(async (context) => {
      const shape = await getShapeByTarget(context, target);
      setShapeGeometry(shape, geometry);
      setShapeStyle(shape, style);
      loadShapeSummary(shape);
      await context.sync();

      return {
        slideIndex: target.slideIndex,
        shape: serializeShape(shape),
      };
    });
  }

  private async deleteShape(params: Record<string, unknown>) {
    requireConfirm(params.confirm, 'Deleting a shape');
    const target = readShapeTarget(params);
    const selectedSlides = await getSelectedSlides();
    target.slideIndex = target.slideIndex ?? selectedSlides[0]?.index ?? 1;

    return PowerPoint.run(async (context) => {
      const shape = await getShapeByTarget(context, target);
      shape.delete();
      await context.sync();
      return {
        slideIndex: target.slideIndex,
        shapeId: target.shapeId,
        shapeName: target.shapeName,
        deleted: true,
      };
    });
  }

  private async insertImage(params: Record<string, unknown>) {
    const selectedSlides = await getSelectedSlides();
    const slideIndex = readSlideIndex(params, selectedSlides[0]?.index);
    const base64 = stripDataUrlPrefix(
      readString(params.base64 ?? params.dataUrl, 'base64'),
    );
    await goToSlide(slideIndex);

    const options: Office.SetSelectedDataOptions = {
      coercionType: Office.CoercionType.Image,
      ...(readOptionalNumber(params.left) !== undefined
        ? { imageLeft: readNumber(params.left, 'left') }
        : {}),
      ...(readOptionalNumber(params.top) !== undefined
        ? { imageTop: readNumber(params.top, 'top') }
        : {}),
      ...(readOptionalNumber(params.width) !== undefined
        ? { imageWidth: readNumber(params.width, 'width') }
        : {}),
      ...(readOptionalNumber(params.height) !== undefined
        ? { imageHeight: readNumber(params.height, 'height') }
        : {}),
    };

    await setSelectedImage(base64, options);
    return {
      slideIndex,
      inserted: true,
      width: readOptionalNumber(params.width),
      height: readOptionalNumber(params.height),
    };
  }
}

export function createPowerPointOfficeAdapter(
  options: PowerPointAdapterOptions = {},
): OfficeHostAdapter<PowerPointToolName> {
  return new PowerPointOfficeAdapter(options);
}

export const powerPointInternalTestUtils = {
  toZeroBasedSlideIndex,
};
