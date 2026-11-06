/** 화면(클라이언트) 좌표를 논리 좌표로 바꾼다. */
export function toLogical(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  logicalWidth: number,
  logicalHeight: number,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * logicalWidth,
    y: ((clientY - rect.top) / rect.height) * logicalHeight,
  };
}
