/** A small, area-preserving deformation driven by the arriving bubble's momentum. */
export function createSendMorph(width: number, height: number) {
  const duration = 400;
  const damping = 12;
  const frequency = 28;
  const peakTime = Math.atan(frequency / damping) / frequency;
  const peak = Math.exp(-damping * peakTime) * Math.sin(frequency * peakTime);
  const strength = Math.min(0.06, 12 / width, 6 / height);
  const surface: Keyframe[] = [];
  const content: Keyframe[] = [];
  for (let step = 0; step <= 48; step++) {
    const offset = step / 48;
    const time = (offset * duration) / 1000;
    const displacement =
      step === 48
        ? 0
        : (Math.exp(-damping * time) * Math.sin(frequency * time)) / peak;
    const x = 1 + strength * displacement;
    const y = 1 / x;
    surface.push({
      offset,
      transform: `scale(${x}, ${y})`,
      transformOrigin: 'center',
    });
    // Keep text and attachments at their original size as the surrounding shape flexes.
    content.push({
      offset,
      transform: `scale(${y}, ${x})`,
      transformOrigin: 'center',
    });
  }
  return { surface, content, duration };
}
