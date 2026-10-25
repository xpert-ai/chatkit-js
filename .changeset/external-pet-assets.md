---
"@xpert-ai/chatkit-ui": minor
"@xpert-ai/chatkit-types": minor
"@xpert-ai/chatkit-web-component": patch
---

Move built-in pet images out of the UI distribution into the independently versioned optional @xpert-ai/chatkit-assets package. Add per-instance pet.assetsBaseUrl configuration for built-in pets, appearance sprites and host overlays. Deployments must copy the offline package's pets directory to /pets (the compatible default), or host it separately and configure pet.assetsBaseUrl. Existing custom sprite URLs remain unchanged.
