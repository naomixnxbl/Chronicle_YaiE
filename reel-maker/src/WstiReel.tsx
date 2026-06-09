import React from "react";
import { type ReelProps, type TemplateKey } from "./schema";
import { Engine } from "./templates/_engine";
import type { TemplateSpec } from "./templates/_types";
import { signatureSpec } from "./templates/signature";
import { polaroidSpec } from "./templates/polaroid";
import { editorialSpec } from "./templates/editorial";
import { boldSpec } from "./templates/bold";
import { documentarySpec } from "./templates/documentary";
import { monoSpec } from "./templates/mono";

// Each style is a TemplateSpec — the shared Engine handles the timeline shell,
// overlays, audio, and brand HUD; the spec plugs in the actual look.
const TEMPLATES: Record<TemplateKey, TemplateSpec> = {
  signature:   signatureSpec,
  polaroid:    polaroidSpec,
  editorial:   editorialSpec,
  bold:        boldSpec,
  documentary: documentarySpec,
  mono:        monoSpec,
};

export const WstiReel: React.FC<ReelProps> = (props) => {
  const spec = TEMPLATES[props.template] ?? signatureSpec;
  // Escape hatch — a template can bypass the slot model entirely. None bundled
  // today, but reserved for templates that need bespoke timeline math.
  if (spec.renderWhole) return <spec.renderWhole props={props} />;
  return <Engine props={props} spec={spec} />;
};
