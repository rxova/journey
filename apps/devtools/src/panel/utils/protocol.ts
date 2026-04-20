import {
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsProtocolVersion
} from "@rxova/journey-devtools-bridge";

export const getProtocolMismatchReason = (
  protocolVersion: JourneyDevtoolsProtocolVersion | undefined
): string | null => {
  if (protocolVersion === undefined || protocolVersion === JOURNEY_DEVTOOLS_PROTOCOL_VERSION) {
    return null;
  }

  return `This devtools panel uses protocol v${JOURNEY_DEVTOOLS_PROTOCOL_VERSION}, but the selected machine is still using protocol v${protocolVersion}. Update the inspected app and extension together.`;
};

export const isLegacyProtocolVersion = (
  protocolVersion: JourneyDevtoolsProtocolVersion | undefined
): boolean => protocolVersion === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION;
